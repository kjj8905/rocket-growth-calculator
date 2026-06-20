import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import { SEO_GUIDES } from "./seo-guides.js";
import {
  COMMUNITY_BOARD_SLUGS,
  COMMUNITY_CATEGORIES,
  COMMUNITY_STAGE_SLUGS,
  LEGACY_COMMUNITY_CATEGORY_REDIRECTS,
  SEED_COMMUNITY_POSTS,
} from "./community-posts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 4176);
const PUBLIC_SITE_URL = normalizeSiteUrl(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || `http://localhost:${PORT}`);
const SESSION_COOKIE = "rg_session";
const OAUTH_STATE_COOKIE = "rg_kakao_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const HIDDEN_CALCULATOR_CATEGORIES = new Set(["margin", "china-purchase", "ad-break-even", "agency-margin", "cash-flow"]);
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const DATABASE_PATH = path.resolve(__dirname, process.env.DATABASE_PATH || "./data/app.sqlite");
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || `http://localhost:${PORT}/auth/kakao/callback`;
const ACCOUNT_FEATURE_ENABLED = !["off", "disabled", "hidden"].includes(String(process.env.ACCOUNT_FEATURE_ENABLED || "").toLowerCase());
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
const db = new DatabaseSync(DATABASE_PATH);
initializeDatabase();

app.use(async (req, res, next) => {
  const session = getSessionFromRequest(req);
  req.currentUser = session?.user || null;
  req.currentSessionId = session?.sessionId || null;
  next();
});

app.get("/api/me", (req, res) => {
  const accountFeatureEnabled = isAccountFeatureEnabled();

  res.json({
    accountFeatureEnabled,
    authenticated: accountFeatureEnabled && Boolean(req.currentUser),
    kakaoConfigured: isKakaoConfigured(),
    user: accountFeatureEnabled && req.currentUser
      ? {
          id: req.currentUser.id,
          kakaoId: req.currentUser.kakao_id,
          nickname: req.currentUser.nickname,
          email: req.currentUser.email,
        }
      : null,
  });
});

app.get("/auth/kakao/start", (req, res) => {
  if (!isAccountFeatureEnabled()) {
    res.status(404).send("계정 기능은 현재 제공되지 않습니다.");
    return;
  }

  if (!isKakaoConfigured()) {
    res.status(503).send(renderConfigErrorPage());
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  setSignedCookie(res, OAUTH_STATE_COOKIE, state, {
    maxAgeMs: OAUTH_STATE_TTL_MS,
    path: "/auth/kakao",
  });

  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", KAKAO_REST_API_KEY);
  url.searchParams.set("redirect_uri", KAKAO_REDIRECT_URI);
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

app.get("/auth/kakao/callback", async (req, res) => {
  if (!isKakaoConfigured()) {
    res.status(503).send(renderConfigErrorPage());
    return;
  }

  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    res.redirect(`/?auth=cancelled&reason=${encodeURIComponent(String(errorDescription || error))}`);
    return;
  }

  const cookieState = readSignedCookie(req, OAUTH_STATE_COOKIE);
  clearCookie(res, OAUTH_STATE_COOKIE, "/auth/kakao");

  if (!code || !state || !cookieState || state !== cookieState) {
    res.redirect("/?auth=invalid-state");
    return;
  }

  try {
    const token = await requestKakaoToken(String(code));
    const kakaoUser = await requestKakaoUser(token.access_token);
    const user = upsertUser(kakaoUser);
    const sessionId = createSession(user.id);

    setSignedCookie(res, SESSION_COOKIE, sessionId, {
      maxAgeMs: SESSION_TTL_MS,
      path: "/",
    });

    res.redirect("/?auth=success");
  } catch (errorObject) {
    console.error("Kakao login failed:", errorObject);
    res.redirect(`/?auth=error&reason=${encodeURIComponent(errorObject.message || "kakao-login-failed")}`);
  }
});

app.post("/auth/logout", requireLogin, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(req.currentSessionId);
  clearCookie(res, SESSION_COOKIE, "/");
  res.json({ ok: true });
});

app.get("/api/products", requireLogin, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, memo, tags_json, calc_data_json, stages_json, final_summary_json, created_at, updated_at
       FROM products
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
    )
    .all(req.currentUser.id);

  res.json({
    products: rows.map(productFromRow),
  });
});

app.post("/api/products", requireLogin, (req, res) => {
  const name = String(req.body?.name || "").trim() || "상품 1";
  const nameKey = normalizeProductNameKey(name);
  const memo = String(req.body?.memo || "").trim().slice(0, 1000);
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12)
    : [];
  const calcData = req.body?.calcData || req.body?.calc_data || {};
  const requestedId = String(req.body?.id || "").trim();
  const stages = req.body?.stages || {};
  const finalSummary = req.body?.finalSummary || {};
  const now = new Date().toISOString();
  const existingById = requestedId
    ? db.prepare("SELECT id FROM products WHERE id = ? AND user_id = ?").get(requestedId, req.currentUser.id)
    : null;
  const existingByName = nameKey
    ? db.prepare("SELECT id FROM products WHERE user_id = ? AND name_key = ? ORDER BY updated_at DESC").get(req.currentUser.id, nameKey)
    : null;
  const existing = existingById || existingByName;
  const id = existing?.id || requestedId || `product-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  if (existingById && existingByName && existingById.id !== existingByName.id) {
    res.status(409).json({
      error: "product_name_exists",
      message: "같은 상품명이 이미 저장되어 있습니다.",
      productId: existingByName.id,
    });
    return;
  }

  if (existing) {
    db.prepare(
      `UPDATE products
       SET name = ?, name_key = ?, memo = ?, tags_json = ?, calc_data_json = ?, stages_json = ?, final_summary_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    ).run(
      name,
      nameKey,
      memo,
      JSON.stringify(tags),
      JSON.stringify(calcData),
      JSON.stringify(stages),
      JSON.stringify(finalSummary),
      now,
      id,
      req.currentUser.id,
    );
  } else {
    db.prepare(
      `INSERT INTO products (id, user_id, name, name_key, memo, tags_json, calc_data_json, stages_json, final_summary_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      req.currentUser.id,
      name,
      nameKey,
      memo,
      JSON.stringify(tags),
      JSON.stringify(calcData),
      JSON.stringify(stages),
      JSON.stringify(finalSummary),
      now,
      now,
    );
  }

  const row = db
    .prepare(
      `SELECT id, name, memo, tags_json, calc_data_json, stages_json, final_summary_json, created_at, updated_at
       FROM products
       WHERE id = ? AND user_id = ?`,
    )
    .get(id, req.currentUser.id);

  res.json({ product: productFromRow(row), mode: existing ? "updated" : "created" });
});

app.delete("/api/products/:id", requireLogin, (req, res) => {
  const productId = String(req.params.id || "").trim();
  if (!productId) {
    res.status(400).json({ error: "invalid_product_id", message: "삭제할 계산안을 찾지 못했습니다." });
    return;
  }

  const result = db.prepare("DELETE FROM products WHERE id = ? AND user_id = ?").run(productId, req.currentUser.id);
  if (result.changes === 0) {
    res.status(404).json({ error: "product_not_found", message: "삭제할 계산안을 찾지 못했습니다." });
    return;
  }

  res.json({ ok: true, deletedId: productId });
});

app.get("/api/community/posts", (req, res) => {
  const category = normalizeCommunityCategory(req.query.category);
  const posts = getCommunityPosts({ category, limit: 50 });
  res.json({ posts });
});

app.get("/api/community/posts/:slug", (req, res) => {
  const post = getCommunityPostBySlug(req.params.slug);
  if (!post) {
    res.status(404).json({ error: "post_not_found", message: "게시글을 찾지 못했습니다." });
    return;
  }
  res.json({ post, comments: getCommunityComments(post.id) });
});

app.post("/api/community/posts", requireLogin, (req, res) => {
  const title = normalizeText(req.body?.title, 90);
  const category = normalizeCommunityCategory(req.body?.category) || "final-margin";
  const summary = normalizeText(req.body?.summary, 180);
  const bodyText = normalizeText(req.body?.body, 5000);
  const tags = normalizeTags(req.body?.tags);

  if (!title || !bodyText) {
    res.status(400).json({ error: "invalid_post", message: "제목과 본문을 입력해 주세요." });
    return;
  }

  const now = new Date().toISOString();
  const id = `post-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const slug = createUniqueCommunitySlug(title);
  const bodyJson = JSON.stringify([{ heading: "본문", body: bodyText.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean) }]);

  db.prepare(
    `INSERT INTO community_posts (
      id, slug, category, title, summary, body_json, tags_json, author_user_id, author_name,
      status, is_featured, is_notice, views, likes_count, bookmarks_count, comments_count, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 0, 0, 0, 0, 0, 0, 'user', ?, ?)`,
  ).run(
    id,
    slug,
    category,
    title,
    summary || title,
    bodyJson,
    JSON.stringify(tags),
    req.currentUser.id,
    getDisplayUserName(req.currentUser),
    now,
    now,
  );

  const post = getCommunityPostBySlug(slug);
  res.status(201).json({ post });
});

app.put("/api/community/posts/:id", requireLogin, (req, res) => {
  const existing = getEditableCommunityPost(req.params.id, req.currentUser.id);
  if (!existing) {
    res.status(404).json({ error: "post_not_found", message: "수정할 게시글을 찾지 못했습니다." });
    return;
  }

  const title = normalizeText(req.body?.title, 90) || existing.title;
  const category = normalizeCommunityCategory(req.body?.category) || existing.category;
  const summary = normalizeText(req.body?.summary, 180) || existing.summary;
  const bodyText = normalizeText(req.body?.body, 5000);
  const tags = normalizeTags(req.body?.tags);
  const bodyJson = bodyText
    ? JSON.stringify([{ heading: "본문", body: bodyText.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean) }])
    : JSON.stringify(existing.sections);

  db.prepare(
    `UPDATE community_posts
     SET title = ?, category = ?, summary = ?, body_json = ?, tags_json = ?, updated_at = ?
     WHERE id = ? AND author_user_id = ?`,
  ).run(title, category, summary, bodyJson, JSON.stringify(tags.length ? tags : existing.tags), new Date().toISOString(), existing.id, req.currentUser.id);

  res.json({ post: communityPostFromRow(db.prepare("SELECT * FROM community_posts WHERE id = ?").get(existing.id)) });
});

app.delete("/api/community/posts/:id", requireLogin, (req, res) => {
  const existing = getEditableCommunityPost(req.params.id, req.currentUser.id);
  if (!existing) {
    res.status(404).json({ error: "post_not_found", message: "삭제할 게시글을 찾지 못했습니다." });
    return;
  }

  db.prepare("DELETE FROM community_comments WHERE post_id = ?").run(existing.id);
  db.prepare("DELETE FROM community_reactions WHERE post_id = ?").run(existing.id);
  db.prepare("DELETE FROM community_posts WHERE id = ? AND author_user_id = ?").run(existing.id, req.currentUser.id);
  res.json({ ok: true, deletedId: existing.id });
});

app.post("/api/community/comments", requireLogin, (req, res) => {
  const post = getCommunityPostBySlug(req.body?.slug) || getCommunityPostById(req.body?.postId);
  const body = normalizeText(req.body?.body, 1500);
  if (!post || !body) {
    res.status(400).json({ error: "invalid_comment", message: "댓글을 남길 게시글과 내용을 확인해 주세요." });
    return;
  }

  const now = new Date().toISOString();
  const id = `comment-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  db.prepare(
    `INSERT INTO community_comments (id, post_id, user_id, author_name, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, post.id, req.currentUser.id, getDisplayUserName(req.currentUser), body, now, now);
  updateCommunityCommentCount(post.id);
  res.status(201).json({ comment: getCommunityCommentById(id), post: getCommunityPostById(post.id) });
});

app.delete("/api/community/comments/:id", requireLogin, (req, res) => {
  const comment = db.prepare("SELECT * FROM community_comments WHERE id = ? AND user_id = ?").get(String(req.params.id || ""), req.currentUser.id);
  if (!comment) {
    res.status(404).json({ error: "comment_not_found", message: "삭제할 댓글을 찾지 못했습니다." });
    return;
  }

  db.prepare("DELETE FROM community_comments WHERE id = ? AND user_id = ?").run(comment.id, req.currentUser.id);
  updateCommunityCommentCount(comment.post_id);
  res.json({ ok: true, deletedId: comment.id });
});

app.post("/api/community/reactions", requireLogin, (req, res) => {
  const post = getCommunityPostBySlug(req.body?.slug) || getCommunityPostById(req.body?.postId);
  const type = ["like", "bookmark"].includes(String(req.body?.type || "")) ? String(req.body.type) : "";
  if (!post || !type) {
    res.status(400).json({ error: "invalid_reaction", message: "반응할 게시글과 유형을 확인해 주세요." });
    return;
  }

  const existing = db
    .prepare("SELECT post_id FROM community_reactions WHERE post_id = ? AND user_id = ? AND type = ?")
    .get(post.id, req.currentUser.id, type);
  if (existing) {
    db.prepare("DELETE FROM community_reactions WHERE post_id = ? AND user_id = ? AND type = ?").run(post.id, req.currentUser.id, type);
  } else {
    db.prepare("INSERT INTO community_reactions (post_id, user_id, type, created_at) VALUES (?, ?, ?, ?)").run(
      post.id,
      req.currentUser.id,
      type,
      new Date().toISOString(),
    );
  }
  updateCommunityReactionCounts(post.id);
  res.json({ post: getCommunityPostById(post.id), active: !existing, type });
});

app.get(["/", "/index.html"], (req, res) => {
  const requestedCategory = String(req.query.category || "");
  if (HIDDEN_CALCULATOR_CATEGORIES.has(requestedCategory)) {
    res.redirect(302, "/community");
    return;
  }

  res.type("html").send(renderIndexHtml());
});

app.get("/saved", (req, res) => {
  res.type("html").send(renderIndexHtml());
});

app.get(["/community", "/community/"], (req, res) => {
  res.type("html").send(renderCommunityIndexPage());
});

app.get("/community/:legacyCategory(tips|cases|operations|logistics)", (req, res) => {
  const target = LEGACY_COMMUNITY_CATEGORY_REDIRECTS[req.params.legacyCategory] || "final-margin";
  res.redirect(301, `/community/${target}`);
});

app.get("/community/:category(china-sourcing|china-korea-logistics|korea-coupang-inbound|coupang-selling-cost|final-margin|qna|resources)", (req, res) => {
  res.type("html").send(renderCommunityCategoryPage(req.params.category));
});

app.get("/community/:slug", (req, res) => {
  const post = getCommunityPostBySlug(req.params.slug);
  if (!post) {
    res.status(404).type("html").send(renderNotFoundPage());
    return;
  }

  incrementCommunityViews(post.id);
  res.type("html").send(renderCommunityPostPage(getCommunityPostById(post.id)));
});

app.get(["/guides", "/guides/"], (req, res) => {
  res.type("html").send(renderGuideIndexPage());
});

app.get("/guides/:slug", (req, res) => {
  const guide = SEO_GUIDES.find((item) => item.slug === req.params.slug);
  if (!guide) {
    res.status(404).type("html").send(renderNotFoundPage());
    return;
  }

  res.type("html").send(renderGuidePage(guide));
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(renderRobotsTxt());
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").send(renderSitemapXml());
});

app.get("/llms.txt", (req, res) => {
  res.type("text/plain").send(renderLlmsTxt());
});

app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    service: "rocket-growth-calculator",
    time: new Date().toISOString(),
  });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Rocket Growth Calculator running at http://localhost:${PORT}`);
  if (!isKakaoConfigured()) {
    console.log("Kakao login is not configured.");
  }
});

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const index = trimmed.indexOf("=");
    if (index < 0) {
      return;
    }

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function normalizeSiteUrl(value) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  return url || `http://localhost:${PORT}`;
}

function renderIndexHtml() {
  const filePath = path.join(__dirname, "index.html");
  return fs.readFileSync(filePath, "utf8").replaceAll("__SITE_URL__", PUBLIC_SITE_URL);
}

function renderCommunityIndexPage() {
  const title = "쿠팡셀러 커뮤니티 | 로켓그로스 계산기";
  const description =
    "쿠팡셀러와 개인셀러를 위한 로켓그로스 5단계 커뮤니티입니다. 중국사입, 중국→한국 물류, 한국→쿠팡 입고, 쿠팡 소모 비용, 최종 비용을 단계별로 묻고 답합니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/community`;
  const recentPosts = getCommunityPosts({ limit: 12 });
  const featuredPosts = getCommunityPosts({ featured: true, limit: 5 });
  const qnaPosts = getCommunityPosts({ category: "qna", limit: 4 });
  const resourcePosts = getCommunityPosts({ category: "resources", limit: 4 });

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("community")}
      ${renderCommunityCategoryNav("community")}
      <section class="community-forum-hero" aria-labelledby="community-title">
        <div>
          <span class="community-live-label">셀러 커뮤니티</span>
          <h1 id="community-title">계산기 5단계와 같은 흐름으로 묻고 답합니다.</h1>
          <p>중국사입부터 최종 비용까지, 셀러들이 실제로 막히는 비용·물류·수수료 질문을 단계별 게시판으로 정리했습니다.</p>
          <div class="community-quick-actions">
            <a href="/community/qna">질문답변</a>
            <a href="/community/resources">자료실</a>
            <a href="/">계산기로 돌아가기</a>
          </div>
        </div>
        <aside class="community-snapshot">
          ${renderCommunityStats()}
        </aside>
      </section>
      <section class="community-layout">
        <div class="community-main-stack">
          ${renderCommunityPostSection("최신 셀러 피드", recentPosts)}
          ${renderCommunityPostSection("운영자가 고정한 글", featuredPosts)}
        </div>
        <aside class="community-side-stack">
          ${renderCommunityWritePanel()}
          ${renderCommunityBoardNav("community")}
          ${renderCommunityPostSection("최근 질문", qnaPosts, "compact")}
          ${renderCommunityPostSection("자료실 업데이트", resourcePosts, "compact")}
          ${renderCommunityTagPanel()}
        </aside>
      </section>
    </main>`,
    jsonLd: buildCommunityIndexJsonLd(title, description, canonicalUrl, featuredPosts),
    script: renderCommunityScript(),
  });
}

function renderCommunityCategoryPage(categorySlug) {
  const category = COMMUNITY_CATEGORIES[categorySlug] || COMMUNITY_CATEGORIES["final-margin"];
  const posts = getCommunityPosts({ category: category.slug, limit: 40 });
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/${category.slug}`;
  const isBoard = COMMUNITY_BOARD_SLUGS.includes(category.slug);

  return renderDocumentShell({
    title: `${category.title} | 로켓그로스 계산기 커뮤니티`,
    description: category.description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader(category.slug)}
      <section class="community-list-head">
        <div>
          <p class="eyebrow">${escapeHtml(category.label)}</p>
          <h1>${escapeHtml(category.title)}</h1>
          <p>${escapeHtml(category.description)}</p>
        </div>
        <a class="guide-secondary-link" href="/community">커뮤니티 홈</a>
      </section>
      ${isBoard ? renderCommunityBoardNav(category.slug) : renderCommunityCategoryNav(category.slug)}
      <section class="community-layout">
        <div class="community-main-stack">
          ${renderCommunityPostSection(`${category.label} 글`, posts)}
        </div>
        <aside class="community-side-stack">
          ${renderCommunityWritePanel(category.slug)}
          ${renderCommunityTagPanel()}
        </aside>
      </section>
    </main>`,
    jsonLd: buildCommunityCategoryJsonLd(category, canonicalUrl, posts),
    script: renderCommunityScript(),
  });
}

function renderCommunityPostPage(post) {
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/${post.slug}`;
  const comments = getCommunityComments(post.id);
  const relatedPosts = getCommunityPosts({ category: post.category, limit: 5 }).filter((item) => item.id !== post.id).slice(0, 4);
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];
  const isBoardPost = COMMUNITY_BOARD_SLUGS.includes(post.category);

  return renderDocumentShell({
    title: `${post.title} | 로켓그로스 계산기 커뮤니티`,
    description: post.summary,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader(post.category)}
      ${isBoardPost ? renderCommunityBoardNav(post.category) : renderCommunityCategoryNav(post.category, "compact")}
      <article class="community-post-article" data-community-post="${escapeHtml(post.slug)}">
        <nav class="guide-breadcrumb" aria-label="breadcrumb">
          <a href="/">계산기</a>
          <span>/</span>
          <a href="/community">커뮤니티</a>
          <span>/</span>
          <a href="/community/${escapeHtml(category.slug)}">${escapeHtml(category.label)}</a>
        </nav>
        <p class="eyebrow">${escapeHtml(category.label)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="guide-lede">${escapeHtml(post.summary)}</p>
        <div class="community-post-meta">
          <span>${escapeHtml(post.authorName)}</span>
          <span>조회 ${formatInteger(post.views)}</span>
          <span>추천 ${formatInteger(post.likesCount)}</span>
          <span>댓글 ${formatInteger(post.commentsCount)}</span>
        </div>
        <div class="community-tag-row">${post.tags.map((tag) => `<a href="/community?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
        <div class="community-post-actions">
          <button type="button" data-community-reaction="like" data-post-slug="${escapeHtml(post.slug)}">추천하기</button>
          <button type="button" data-community-reaction="bookmark" data-post-slug="${escapeHtml(post.slug)}">꿀팁 저장</button>
          <a href="/?calc=final">계산기로 확인</a>
        </div>
        <div class="guide-section-list">
          ${post.sections
            .map(
              (section) => `<section>
                <h2>${escapeHtml(section.heading)}</h2>
                ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
              </section>`,
            )
            .join("")}
        </div>
        ${renderCommunityFaq(post)}
      </article>
      <section class="community-comments" aria-labelledby="community-comments-title">
        <div class="community-comments-head">
          <div>
            <p class="eyebrow">댓글</p>
            <h2 id="community-comments-title">질문과 경험을 남겨주세요.</h2>
          </div>
          <a href="/auth/kakao/start">카카오로 시작하기</a>
        </div>
        <form class="community-comment-form" data-community-comment-form data-post-slug="${escapeHtml(post.slug)}">
          <textarea name="body" rows="4" maxlength="1500" placeholder="추가 질문, 실제 견적 차이, 본인 사례를 남겨주세요."></textarea>
          <button class="primary-small-button" type="submit">댓글 남기기</button>
          <p data-community-message></p>
        </form>
        <div class="community-comment-list">
          ${comments.length
            ? comments.map((comment) => `<article>
                <strong>${escapeHtml(comment.authorName)}</strong>
                <p>${escapeHtml(comment.body)}</p>
                <time datetime="${escapeHtml(comment.createdAt)}">${formatDate(comment.createdAt)}</time>
              </article>`).join("")
            : `<p class="community-empty">아직 댓글이 없습니다. 첫 질문을 남겨보세요.</p>`}
        </div>
      </section>
      <aside class="guide-related community-related" aria-label="관련 글">
        <p class="eyebrow">관련 꿀팁</p>
        <div>${relatedPosts.map((item) => `<a href="/community/${item.slug}">${escapeHtml(item.title)}</a>`).join("")}</div>
      </aside>
    </main>`,
    jsonLd: buildCommunityPostJsonLd(post, canonicalUrl, comments),
    script: renderCommunityScript(post.slug),
  });
}

function renderCommunityHeader(activeKey) {
  const navItems = [
    { key: "calculator", label: "계산기 홈", href: "/" },
    { key: "community", label: "셀러 커뮤니티", href: "/community" },
    { key: "qna", label: "질문답변", href: "/community/qna" },
    { key: "resources", label: "자료실", href: "/community/resources" },
    { key: "guides", label: "계산 기준", href: "/guides" },
  ];

  return `<header class="community-topbar">
    <a class="community-brand" href="/">로켓그로스 계산기</a>
    <nav aria-label="커뮤니티 메뉴">
      ${navItems
        .map((item) => {
          const isCommunityCategory = activeKey === "community" || COMMUNITY_STAGE_SLUGS.includes(activeKey);
          const isActive = item.key === activeKey || (item.key === "community" && isCommunityCategory);
          return `<a class="${isActive ? "is-active" : ""}" href="${item.href}">${escapeHtml(item.label)}</a>`;
        })
        .join("")}
    </nav>
  </header>`;
}

function renderCommunityCategoryNav(activeKey = "community", mode = "default") {
  const counts = getCommunityCategoryCounts();
  const stageCount = COMMUNITY_STAGE_SLUGS.reduce((sum, slug) => sum + (counts[slug] || 0), 0);
  const items = [
    {
      slug: "community",
      label: "전체",
      title: "전체 단계",
      description: "로켓그로스 5단계 글을 한 번에 봅니다.",
      count: stageCount,
      href: "/community",
    },
    ...COMMUNITY_STAGE_SLUGS.map((slug) => {
      const category = COMMUNITY_CATEGORIES[slug];
      return {
        ...category,
        count: counts[category.slug] || 0,
        href: `/community/${category.slug}`,
      };
    }),
  ];

  return `<section class="community-category-nav ${mode === "compact" ? "is-compact" : ""}" aria-labelledby="community-category-title">
    <div class="community-category-nav-head">
      <div>
        <span>로켓그로스 단계 카테고리</span>
        <h2 id="community-category-title">계산기와 같은 5단계로 탐색하세요.</h2>
      </div>
      <p>중국사입부터 최종 비용까지, 계산기에서 보던 순서 그대로 글을 나눴습니다.</p>
    </div>
    <div class="community-category-tabs" role="list">
      ${items
        .map((item) => {
          const isActive = item.slug === activeKey || (activeKey === "community" && item.slug === "community");
          return `<a class="community-category-chip ${isActive ? "is-active" : ""}" href="${item.href}" ${isActive ? 'aria-current="page"' : ""} role="listitem">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.description)}</small>
            <em>${formatInteger(item.count)}개 글 보기</em>
          </a>`;
        })
        .join("")}
    </div>
  </section>`;
}

function renderCommunityBoardNav(activeKey = "community") {
  const counts = getCommunityCategoryCounts();
  const boards = COMMUNITY_BOARD_SLUGS.map((slug) => {
    const category = COMMUNITY_CATEGORIES[slug];
    return {
      ...category,
      count: counts[slug] || 0,
      href: `/community/${slug}`,
    };
  });

  return `<section class="community-board-nav" aria-labelledby="community-board-title">
    <div>
      <span>커뮤니티 게시판</span>
      <h2 id="community-board-title">질문과 자료는 따로 모았습니다.</h2>
    </div>
    <div class="community-board-links">
      ${boards
        .map((board) => `<a class="${board.slug === activeKey ? "is-active" : ""}" href="${board.href}" ${board.slug === activeKey ? 'aria-current="page"' : ""}>
          <strong>${escapeHtml(board.label)}</strong>
          <span>${escapeHtml(board.description)}</span>
          <em>${formatInteger(board.count)}개</em>
        </a>`)
        .join("")}
    </div>
  </section>`;
}

function renderCommunityStats() {
  const counts = getCommunityCategoryCounts();
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const stageTotal = COMMUNITY_STAGE_SLUGS.reduce((sum, slug) => sum + (counts[slug] || 0), 0);
  return `<dl class="community-stat-list">
    <div>
      <dt>전체 글</dt>
      <dd>${formatInteger(total)}</dd>
    </div>
    <div>
      <dt>단계 글</dt>
      <dd>${formatInteger(stageTotal)}</dd>
    </div>
    <div>
      <dt>질문</dt>
      <dd>${formatInteger(counts.qna || 0)}</dd>
    </div>
    <div>
      <dt>자료</dt>
      <dd>${formatInteger(counts.resources || 0)}</dd>
    </div>
  </dl>`;
}

function renderCommunityPostSection(title, posts, mode = "default") {
  return `<section class="community-post-section ${mode === "compact" ? "is-compact" : ""}">
    <div class="community-section-head">
      <h2>${escapeHtml(title)}</h2>
      <span>${formatInteger(posts.length)}개</span>
    </div>
    <div class="community-post-list">
      ${posts.length ? posts.map(renderCommunityPostCard).join("") : `<p class="community-empty">아직 공개된 글이 없습니다.</p>`}
    </div>
  </section>`;
}

function renderCommunityPostCard(post) {
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];
  return `<a class="community-post-card" href="/community/${post.slug}">
    <span>${escapeHtml(category.label)}</span>
    <strong>${escapeHtml(post.title)}</strong>
    <p>${escapeHtml(post.summary)}</p>
    <em>조회 ${formatInteger(post.views)} · 추천 ${formatInteger(post.likesCount)} · 댓글 ${formatInteger(post.commentsCount)}</em>
  </a>`;
}

function renderCommunityWritePanel(defaultCategory = "final-margin") {
  const stageOptions = COMMUNITY_STAGE_SLUGS.map((slug) => COMMUNITY_CATEGORIES[slug]);
  const boardOptions = COMMUNITY_BOARD_SLUGS.map((slug) => COMMUNITY_CATEGORIES[slug]);

  return `<section class="community-write-panel" aria-labelledby="community-write-title">
    <p class="eyebrow">글쓰기</p>
    <h2 id="community-write-title">꿀팁이나 질문을 남겨보세요.</h2>
    <p>읽기는 모두 가능하고, 글쓰기와 댓글은 카카오 로그인 후 사용할 수 있습니다.</p>
    <form data-community-post-form>
      <label>
        <span>분류</span>
        <select name="category">
          <optgroup label="로켓그로스 5단계">
            ${stageOptions
              .map((category) => `<option value="${category.slug}" ${category.slug === defaultCategory ? "selected" : ""}>${escapeHtml(category.label)}</option>`)
              .join("")}
          </optgroup>
          <optgroup label="커뮤니티 게시판">
            ${boardOptions
              .map((category) => `<option value="${category.slug}" ${category.slug === defaultCategory ? "selected" : ""}>${escapeHtml(category.label)}</option>`)
              .join("")}
          </optgroup>
        </select>
      </label>
      <label>
        <span>제목</span>
        <input name="title" maxlength="90" placeholder="예: LCL 견적이 이 정도면 괜찮나요?" />
      </label>
      <label>
        <span>요약</span>
        <input name="summary" maxlength="180" placeholder="글 목록에 보일 한 줄 요약" />
      </label>
      <label>
        <span>본문</span>
        <textarea name="body" rows="5" maxlength="5000" placeholder="상황, 숫자, 궁금한 점을 함께 적어주세요."></textarea>
      </label>
      <label>
        <span>태그</span>
        <input name="tags" placeholder="로켓그로스, 중국사입, LCL" />
      </label>
      <button class="primary-small-button" type="submit">글 등록</button>
      <p data-community-message></p>
    </form>
  </section>`;
}

function renderCommunityTagPanel() {
  const tags = ["로켓그로스", "중국사입", "LCL", "쿠팡수수료", "파레트", "광고", "세금", "초보셀러"];
  return `<section class="community-tag-panel">
    <p class="eyebrow">탐색 태그</p>
    <div>${tags.map((tag) => `<a href="/community?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
  </section>`;
}

function renderCommunityFaq(post) {
  if (!post.faq.length) {
    return "";
  }

  return `<section class="guide-faq-block">
    <p class="eyebrow">FAQ</p>
    <h2>자주 묻는 질문</h2>
    <div class="guide-faq-list">
      ${post.faq.map((item) => `<article><h3>${escapeHtml(item.question)}</h3><p>${escapeHtml(item.answer)}</p></article>`).join("")}
    </div>
  </section>`;
}

function renderCommunityScript(postSlug = "") {
  return `<script>
    (function () {
      function track(name, params) {
        if (typeof window.gtag === "function") {
          window.gtag("event", name, params || {});
        }
      }
      track("community_view", { page_path: window.location.pathname });
      ${postSlug ? `window.setTimeout(function () { track("post_read_60s", { post_slug: ${JSON.stringify(postSlug)} }); }, 60000);` : ""}

      function setMessage(form, message, tone) {
        var target = form.querySelector("[data-community-message]");
        if (!target) return;
        target.textContent = message;
        target.dataset.tone = tone || "neutral";
      }

      document.querySelectorAll("[data-community-post-form]").forEach(function (form) {
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          var data = new FormData(form);
          var payload = {
            category: data.get("category"),
            title: data.get("title"),
            summary: data.get("summary"),
            body: data.get("body"),
            tags: String(data.get("tags") || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean)
          };
          try {
            var response = await fetch("/api/community/posts", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            var result = await response.json().catch(function () { return {}; });
            if (response.status === 401) {
              setMessage(form, "카카오로 시작하면 글을 등록할 수 있습니다.", "warning");
              return;
            }
            if (!response.ok) throw new Error(result.message || "글을 등록하지 못했습니다.");
            track("post_submit", { post_slug: result.post.slug, category: result.post.category });
            window.location.href = "/community/" + result.post.slug;
          } catch (error) {
            setMessage(form, error.message || "잠시 후 다시 시도해 주세요.", "warning");
          }
        });
      });

      document.querySelectorAll("[data-community-comment-form]").forEach(function (form) {
        var textarea = form.querySelector("textarea");
        textarea && textarea.addEventListener("focus", function () {
          track("post_comment_start", { post_slug: form.dataset.postSlug });
        }, { once: true });
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          try {
            var response = await fetch("/api/community/comments", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: form.dataset.postSlug, body: textarea.value })
            });
            var result = await response.json().catch(function () { return {}; });
            if (response.status === 401) {
              setMessage(form, "카카오로 시작하면 댓글을 남길 수 있습니다.", "warning");
              return;
            }
            if (!response.ok) throw new Error(result.message || "댓글을 남기지 못했습니다.");
            window.location.reload();
          } catch (error) {
            setMessage(form, error.message || "잠시 후 다시 시도해 주세요.", "warning");
          }
        });
      });

      document.querySelectorAll("[data-community-reaction]").forEach(function (button) {
        button.addEventListener("click", async function () {
          try {
            var response = await fetch("/api/community/reactions", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: button.dataset.postSlug, type: button.dataset.communityReaction })
            });
            if (response.status === 401) {
              window.alert("카카오로 시작하면 추천과 꿀팁 저장을 사용할 수 있습니다.");
              return;
            }
            if (!response.ok) throw new Error("반응을 저장하지 못했습니다.");
            window.location.reload();
          } catch {
            button.textContent = "잠시 후 다시 시도";
          }
        });
      });
    })();
  </script>`;
}

function renderGuideIndexPage() {
  const title = "로켓그로스 계산 기준 자료실";
  const description =
    "로켓그로스 계산기, LCL 물류비, 수입 부가세, 쿠팡 파레트 비용, 쿠팡 판매 수수료처럼 초보 셀러가 헷갈리는 계산 기준을 문서로 정리한 지식 허브입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/guides`;
  const guideLinks = SEO_GUIDES.map(
    (guide) => `<a class="guide-library-card" href="/guides/${guide.slug}">
        <span>계산 기준</span>
        <strong>${escapeHtml(guide.title)}</strong>
        <p>${escapeHtml(guide.description)}</p>
        <em>${escapeHtml(guide.keyword)}</em>
      </a>`,
  ).join("");

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("guides")}
      <section class="community-forum-hero guide-library-hero" aria-labelledby="guide-library-title">
        <div>
          <span class="community-live-label">계산 기준 자료실</span>
          <h1 id="guide-library-title">검색엔진과 셀러가 같이 읽는 비용 기준입니다.</h1>
          <p>계산기 화면은 짧게 유지하고, 세금·수수료·물류 기준은 별도 문서로 정리했습니다. 궁금한 기준을 읽고 다시 계산기로 돌아갈 수 있습니다.</p>
          <div class="community-quick-actions">
            <a href="/">계산기로 돌아가기</a>
            <a href="/community">커뮤니티 보기</a>
            <a href="/community/resources">자료실 글 보기</a>
          </div>
        </div>
        <aside class="community-snapshot guide-library-snapshot">
          <dl class="community-stat-list">
            <div>
              <dt>문서</dt>
              <dd>${formatInteger(SEO_GUIDES.length)}</dd>
            </div>
            <div>
              <dt>핵심 단계</dt>
              <dd>5</dd>
            </div>
            <div>
              <dt>FAQ</dt>
              <dd>${formatInteger(SEO_GUIDES.reduce((sum, guide) => sum + guide.faq.length, 0))}</dd>
            </div>
            <div>
              <dt>대상</dt>
              <dd>셀러</dd>
            </div>
          </dl>
        </aside>
      </section>
      <section class="community-layout guide-library-layout">
        <div class="community-main-stack">
          <section class="community-post-section guide-resource-section">
            <div class="community-section-head">
              <h2>계산 기준 문서</h2>
              <span>${formatInteger(SEO_GUIDES.length)}개</span>
            </div>
            <div class="guide-library-grid">${guideLinks}</div>
          </section>
        </div>
        <aside class="community-side-stack">
          ${renderCommunityCategoryNav("community", "compact")}
          ${renderCommunityBoardNav("resources")}
          ${renderCommunityTagPanel()}
        </aside>
      </section>
    </main>`,
    jsonLd: buildGuideIndexJsonLd(title, description, canonicalUrl),
  });
}

function renderGuidePage(guide) {
  const canonicalUrl = `${PUBLIC_SITE_URL}/guides/${guide.slug}`;
  const sections = guide.sections
    .map(
      (section) => `<section>
        <h2>${escapeHtml(section.heading)}</h2>
        ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </section>`,
    )
    .join("");
  const faq = guide.faq
    .map(
      (item) => `<article>
        <h3>${escapeHtml(item.question)}</h3>
        <p>${escapeHtml(item.answer)}</p>
      </article>`,
    )
    .join("");
  const relatedLinks = SEO_GUIDES.filter((item) => item.slug !== guide.slug)
    .slice(0, 4)
    .map((item) => `<a href="/guides/${item.slug}">${escapeHtml(item.title)}</a>`)
    .join("");

  return renderDocumentShell({
    title: guide.metaTitle,
    description: guide.description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("guides")}
      <section class="guide-detail-layout">
        <article class="guide-article community-guide-article">
          <nav class="guide-breadcrumb" aria-label="breadcrumb">
            <a href="/">계산기</a>
            <span>/</span>
            <a href="/guides">계산 기준</a>
          </nav>
          <p class="eyebrow">${escapeHtml(guide.keyword)}</p>
          <h1>${escapeHtml(guide.title)}</h1>
          <p class="guide-lede">${escapeHtml(guide.summary)}</p>
          <div class="guide-cta">
            <a class="guide-primary-link" href="${getCalculatorHref(guide.slug)}">계산기에서 확인하기</a>
            <a class="guide-secondary-link" href="/guides">다른 기준 보기</a>
          </div>
          <div class="guide-section-list">${sections}</div>
          <section class="guide-faq-block" aria-labelledby="guide-faq-title">
            <p class="eyebrow">FAQ</p>
            <h2 id="guide-faq-title">자주 묻는 질문</h2>
            <div class="guide-faq-list">${faq}</div>
          </section>
        </article>
        <aside class="community-side-stack guide-detail-sidebar">
          <section class="community-board-nav guide-summary-panel">
            <div>
              <span>문서 요약</span>
              <h2>${escapeHtml(guide.keyword)}</h2>
            </div>
            <p>${escapeHtml(guide.description)}</p>
            <a class="guide-primary-link" href="${getCalculatorHref(guide.slug)}">계산기로 이동</a>
          </section>
          ${renderCommunityCategoryNav("community", "compact")}
          <aside class="guide-related community-related" aria-label="관련 가이드">
            <p class="eyebrow">관련 기준</p>
            <div>${relatedLinks}</div>
          </aside>
        </aside>
      </section>
    </main>`,
    jsonLd: buildGuideJsonLd(guide, canonicalUrl),
  });
}

function renderNotFoundPage() {
  return renderDocumentShell({
    title: "페이지를 찾을 수 없습니다",
    description: "요청한 로켓그로스 계산기 가이드 페이지를 찾을 수 없습니다.",
    canonicalUrl: `${PUBLIC_SITE_URL}/guides`,
    body: `<main class="community-shell">
      ${renderCommunityHeader("guides")}
      <article class="guide-article community-guide-article">
        <p class="eyebrow">404</p>
        <h1>페이지를 찾을 수 없습니다.</h1>
        <p class="guide-lede">주소를 다시 확인하거나 지식 허브에서 필요한 계산 기준을 선택하세요.</p>
        <div class="guide-cta">
          <a class="guide-primary-link" href="/guides">지식 허브 보기</a>
          <a class="guide-secondary-link" href="/">계산기로 돌아가기</a>
        </div>
      </article>
    </main>`,
    jsonLd: null,
  });
}

function renderDocumentShell({ title, description, canonicalUrl, body, jsonLd, script = "" }) {
  const jsonLdBlock = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2).replace(/</g, "\\u003c")}</script>`
    : "";

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="icon" href="/assets/rocket-favicon.svg?v=20260611" type="image/svg+xml" />
    <link rel="shortcut icon" href="/assets/rocket-favicon.svg?v=20260611" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:site_name" content="로켓그로스 계산기" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${PUBLIC_SITE_URL}/assets/site-flow.svg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${PUBLIC_SITE_URL}/assets/site-flow.svg" />
    <link rel="stylesheet" href="/styles.css" />
    <meta name="naver-site-verification" content="d2091fad160915c822215f48ce925c90637cf535" />
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-EGL6JRLHH0"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-EGL6JRLHH0');
    </script>
    <script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6269248806672306"
      crossorigin="anonymous"
    ></script>
    ${jsonLdBlock}
  </head>
  <body>
    ${body}
    ${script}
  </body>
</html>`;
}

function buildGuideIndexJsonLd(title, description, canonicalUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationNode(),
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        name: title,
        description,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        isPartOf: {
          "@id": `${PUBLIC_SITE_URL}/#website`,
        },
        hasPart: SEO_GUIDES.map((guide) => ({
          "@type": "WebPage",
          name: guide.title,
          url: `${PUBLIC_SITE_URL}/guides/${guide.slug}`,
        })),
      },
    ],
  };
}

function buildGuideJsonLd(guide, canonicalUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationNode(),
      {
        "@type": "Article",
        "@id": `${canonicalUrl}#article`,
        headline: guide.title,
        name: guide.title,
        description: guide.description,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        mainEntityOfPage: canonicalUrl,
        author: {
          "@id": `${PUBLIC_SITE_URL}/#organization`,
        },
        publisher: {
          "@id": `${PUBLIC_SITE_URL}/#organization`,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "로켓그로스 계산기",
            item: `${PUBLIC_SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "지식 허브",
            item: `${PUBLIC_SITE_URL}/guides`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: guide.title,
            item: canonicalUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        inLanguage: "ko-KR",
        mainEntity: guide.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };
}

function buildCommunityIndexJsonLd(title, description, canonicalUrl, posts) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationNode(),
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        name: title,
        description,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        isPartOf: {
          "@id": `${PUBLIC_SITE_URL}/#website`,
        },
        hasPart: posts.map((post) => ({
          "@type": post.category === "qna" ? "QAPage" : "Article",
          name: post.title,
          url: `${PUBLIC_SITE_URL}/community/${post.slug}`,
        })),
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#items`,
        itemListElement: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.title,
          url: `${PUBLIC_SITE_URL}/community/${post.slug}`,
        })),
      },
    ],
  };
}

function buildCommunityCategoryJsonLd(category, canonicalUrl, posts) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganizationNode(),
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#webpage`,
        name: category.title,
        description: category.description,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        isPartOf: {
          "@id": `${PUBLIC_SITE_URL}/#website`,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "로켓그로스 계산기",
            item: `${PUBLIC_SITE_URL}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "셀러 커뮤니티",
            item: `${PUBLIC_SITE_URL}/community`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: category.label,
            item: canonicalUrl,
          },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#items`,
        itemListElement: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: post.title,
          url: `${PUBLIC_SITE_URL}/community/${post.slug}`,
        })),
      },
    ],
  };
}

function buildCommunityPostJsonLd(post, canonicalUrl, comments) {
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];
  const isQuestion = post.category === "qna";
  const mainEntity = isQuestion
    ? {
        "@type": "Question",
        name: post.title,
        text: post.summary,
        answerCount: comments.length,
        dateCreated: post.createdAt,
        author: {
          "@type": "Person",
          name: post.authorName,
        },
        acceptedAnswer: comments[0]
          ? {
              "@type": "Answer",
              text: comments[0].body,
              dateCreated: comments[0].createdAt,
              author: {
                "@type": "Person",
                name: comments[0].authorName,
              },
            }
          : undefined,
      }
    : null;
  const primaryNode = isQuestion
    ? {
        "@type": "QAPage",
        "@id": `${canonicalUrl}#webpage`,
        name: post.title,
        description: post.summary,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        mainEntity,
      }
    : {
        "@type": post.source === "user" ? "DiscussionForumPosting" : "Article",
        "@id": `${canonicalUrl}#article`,
        headline: post.title,
        name: post.title,
        description: post.summary,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        datePublished: post.createdAt,
        dateModified: post.updatedAt,
        keywords: post.tags.join(", "),
        author: {
          "@type": post.source === "seed" ? "Organization" : "Person",
          name: post.authorName,
        },
        publisher: {
          "@id": `${PUBLIC_SITE_URL}/#organization`,
        },
        mainEntityOfPage: canonicalUrl,
      };

  const graph = [
    buildOrganizationNode(),
    primaryNode,
    {
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "로켓그로스 계산기",
          item: `${PUBLIC_SITE_URL}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "셀러 커뮤니티",
          item: `${PUBLIC_SITE_URL}/community`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: category.label,
          item: `${PUBLIC_SITE_URL}/community/${category.slug}`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: post.title,
          item: canonicalUrl,
        },
      ],
    },
  ];

  if (post.faq.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${canonicalUrl}#faq`,
      inLanguage: "ko-KR",
      mainEntity: post.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function buildOrganizationNode() {
  return {
    "@type": "Organization",
    "@id": `${PUBLIC_SITE_URL}/#organization`,
    name: "로켓그로스 계산기",
    url: `${PUBLIC_SITE_URL}/`,
  };
}

function getCalculatorHref(slug) {
  const routes = {
    "rocket-growth-calculator": "/",
    "margin-price-calculator": "/community/final-margin",
    "china-purchase-cost": "/community/china-sourcing",
    "ad-break-even-roas": "/community/coupang-selling-cost",
    "cash-flow-calculator": "/community/resources",
    "lcl-logistics-cost": "china-korea",
    "import-vat-customs": "china-korea",
    "coupang-pallet-cost": "korea-coupang",
    "coupang-fee": "coupang",
  };
  const route = routes[slug] || "final";
  return route.startsWith("/") ? route : `/?calc=${route}`;
}

function renderRobotsTxt() {
  return [
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    "User-agent: GPTBot",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    "User-agent: ChatGPT-User",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    "",
    `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}

function renderSitemapXml() {
  const today = new Date().toISOString().slice(0, 10);
  const communityCategories = Object.values(COMMUNITY_CATEGORIES).map((category) => ({
    loc: `${PUBLIC_SITE_URL}/community/${category.slug}`,
    priority: COMMUNITY_STAGE_SLUGS.includes(category.slug) || category.slug === "qna" ? "0.9" : "0.8",
    changefreq: "weekly",
  }));
  const communityPosts = getCommunityPosts({ limit: 100 }).map((post) => ({
    loc: `${PUBLIC_SITE_URL}/community/${post.slug}`,
    priority: post.isFeatured ? "0.8" : "0.7",
    changefreq: "weekly",
  }));
  const urls = [
    { loc: `${PUBLIC_SITE_URL}/`, priority: "1.0", changefreq: "weekly" },
    { loc: `${PUBLIC_SITE_URL}/community`, priority: "0.9", changefreq: "weekly" },
    ...communityCategories,
    ...communityPosts,
    { loc: `${PUBLIC_SITE_URL}/guides`, priority: "0.8", changefreq: "monthly" },
    ...SEO_GUIDES.map((guide) => ({
      loc: `${PUBLIC_SITE_URL}/guides/${guide.slug}`,
      priority: guide.slug === "rocket-growth-calculator" ? "0.9" : "0.8",
      changefreq: "monthly",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function renderLlmsTxt() {
  const guideList = SEO_GUIDES.map((guide) => [
    `- ${guide.title}: ${PUBLIC_SITE_URL}/guides/${guide.slug}`,
    `  - 주요 키워드: ${guide.keyword}`,
    `  - 요약: ${guide.summary}`,
  ].join("\n")).join("\n");
  const communityList = getCommunityPosts({ limit: 30 }).map((post) => [
    `- ${post.title}: ${PUBLIC_SITE_URL}/community/${post.slug}`,
    `  - 분류: ${(COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"]).label}`,
    `  - 요약: ${post.summary}`,
  ].join("\n")).join("\n");

  return [
    "# 로켓그로스 계산기",
    "",
    "로켓그로스 계산기는 쿠팡 로켓그로스 판매 전 비용과 마진을 단계별로 계산하는 한국어 셀러용 계산기입니다.",
    "공식 세금 신고나 쿠팡 정산 확정 도구가 아니라, 판매 전 예상 비용과 가격 의사결정을 돕는 참고 도구입니다.",
    "",
    "## 주요 계산 범위",
    "- 로켓그로스 비용 계산: 중국사입, 중국→한국 LCL 물류, 한국→쿠팡 입고, 쿠팡 판매 수수료, 최종 비용과 마진",
    "- 마진·판매가 계산: 정산금액, 순이익, 마진율, 손익분기 판매가, 목표 마진 판매가",
    "- 중국사입 원가 계산: 1688 사입 원가, 환율, 구매대행 또는 배송대행 수수료, 중국 내륙 운송비",
    "- 광고 손익분기 계산: 허용 광고비, 최소 ROAS, 손익분기 CPC",
    "- 사입·정산 현금흐름 계산: 월말 잔액, 다음 발주 가능금액, 현금 부족 위험",
    "",
    "## 핵심 답변",
    "- 최종 예상 총비용은 중국사입 총 비용, 중국→한국 물류 총 비용, 한국→쿠팡 입고 총 비용, 쿠팡 소모 비용을 합산합니다.",
    "- 원산지증명서를 선택하면 계산기에서는 관세율을 0%로 보는 예상 기준을 적용하지만, 수입 부가세와 통관비는 별도 비용입니다.",
    "- LCL 물류비는 CBM 기준 예상치이며 포워딩 업체, 시즌, 선적지, 도착항, 화물 조건에 따라 실제 청구액이 달라질 수 있습니다.",
    "- 쿠팡 파레트 비용은 파레트 수량과 운송 조건에 따라 달라지며, 파레트 없이 입고하는 경우 해당 비용을 0원으로 계산할 수 있습니다.",
    "- 쿠팡 판매 수수료는 카테고리 수수료율을 판매가에 적용해 예상액을 계산합니다.",
    "",
    "## 주요 문서",
    `- 지식 허브: ${PUBLIC_SITE_URL}/guides`,
    guideList,
    "",
    "## 셀러 커뮤니티",
    `- 커뮤니티 홈: ${PUBLIC_SITE_URL}/community`,
    `- 중국사입 단계: ${PUBLIC_SITE_URL}/community/china-sourcing`,
    `- 중국→한국 물류: ${PUBLIC_SITE_URL}/community/china-korea-logistics`,
    `- 한국→쿠팡 입고: ${PUBLIC_SITE_URL}/community/korea-coupang-inbound`,
    `- 쿠팡 소모 비용: ${PUBLIC_SITE_URL}/community/coupang-selling-cost`,
    `- 최종 비용·마진: ${PUBLIC_SITE_URL}/community/final-margin`,
    `- 질문답변: ${PUBLIC_SITE_URL}/community/qna`,
    `- 자료실: ${PUBLIC_SITE_URL}/community/resources`,
    communityList,
    "",
    "## 대표 질문",
    "- 로켓그로스 계산기는 어떤 비용을 계산하나요?",
    "- 중국사입 원가와 최종 상품원가는 왜 다른가요?",
    "- LCL 물류비와 CBM은 어떻게 계산하나요?",
    "- 수입 부가세 10%는 관세와 무엇이 다른가요?",
    "- 쿠팡 파레트 없이 입고하면 비용은 어떻게 반영하나요?",
    "- 광고 ROAS가 높아도 손실이 날 수 있나요?",
    "",
    "## Canonical",
    `${PUBLIC_SITE_URL}/`,
    "",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isKakaoConfigured() {
  return isAccountFeatureEnabled() && Boolean(KAKAO_REST_API_KEY && KAKAO_REDIRECT_URI);
}

function isAccountFeatureEnabled() {
  return ACCOUNT_FEATURE_ENABLED;
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function encodeSignedValue(value) {
  return `${value}.${sign(value)}`;
}

function decodeSignedValue(value) {
  const [raw, signature] = String(value || "").split(".");
  if (!raw || !signature) {
    return null;
  }

  const expected = sign(raw);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }

  return raw;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf("=");
        if (index < 0) {
          return [pair, ""];
        }
        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      }),
  );
}

function readSignedCookie(req, name) {
  return decodeSignedValue(parseCookies(req)[name]);
}

function setSignedCookie(res, name, value, options) {
  const maxAgeSeconds = Math.floor(options.maxAgeMs / 1000);
  res.cookie(name, encodeSignedValue(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: options.maxAgeMs,
    path: options.path,
  });
  res.setHeader("Cache-Control", "no-store");
  return maxAgeSeconds;
}

function clearCookie(res, name, pathValue) {
  res.clearCookie(name, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: pathValue,
  });
}

function getSessionFromRequest(req) {
  const sessionId = readSignedCookie(req, SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const row = db
    .prepare(
      `SELECT sessions.id AS session_id, sessions.expires_at, users.id, users.kakao_id, users.nickname, users.email
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`,
    )
    .get(sessionId);

  if (!row) {
    return null;
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    return null;
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.id,
      kakao_id: row.kakao_id,
      nickname: row.nickname,
      email: row.email,
    },
  };
}

function requireLogin(req, res, next) {
  if (!isAccountFeatureEnabled()) {
    res.status(403).json({ error: "account_feature_disabled", message: "저장 기능은 현재 제공하지 않습니다." });
    return;
  }

  if (!req.currentUser) {
    res.status(401).json({ error: "login_required", message: "상품 저장을 위해 로그인이 필요합니다." });
    return;
  }
  next();
}

function normalizeProductNameKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kakao_id TEXT NOT NULL UNIQUE,
      nickname TEXT,
      email TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_key TEXT,
      memo TEXT DEFAULT '',
      tags_json TEXT DEFAULT '[]',
      calc_data_json TEXT DEFAULT '{}',
      stages_json TEXT NOT NULL,
      final_summary_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS products_user_updated_idx ON products (user_id, updated_at);

    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      body_json TEXT NOT NULL,
      tags_json TEXT DEFAULT '[]',
      author_user_id INTEGER,
      author_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_notice INTEGER NOT NULL DEFAULT 0,
      views INTEGER NOT NULL DEFAULT 0,
      likes_count INTEGER NOT NULL DEFAULT 0,
      bookmarks_count INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS community_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_reactions (
      post_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id, type),
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS community_posts_category_updated_idx ON community_posts (category, updated_at);
    CREATE INDEX IF NOT EXISTS community_posts_status_updated_idx ON community_posts (status, updated_at);
    CREATE INDEX IF NOT EXISTS community_comments_post_created_idx ON community_comments (post_id, created_at);
  `);

  migrateProductMetadataColumns();
  migrateProductNameKeys();
  seedCommunityPosts();
}

function migrateProductMetadataColumns() {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  const hasMemo = columns.some((column) => column.name === "memo");
  const hasTags = columns.some((column) => column.name === "tags_json");
  const hasCalcData = columns.some((column) => column.name === "calc_data_json");

  if (!hasMemo) {
    db.exec("ALTER TABLE products ADD COLUMN memo TEXT DEFAULT ''");
  }

  if (!hasTags) {
    db.exec("ALTER TABLE products ADD COLUMN tags_json TEXT DEFAULT '[]'");
  }

  if (!hasCalcData) {
    db.exec("ALTER TABLE products ADD COLUMN calc_data_json TEXT DEFAULT '{}'");
  }
}

function migrateProductNameKeys() {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  const hasNameKey = columns.some((column) => column.name === "name_key");

  if (!hasNameKey) {
    db.exec("ALTER TABLE products ADD COLUMN name_key TEXT");
  }

  const products = db.prepare("SELECT id, name FROM products WHERE name_key IS NULL OR name_key = ''").all();
  const updateNameKey = db.prepare("UPDATE products SET name_key = ? WHERE id = ?");
  products.forEach((product) => {
    updateNameKey.run(normalizeProductNameKey(product.name), product.id);
  });

  db.exec("CREATE INDEX IF NOT EXISTS products_user_name_key_idx ON products (user_id, name_key)");
  const duplicate = db
    .prepare(
      `SELECT user_id, name_key, COUNT(*) AS count
       FROM products
       WHERE name_key IS NOT NULL AND name_key <> ''
       GROUP BY user_id, name_key
       HAVING COUNT(*) > 1
       LIMIT 1`,
    )
    .get();
  if (!duplicate) {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS products_user_name_key_unique
       ON products (user_id, name_key)
       WHERE name_key IS NOT NULL AND name_key <> ''`,
    );
  }
}

async function requestKakaoToken(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: KAKAO_REST_API_KEY,
    redirect_uri: KAKAO_REDIRECT_URI,
    code,
  });

  if (KAKAO_CLIENT_SECRET) {
    body.set("client_secret", KAKAO_CLIENT_SECRET);
  }

  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.msg || "kakao-token-request-failed");
  }

  return data;
}

async function requestKakaoUser(accessToken) {
  const response = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg || "kakao-user-request-failed");
  }

  return data;
}

function upsertUser(kakaoUser) {
  const kakaoId = String(kakaoUser.id);
  const account = kakaoUser.kakao_account || {};
  const profile = account.profile || {};
  const nickname = profile.nickname || null;
  const email = account.email || null;
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT * FROM users WHERE kakao_id = ?").get(kakaoId);

  if (existing) {
    db.prepare("UPDATE users SET nickname = ?, email = ?, updated_at = ? WHERE kakao_id = ?").run(
      nickname,
      email,
      now,
      kakaoId,
    );
    return db.prepare("SELECT * FROM users WHERE kakao_id = ?").get(kakaoId);
  }

  const result = db
    .prepare("INSERT INTO users (kakao_id, nickname, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(kakaoId, nickname, email, now, now);

  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
}

function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(sessionId, userId, expiresAt);
  return sessionId;
}

function productFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    memo: row.memo || "",
    tags: parseJson(row.tags_json, []),
    calcData: parseJson(row.calc_data_json, {}),
    stages: parseJson(row.stages_json, {}),
    finalSummary: parseJson(row.final_summary_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function seedCommunityPosts() {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO community_posts (
      id, slug, category, title, summary, body_json, tags_json, author_user_id, author_name,
      status, is_featured, is_notice, views, likes_count, bookmarks_count, comments_count, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'published', ?, ?, ?, 0, 0, 0, 'seed', ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE community_posts
     SET category = ?, title = ?, summary = ?, body_json = ?, tags_json = ?, author_name = ?,
         is_featured = ?, is_notice = ?, source = 'seed', updated_at = ?
     WHERE slug = ? AND source = 'seed'`,
  );

  SEED_COMMUNITY_POSTS.forEach((post, index) => {
    const existing = db.prepare("SELECT id FROM community_posts WHERE slug = ?").get(post.slug);
    const createdAt = new Date(Date.now() - (SEED_COMMUNITY_POSTS.length - index) * 3600 * 1000).toISOString();
    const values = [
      post.category,
      post.title,
      post.summary,
      JSON.stringify(post.sections || []),
      JSON.stringify(post.tags || []),
      post.authorName || "브랜드코어",
      post.isFeatured ? 1 : 0,
      post.isNotice ? 1 : 0,
      now,
    ];

    if (existing) {
      update.run(...values, post.slug);
      return;
    }

    insert.run(
      `seed-${post.slug}`,
      post.slug,
      post.category,
      post.title,
      post.summary,
      JSON.stringify(post.sections || []),
      JSON.stringify(post.tags || []),
      post.authorName || "브랜드코어",
      post.isFeatured ? 1 : 0,
      post.isNotice ? 1 : 0,
      Math.max(12, 120 - index * 4),
      createdAt,
      now,
    );
  });
}

function communityPostFromRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    summary: row.summary,
    sections: normalizePostSections(parseJson(row.body_json, [])),
    faq: getSeedPostFaq(row.slug),
    tags: parseJson(row.tags_json, []),
    authorUserId: row.author_user_id,
    authorName: row.author_name || "셀러",
    status: row.status,
    isFeatured: Boolean(row.is_featured),
    isNotice: Boolean(row.is_notice),
    views: Number(row.views || 0),
    likesCount: Number(row.likes_count || 0),
    bookmarksCount: Number(row.bookmarks_count || 0),
    commentsCount: Number(row.comments_count || 0),
    source: row.source || "user",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePostSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [{ heading: "본문", body: ["내용을 준비하고 있습니다."] }];
  }

  return sections.map((section) => ({
    heading: String(section.heading || "본문"),
    body: Array.isArray(section.body) ? section.body.map((item) => String(item)) : [String(section.body || "")],
  }));
}

function getSeedPostFaq(slug) {
  const seedPost = SEED_COMMUNITY_POSTS.find((post) => post.slug === slug);
  return Array.isArray(seedPost?.faq) ? seedPost.faq : [];
}

function getCommunityPosts(options = {}) {
  const category = normalizeCommunityCategory(options.category);
  const featured = Boolean(options.featured);
  const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
  const where = ["status = 'published'"];
  const params = [];

  if (category) {
    where.push("category = ?");
    params.push(category);
  }

  if (featured) {
    where.push("is_featured = 1");
  }

  params.push(limit);
  return db
    .prepare(
      `SELECT * FROM community_posts
       WHERE ${where.join(" AND ")}
       ORDER BY is_notice DESC, is_featured DESC, updated_at DESC
       LIMIT ?`,
    )
    .all(...params)
    .map(communityPostFromRow);
}

function getCommunityCategoryCounts() {
  return db
    .prepare("SELECT category, COUNT(*) AS count FROM community_posts WHERE status = 'published' GROUP BY category")
    .all()
    .reduce((acc, row) => {
      acc[row.category] = Number(row.count || 0);
      return acc;
    }, {});
}

function getCommunityPostBySlug(slug) {
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) {
    return null;
  }
  return communityPostFromRow(
    db.prepare("SELECT * FROM community_posts WHERE slug = ? AND status = 'published'").get(normalizedSlug),
  );
}

function getCommunityPostById(id) {
  const postId = String(id || "").trim();
  if (!postId) {
    return null;
  }
  return communityPostFromRow(db.prepare("SELECT * FROM community_posts WHERE id = ? AND status = 'published'").get(postId));
}

function getEditableCommunityPost(id, userId) {
  const row = db.prepare("SELECT * FROM community_posts WHERE id = ? AND author_user_id = ? AND source = 'user'").get(String(id || ""), userId);
  return communityPostFromRow(row);
}

function getCommunityComments(postId) {
  return db
    .prepare("SELECT * FROM community_comments WHERE post_id = ? ORDER BY created_at ASC")
    .all(postId)
    .map(communityCommentFromRow);
}

function getCommunityCommentById(id) {
  return communityCommentFromRow(db.prepare("SELECT * FROM community_comments WHERE id = ?").get(id));
}

function communityCommentFromRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    postId: row.post_id,
    userId: row.user_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function updateCommunityCommentCount(postId) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM community_comments WHERE post_id = ?").get(postId)?.count || 0;
  db.prepare("UPDATE community_posts SET comments_count = ?, updated_at = ? WHERE id = ?").run(count, new Date().toISOString(), postId);
}

function updateCommunityReactionCounts(postId) {
  const likes = db.prepare("SELECT COUNT(*) AS count FROM community_reactions WHERE post_id = ? AND type = 'like'").get(postId)?.count || 0;
  const bookmarks = db.prepare("SELECT COUNT(*) AS count FROM community_reactions WHERE post_id = ? AND type = 'bookmark'").get(postId)?.count || 0;
  db.prepare("UPDATE community_posts SET likes_count = ?, bookmarks_count = ?, updated_at = ? WHERE id = ?").run(
    likes,
    bookmarks,
    new Date().toISOString(),
    postId,
  );
}

function incrementCommunityViews(postId) {
  db.prepare("UPDATE community_posts SET views = views + 1 WHERE id = ?").run(postId);
}

function normalizeCommunityCategory(category) {
  const value = String(category || "").trim();
  return COMMUNITY_CATEGORIES[value] ? value : "";
}

function normalizeText(value, maxLength) {
  return String(value || "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const allowed = new Set(["로켓그로스", "중국사입", "LCL", "쿠팡수수료", "파레트", "광고", "세금", "초보셀러"]);
  return [...new Set(source.map((tag) => String(tag).trim()).filter((tag) => tag && allowed.has(tag)).slice(0, 8))];
}

function createUniqueCommunitySlug(title) {
  const baseSlug = slugify(title) || `post-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;
  while (db.prepare("SELECT id FROM community_posts WHERE slug = ?").get(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getDisplayUserName(user) {
  return user?.nickname || "카카오 셀러";
}

function formatInteger(value) {
  return new Intl.NumberFormat("ko-KR").format(Number(value || 0));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function renderConfigErrorPage() {
  return `
    <!doctype html>
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>계정 기능 점검 중</title>
        <style>
          body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f9fafb; color: #191f28; }
          main { max-width: 640px; margin: 80px auto; padding: 32px; border-radius: 16px; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
          h1 { margin: 0 0 16px; font-size: 26px; line-height: 36px; }
          p { color: #4e5968; line-height: 24px; }
          a { color: #3182f6; font-weight: 700; }
        </style>
      </head>
      <body>
        <main>
          <h1>계정 기능을 점검하고 있습니다.</h1>
          <p>계산기는 바로 사용할 수 있고, 상품 저장은 잠시 후 다시 이용해 주세요.</p>
          <p><a href="/">계산기로 돌아가기</a></p>
        </main>
      </body>
    </html>
  `;
}
