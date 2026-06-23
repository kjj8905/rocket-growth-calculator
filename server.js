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
const OAUTH_RETURN_COOKIE = "rg_kakao_return";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;
const HIDDEN_CALCULATOR_CATEGORIES = new Set(["margin", "china-purchase", "ad-break-even", "agency-margin", "cash-flow"]);
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret-change-me";
const DATABASE_PATH = path.resolve(__dirname, process.env.DATABASE_PATH || "./data/app.sqlite");
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || `http://localhost:${PORT}/auth/kakao/callback`;
const ACCOUNT_FEATURE_ENABLED = !["off", "disabled", "hidden", "false", "0"].includes(String(process.env.ACCOUNT_FEATURE_ENABLED || "").toLowerCase());
const COOKIE_SECURE = PUBLIC_SITE_URL.startsWith("https://");
const SEARCH_TREND_CACHE_TTL_MS = Number(process.env.SEARCH_TREND_CACHE_TTL_MS || 1000 * 60 * 10);
const GOOGLE_TRENDS_RSS_URL = process.env.GOOGLE_TRENDS_RSS_URL || "https://trends.google.com/trending/rss?geo=KR";
const NAVER_TREND_API_URL = process.env.NAVER_TREND_API_URL || "";
const DAUM_TREND_API_URL = process.env.DAUM_TREND_API_URL || "";
const NAVER_DATALAB_CLIENT_ID = process.env.NAVER_DATALAB_CLIENT_ID || process.env.NAVER_CLIENT_ID || "";
const NAVER_DATALAB_CLIENT_SECRET = process.env.NAVER_DATALAB_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET || "";
const TREND_KEYWORD_GROUPS = [
  { title: "로켓그로스 비용", keywords: ["로켓그로스 비용", "로켓그로스 계산기", "쿠팡 로켓그로스 비용"], url: "/guides/rocket-growth-calculator" },
  { title: "쿠팡 수수료", keywords: ["쿠팡 수수료", "쿠팡 판매 수수료", "쿠팡 수수료 계산기"], url: "/guides/coupang-fee" },
  { title: "중국사입 원가", keywords: ["중국사입 원가", "중국사입 계산기", "1688 사입 원가"], url: "/guides/china-purchase-cost" },
  { title: "LCL 물류비", keywords: ["LCL 물류비", "CBM 계산", "중국 한국 물류비"], url: "/guides/lcl-logistics-cost" },
  { title: "쿠팡 파레트", keywords: ["쿠팡 파레트", "쿠팡 입고 비용", "로켓그로스 입고"], url: "/guides/coupang-pallet-cost" },
];
let searchTrendCache = {
  expiresAt: 0,
  data: null,
};
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
          handle: makeCommunityHandle(getDisplayUserName(req.currentUser)),
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
  const returnTo = getSafeReturnPath(req.query.returnTo || req.get("referer") || "/");
  setSignedCookie(res, OAUTH_STATE_COOKIE, state, {
    maxAgeMs: OAUTH_STATE_TTL_MS,
    path: "/auth/kakao",
  });
  setSignedCookie(res, OAUTH_RETURN_COOKIE, returnTo, {
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
  const returnTo = getSafeReturnPath(readSignedCookie(req, OAUTH_RETURN_COOKIE) || "/");
  clearCookie(res, OAUTH_STATE_COOKIE, "/auth/kakao");
  clearCookie(res, OAUTH_RETURN_COOKIE, "/auth/kakao");

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

    res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}auth=success`);
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

app.post("/dev/auth/virtual-user", (req, res) => {
  if (process.env.COMMUNITY_TEST_AUTH !== "true") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const nickname = normalizeText(req.body?.nickname, 40) || "가상셀러";
  const kakaoId = `virtual-${nickname.replace(/\s+/g, "-")}`;
  const user = upsertUser({
    id: kakaoId,
    kakao_account: {
      email: `${kakaoId}@sellerdit.test`,
      profile: { nickname },
    },
  });
  const sessionId = createSession(user.id);
  setSignedCookie(res, SESSION_COOKIE, sessionId, {
    maxAgeMs: SESSION_TTL_MS,
    path: "/",
  });
  res.json({ ok: true, user: { id: user.id, nickname: user.nickname, handle: makeCommunityHandle(nickname) } });
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
  res.json({ post, comments: getCommunityCommentTree(post.id) });
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
  const parentId = normalizeText(req.body?.parentId || req.body?.parent_id, 120);
  if (!post || !body) {
    res.status(400).json({ error: "invalid_comment", message: "댓글을 남길 게시글과 내용을 확인해 주세요." });
    return;
  }

  let parentComment = null;
  if (parentId) {
    parentComment = db.prepare("SELECT id, post_id FROM community_comments WHERE id = ?").get(parentId);
    if (!parentComment || parentComment.post_id !== post.id) {
      res.status(400).json({ error: "invalid_parent_comment", message: "답글을 달 댓글을 찾지 못했습니다." });
      return;
    }
  }

  const now = new Date().toISOString();
  const id = `comment-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  db.prepare(
    `INSERT INTO community_comments (id, post_id, parent_id, user_id, author_name, body, likes_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(id, post.id, parentComment?.id || null, req.currentUser.id, getDisplayUserName(req.currentUser), body, now, now);
  updateCommunityCommentCount(post.id);
  res.status(201).json({ comment: getCommunityCommentById(id), comments: getCommunityCommentTree(post.id), post: getCommunityPostById(post.id) });
});

app.delete("/api/community/comments/:id", requireLogin, (req, res) => {
  const comment = db.prepare("SELECT * FROM community_comments WHERE id = ? AND user_id = ?").get(String(req.params.id || ""), req.currentUser.id);
  if (!comment) {
    res.status(404).json({ error: "comment_not_found", message: "삭제할 댓글을 찾지 못했습니다." });
    return;
  }

  deleteCommunityCommentThread(comment.id, req.currentUser.id);
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

app.get("/api/search-trends", async (req, res) => {
  const trends = await getSearchTrends();
  res.json(trends);
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
  res.type("html").send(renderCommunityIndexPage(req.query));
});

app.get("/community/:legacyCategory(tips|cases|operations|logistics)", (req, res) => {
  const target = LEGACY_COMMUNITY_CATEGORY_REDIRECTS[req.params.legacyCategory] || "final-margin";
  res.redirect(301, `/community/${target}`);
});

app.get("/community/resources", (req, res) => {
  res.redirect(301, "/trends");
});

app.get("/community/trends", (req, res) => {
  res.redirect(301, "/trends");
});

app.get(["/mvp", "/mvp/:variant"], (req, res) => {
  res.redirect(302, "/community");
});

app.get("/community/:category(china-sourcing|china-korea-logistics|korea-coupang-inbound|coupang-selling-cost|final-margin|qna)", (req, res) => {
  res.type("html").send(renderCommunityCategoryPage(req.params.category, req.query));
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

app.get("/u/:handle", (req, res) => {
  res.type("html").send(renderSellerditProfilePage(req.params.handle));
});

app.get(["/guides", "/guides/"], (req, res) => {
  res.type("html").send(renderGuideIndexPage());
});

app.get(["/trends", "/trends/"], async (req, res) => {
  const trends = await getSearchTrends();
  res.type("html").send(renderTrendPage(trends));
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

function communityQueryString(params = {}) {
  const parts = [];
  if (params.sort && params.sort !== "hot") parts.push(`sort=${encodeURIComponent(params.sort)}`);
  if (params.q) parts.push(`q=${encodeURIComponent(params.q)}`);
  if (params.tag) parts.push(`tag=${encodeURIComponent(params.tag)}`);
  if (params.page && Number(params.page) > 1) parts.push(`page=${Number(params.page)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

function renderCommunitySortBar(basePath, activeSort, search, tag) {
  const activeLabel = {
    hot: "인기",
    new: "최신",
    top: "추천 많은 순",
    comments: "댓글 많은 순",
    views: "조회 많은 순",
  }[activeSort] || "인기";
  const links = [
    { key: "hot", label: "인기" },
    { key: "new", label: "최신" },
    { key: "top", label: "추천" },
    { key: "comments", label: "댓글" },
    { key: "views", label: "조회" },
  ];
  return `<div class="community-toolbar sellerdit-sortbar">
    <nav class="community-sort" aria-label="정렬 기준">
      <span class="sellerdit-sort-chip">${escapeHtml(activeLabel)} ▾</span>
      <span class="sellerdit-sort-chip">전체 기간 ▾</span>
      <span class="sellerdit-sort-chip">카드 보기 ▾</span>
      <span class="sellerdit-sort-links">
        ${links
          .map((item) => {
            const href = `${basePath}${communityQueryString({ sort: item.key, q: search, tag })}`;
            return `<a class="${item.key === activeSort ? "is-active" : ""}" href="${escapeHtml(href)}">${escapeHtml(item.label)}</a>`;
          })
          .join("")}
      </span>
    </nav>
  </div>`;
}

function renderCommunityVoteCard(post, index = 0) {
  const dateLabel = formatDate(post.createdAt);
  const authorName = post.authorName || "셀러";
  return `<article class="community-vote-card sellerdit-feed-post${post.isNotice ? " is-notice" : ""}">
    <div class="sellerdit-post-meta">
      <span class="sellerdit-avatar" style="background:${escapeHtml(getCommunityAuthorColor(authorName))}">${escapeHtml(getCommunityAuthorInitial(authorName))}</span>
      <a class="sellerdit-author" href="/u/${escapeHtml(makeCommunityHandle(authorName))}">u/${escapeHtml(makeCommunityHandle(authorName))}</a>
      <span class="sellerdit-dot">·</span>
      ${dateLabel ? `<time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(dateLabel)}</time>` : ""}
      ${post.isNotice ? `<span class="community-pin-badge">공지</span>` : ""}
      <button class="sellerdit-follow" type="button">팔로우</button>
      <span class="sellerdit-more">⋯</span>
    </div>
    <a class="community-vote-title" href="/community/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a>
    <a class="sellerdit-post-excerpt" href="/community/${escapeHtml(post.slug)}">${escapeHtml(post.summary || "")}</a>
    ${renderCommunityFeedMedia(post, index)}
    <div class="community-vote-actions sellerdit-actions" aria-label="게시글 작업">
      <button type="button" class="sellerdit-action" data-community-reaction="like" data-post-slug="${escapeHtml(post.slug)}">👍 ${formatInteger(post.likesCount || 0)}</button>
      <a class="sellerdit-action" href="/community/${escapeHtml(post.slug)}#comments">💬 댓글 ${formatInteger(post.commentsCount)}</a>
      <button type="button" class="sellerdit-action">↗ 공유</button>
      <button type="button" class="sellerdit-action" data-community-reaction="bookmark" data-post-slug="${escapeHtml(post.slug)}">🔖 저장</button>
    </div>
  </article>`;
}

function renderCommunityFeedMedia(post, index = 0) {
  if (post.isNotice || post.category === "qna" || index % 4 !== 0) {
    return "";
  }
  const media = {
    "china-sourcing": ["사입 박스 사진", "사입 박스 사진"],
    "china-korea-logistics": ["LCL 화물 사진", "LCL 화물 사진"],
    "korea-coupang-inbound": ["입고 박스 사진", "입고 박스 사진"],
    "coupang-selling-cost": ["정산 화면 사진", "정산 화면 사진"],
    "final-margin": ["입고 박스 사진", "입고 박스 사진"],
  }[post.category] || ["입고 박스 사진", "입고 박스 사진"];
  return `<a class="sellerdit-post-media sellerdit-box-photo is-${escapeHtml(post.category)}" href="/community/${escapeHtml(post.slug)}" aria-label="${escapeHtml(post.title)} 미리보기">
    <span>${escapeHtml(media[0])}</span>
    <i aria-hidden="true"><b></b></i>
  </a>`;
}

function renderCommunityPostThumb(post, mode = "small") {
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];
  const className = `community-post-thumb sellerdit-thumb is-${escapeHtml(post.category)} ${mode === "large" ? "is-large" : ""}`;
  return `<div class="${className}" aria-hidden="true">
    <span>${escapeHtml(category.label)}</span>
    <strong>${escapeHtml(getCommunityThumbTitle(post.category))}</strong>
  </div>`;
}

function renderCommunityDetailMedia(post) {
  if (!post || post.category === "qna") {
    return "";
  }
  return `<div class="sellerdit-post-media sellerdit-box-photo is-detail is-${escapeHtml(post.category)}" aria-label="${escapeHtml(post.title)} 이미지">
    <span>입고 박스 사진</span>
    <i aria-hidden="true"><b></b></i>
  </div>`;
}

function getCommunityThumbTitle(categorySlug) {
  const titles = {
    "china-sourcing": "원가",
    "china-korea-logistics": "LCL",
    "korea-coupang-inbound": "입고",
    "coupang-selling-cost": "수수료",
    "final-margin": "마진",
    qna: "Q&A",
  };
  return titles[categorySlug] || "계산";
}

function renderCommunityFeed(posts, emptyText = "아직 등록된 글이 없습니다.") {
  if (!posts.length) {
    return `<div class="community-feed-empty">${escapeHtml(emptyText)}</div>`;
  }
  const items = posts
    .map((post, index) => `${index === 3 ? renderCommunityPromotedPost() : ""}${renderCommunityVoteCard(post, index)}`)
    .join("");
  return `<div class="community-vote-list sellerdit-feedpanel">${items}</div>`;
}

function renderCommunityPinned(notices) {
  if (!notices.length) {
    return "";
  }
  return `<div class="community-pinned sellerdit-notice" aria-label="공지">
    ${notices
      .map(
        (post) => `<a class="community-pinned-row" href="/community/${escapeHtml(post.slug)}">
        <span class="community-pin-badge">공지</span>
        <strong>${escapeHtml(post.title)}</strong>
        <span class="community-pinned-meta">댓글 ${formatInteger(post.commentsCount)}</span>
      </a>`,
      )
      .join("")}
  </div>`;
}

function renderCommunityLeftRail(activeKey = "community") {
  const navItems = [
    ["community", "/community", "홈"],
    ["calculator", "/", "계산기"],
    ["qna", "/community/qna", "질문"],
    ["trends", "/trends", "트렌드"],
    ["guides", "/guides", "기준"],
  ];
  return `<aside class="community-left-rail sellerdit-left-rail" aria-label="셀러딧 왼쪽 메뉴">
    <nav class="sellerdit-left-menu" aria-label="셀러딧 섹션">
      ${navItems.map(([key, href, label]) => `<a class="${key === activeKey ? "is-active" : ""}" href="${href}">${label}</a>`).join("")}
    </nav>
    <section class="sellerdit-community-info" aria-label="r/셀러딧 정보">
      <span class="sellerdit-community-icon">r/</span>
      <strong>r/셀러딧</strong>
      <p>쿠팡·로켓그로스 셀러가 원가, 물류, 수수료를 같이 검토하는 커뮤니티입니다.</p>
      <dl>
        <div><dt>멤버</dt><dd>18.4k</dd></div>
        <div><dt>온라인</dt><dd>312</dd></div>
      </dl>
    </section>
  </aside>`;
}

function renderCommunityAboutCard() {
  return renderPopularCommunitiesPanel();
}

function renderCommunityPostBridge(post, category) {
  return renderKillerContentPanel();
}

function renderCommunityRelatedPanel(posts) {
  if (!posts.length) return "";
  return `<section class="community-related-feed sellerdit-related-feed" aria-label="관련 게시글">
    <div class="community-related-feed-head">
      <strong>관련 게시글</strong>
      <span>r/셀러딧</span>
    </div>
    <div>
      ${posts
        .map(
          (post) => `<a class="community-related-item" href="/community/${escapeHtml(post.slug)}">
            <span>
              <em><i class="sellerdit-mini-avatar">r</i> r/셀러딧 · ${escapeHtml(formatDate(post.createdAt) || "")} <b>⋯</b></em>
              <strong>${escapeHtml(post.title)}</strong>
              <small>👍 ${formatInteger(post.likesCount || 0)} · 댓글 ${formatInteger(post.commentsCount)}</small>
            </span>
            ${renderCommunityPostThumb(post)}
          </a>`,
        )
        .join("")}
    </div>
  </section>`;
}

function renderCommunityPromotedPost() {
  return `<article class="community-vote-card sellerdit-feed-post sellerdit-promoted">
    <div class="sellerdit-post-meta">
      <span class="sellerdit-avatar is-ad">A</span>
      <span class="sellerdit-author">Alibaba_B2B</span>
      <span class="sellerdit-dot">·</span>
      <span class="ad-tag">홍보 광고</span>
      <span class="sellerdit-more">⋯</span>
    </div>
    <a class="community-vote-title" href="https://www.1688.com/" rel="nofollow noopener" target="_blank">1688 대량 사입 단가, 물류비까지 같이 비교해 보세요</a>
    <a class="sellerdit-post-excerpt" href="https://www.1688.com/" rel="nofollow noopener" target="_blank">상품 단가만 보지 말고 배송대행, 통관, 입고 비용까지 함께 확인하는 셀러용 체크 포인트입니다.</a>
    <div class="community-vote-actions sellerdit-actions">
      <span class="sellerdit-action">↗ 공유</span>
      <span class="sellerdit-action">⋯ 광고 정보</span>
    </div>
  </article>`;
}

function renderCommunityAdSlot(type = "square") {
  const isSquare = type === "square";
  return `<aside class="sellerdit-ad-slot ${isSquare ? "is-square" : "is-wide"}" aria-label="광고">
    <span>광고</span>
    <strong>${isSquare ? "셀러 운영 도구" : "마진 계산이 헷갈린다면?"}</strong>
    <p>${isSquare ? "정산·재고·마진을 한 화면에서 관리하세요." : "로켓그로스 계산기로 비용을 다시 확인하세요."}</p>
  </aside>`;
}

function renderPopularCommunitiesPanel() {
  const communities = [
    ["농", "r/농수산사입", "멤버 12,480명", "#2563eb"],
    ["16", "r/1688사입", "멤버 9,742명", "#1d4ed8"],
    ["로", "r/로켓그로스", "멤버 8,115명", "#3b82f6"],
    ["물", "r/LCL물류", "멤버 5,233명", "#60a5fa"],
    ["셀", "r/초보셀러", "멤버 4,901명", "#64748b"],
  ];
  return `<section class="community-about-card sellerdit-widget sellerdit-communities" aria-label="인기 커뮤니티">
    <div class="sellerdit-widget-title"><h2>인기 커뮤니티</h2><a href="/community">더 보기</a></div>
    ${communities
      .map(([initial, name, meta, color], index) => `<a class="sellerdit-community-row" href="/community">
        <b>${index + 1}</b>
        <span class="sellerdit-community-avatar" style="background:${color}">${escapeHtml(initial)}</span>
        <span class="sellerdit-community-copy"><strong>${escapeHtml(name)}</strong><em>${escapeHtml(meta)}</em></span>
        <i>가입</i>
      </a>`)
      .join("")}
  </section>`;
}

function renderCommunityPopularContentPanel() {
  const posts = getCommunityPosts({ sort: "hot", limit: 5 });
  return `<section class="sellerdit-widget sellerdit-popular-content" aria-label="실시간 인기 콘텐츠">
    <h2>실시간 인기 콘텐츠 TOP 5</h2>
    ${posts
      .map((post, index) => `<a href="/community/${escapeHtml(post.slug)}">
        <b>${index + 1}</b>
        <span>${escapeHtml(post.title)}</span>
        <em>댓글 ${formatInteger(post.commentsCount)}</em>
      </a>`)
      .join("")}
  </section>`;
}

function renderKillerContentPanel() {
  return `<section class="sellerdit-widget sellerdit-killer-content" aria-label="추천 콘텐츠">
    <h2>셀러가 많이 보는 글</h2>
    <a href="/community/rocket-growth-cost-checklist-7">로켓그로스 입고 전 꼭 확인할 비용 7가지</a>
    <a href="/community/lcl-forwarder-questions">LCL 견적 받을 때 꼭 물어볼 질문</a>
    <a href="/guides/rocket-growth-calculator">계산 기준 자세히 보기</a>
  </section>`;
}

function renderSellerditRightRail(mode = "list", relatedPosts = []) {
  if (mode === "detail") {
    return `<aside class="community-right-rail sellerdit-right-rail">
      ${renderCommunityRelatedPanel(relatedPosts)}
      ${renderPopularCommunitiesPanel()}
      ${renderSellerditFooterLinks()}
    </aside>`;
  }
  return `<aside class="community-right-rail sellerdit-right-rail">
    ${renderPopularCommunitiesPanel()}
    ${renderSellerditFooterLinks()}
  </aside>`;
}

function renderSellerditFooterLinks() {
  return `<nav class="sellerdit-footer-links" aria-label="사이트 링크">
    <a href="/">홈</a> · <a href="/community">인기</a> · <a href="/guides">계산 기준</a><br>
    <a href="/privacy">개인정보 처리방침</a> · <a href="/terms">이용약관</a><br>
    © 2026 셀러딧
  </nav>`;
}

function getCommunityAuthorInitial(name) {
  return String(name || "셀").trim().slice(0, 1) || "셀";
}

function makeCommunityHandle(name) {
  return String(name || "seller")
    .replace(/\s+/g, "")
    .replace(/[^\w가-힣]/g, "")
    .slice(0, 18) || "seller";
}

function getCommunityAuthorColor(name) {
  return getCommunityAuthorPalette(name).avatar;
}

function getCommunityAuthorPalette(name) {
  const palettes = [
    { avatar: "#2563eb", bannerA: "#1d4ed8", bannerB: "#93c5fd", soft: "#dbeafe" },
    { avatar: "#16a34a", bannerA: "#15803d", bannerB: "#86efac", soft: "#dcfce7" },
    { avatar: "#f97316", bannerA: "#c2410c", bannerB: "#fdba74", soft: "#ffedd5" },
    { avatar: "#9333ea", bannerA: "#7e22ce", bannerB: "#d8b4fe", soft: "#f3e8ff" },
    { avatar: "#db2777", bannerA: "#be185d", bannerB: "#f9a8d4", soft: "#fce7f3" },
    { avatar: "#0891b2", bannerA: "#0e7490", bannerB: "#67e8f9", soft: "#cffafe" },
    { avatar: "#ca8a04", bannerA: "#a16207", bannerB: "#fde68a", soft: "#fef3c7" },
    { avatar: "#dc2626", bannerA: "#b91c1c", bannerB: "#fca5a5", soft: "#fee2e2" },
    { avatar: "#475569", bannerA: "#334155", bannerB: "#cbd5e1", soft: "#f1f5f9" },
    { avatar: "#0f766e", bannerA: "#115e59", bannerB: "#5eead4", soft: "#ccfbf1" },
  ];
  const chars = Array.from(String(name || "seller"));
  const codes = chars.map((char) => char.charCodeAt(0));
  const primary = codes[0] || 0;
  const secondary = codes[1] || primary;
  const tertiary = codes[2] || secondary;
  const seed = ((primary >> 1) ^ (secondary >> 2) ^ ((tertiary >> 3) * 17) ^ (chars.length * 13)) >>> 0;
  return palettes[seed % palettes.length];
}

function getCommunityAuthorStyle(name) {
  const palette = getCommunityAuthorPalette(name);
  return `--sellerdit-avatar:${palette.avatar};--sellerdit-banner-a:${palette.bannerA};--sellerdit-banner-b:${palette.bannerB};--sellerdit-soft:${palette.soft}`;
}

function getCommunityCalculatorHref(categorySlug) {
  const routes = {
    "china-sourcing": "/?calc=china",
    "china-korea-logistics": "/?calc=china-korea",
    "korea-coupang-inbound": "/?calc=korea-coupang",
    "coupang-selling-cost": "/?calc=coupang",
    "final-margin": "/?calc=final",
    qna: "/",
  };
  return routes[categorySlug] || "/";
}

function getCommunityGuideHref(categorySlug) {
  const routes = {
    "china-sourcing": "/guides/china-purchase-cost",
    "china-korea-logistics": "/guides/lcl-logistics-cost",
    "korea-coupang-inbound": "/guides/coupang-pallet-cost",
    "coupang-selling-cost": "/guides/coupang-fee",
    "final-margin": "/guides/rocket-growth-calculator",
    qna: "/guides",
  };
  return routes[categorySlug] || "/guides";
}

function renderCommunityPager(basePath, page, totalPages, search, sort, tag) {
  if (totalPages <= 1) {
    return "";
  }
  const href = (target) => `${escapeHtml(basePath + communityQueryString({ sort, q: search, tag, page: target }))}`;
  const items = [];
  if (page > 1) {
    items.push(`<a class="community-pager-edge" href="${href(page - 1)}" rel="prev">이전</a>`);
  }
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  for (let target = start; target <= end; target += 1) {
    const isActive = target === page;
    items.push(`<a class="${isActive ? "is-active" : ""}" href="${href(target)}" ${isActive ? 'aria-current="page"' : ""}>${target}</a>`);
  }
  if (page < totalPages) {
    items.push(`<a class="community-pager-edge" href="${href(page + 1)}" rel="next">다음</a>`);
  }
  return `<nav class="community-pager" aria-label="페이지 이동">${items.join("")}</nav>`;
}

function renderCommunityIndexPage(query = {}) {
  const sort = COMMUNITY_SORTS[query.sort] ? String(query.sort) : "hot";
  const search = String(query.q || "").trim().slice(0, 60);
  const tag = String(query.tag || "").trim().slice(0, 40);
  const pageSize = 12;
  const feedOptions = { notice: false, sort, search, tag };
  const total = countCommunityPosts(feedOptions);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const posts = getCommunityPosts({ ...feedOptions, limit: pageSize, offset: (page - 1) * pageSize });
  const notices = !search && !tag && page === 1 ? getCommunityPosts({ notice: true, sort: "new", limit: 3 }) : [];
  const title = "쿠팡셀러 커뮤니티 | 로켓그로스 계산기";
  const description =
    "쿠팡셀러와 개인셀러를 위한 로켓그로스 5단계 커뮤니티입니다. 중국사입, 중국→한국 물류, 한국→쿠팡 입고, 쿠팡 소모 비용, 최종 비용을 단계별로 묻고 답합니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/community`;
  const heading = search ? `‘${search}’ 검색 결과` : "쿠팡셀러 비용 게시판";
  const subLabel = search ? `${formatInteger(total)}개의 글` : "셀러 커뮤니티";

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("community")}
      <section class="community-workspace community-reddit-layout sellerdit-no-left-rail">
        <section class="community-feed-panel" aria-labelledby="community-title">
          <div class="community-feed-head">
            <div>
              <span class="community-page-label">${escapeHtml(subLabel)}</span>
              <h1 id="community-title">${escapeHtml(heading)}</h1>
            </div>
            <div class="community-head-actions">
              <a class="community-head-action is-muted" href="/">계산기</a>
              <a class="community-head-action" href="#community-write">글쓰기</a>
            </div>
          </div>
          ${renderCommunitySortBar("/community", sort, search, tag)}
          ${renderCommunityPinned(notices)}
          ${renderCommunityFeed(posts, search ? "검색 결과가 없습니다. 다른 키워드로 찾아보세요." : "아직 등록된 글이 없습니다.")}
          ${renderCommunityPager("/community", page, totalPages, search, sort, tag)}
          <div id="community-write" class="sellerdit-write-anchor">${renderCommunityWritePanel()}</div>
        </section>
        ${renderSellerditRightRail("list")}
      </section>
    </main>`,
    jsonLd: buildCommunityIndexJsonLd(title, description, canonicalUrl, posts.length ? posts : popularPosts),
    script: renderCommunityScript(),
  });
}

function renderCommunityAiAnswerPage(query = {}) {
  const search = String(query.q || "").trim().slice(0, 80);
  const qnaPosts = getCommunityPosts({ category: "qna", notice: false, sort: "hot", limit: 8 });
  const title = "셀러딧 AI 답변 | 로켓그로스 계산기";
  const description = "쿠팡셀러와 개인셀러의 로켓그로스 비용, 사입, 물류, 수수료 질문을 AI 답변형으로 정리하는 셀러딧 질문답변 화면입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/qna`;
  const answerTitle = search || "터미널 운송료는 무슨 비용인가요?";
  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("qna")}
      <section class="community-workspace community-reddit-layout sellerdit-ai-layout sellerdit-no-side-rail">
        <section class="community-feed-panel sellerdit-ai-main" aria-labelledby="sellerdit-ai-title">
          <div class="sellerdit-ai-hero">
            <div class="sellerdit-ai-orbit" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <div>
              <span class="community-page-label">질문답변</span>
              <h1 id="sellerdit-ai-title">셀러 질문을 계산 기준으로 바로 정리합니다.</h1>
              <p>로켓그로스 비용, LCL, 쿠팡 수수료처럼 헷갈리는 항목을 짧게 물어보세요.</p>
            </div>
          </div>
          <form class="sellerdit-ai-search" method="get" action="/community/qna" role="search">
            <input type="search" name="q" value="${escapeHtml(search)}" placeholder="예: 원산지증명서가 있으면 관세가 0원인가요?" />
            <button type="submit">답변 보기</button>
          </form>
          <article class="sellerdit-ai-answer">
            <div class="sellerdit-post-meta">
              <span class="sellerdit-avatar">AI</span>
              <span class="sellerdit-author">셀러딧 AI</span>
              <span class="sellerdit-dot">·</span>
              <span>계산 기준 답변</span>
            </div>
            <h2>${escapeHtml(answerTitle)}</h2>
            <p>비용 항목은 실제 청구서 기준으로 나눠 봐야 합니다. 운임, 통관, 국내 운송, 쿠팡 수수료를 한 번에 섞으면 어디에서 마진이 줄어드는지 확인하기 어렵습니다.</p>
            <ul>
              <li>사입 원가는 제품단가, 수량, 환율을 먼저 맞춥니다.</li>
              <li>물류비는 CBM, 중량, 통관, 국내 입고비를 분리합니다.</li>
              <li>최종 판매가는 쿠팡 수수료와 광고비까지 뺀 뒤 판단합니다.</li>
            </ul>
            <a class="sellerdit-inline-cta" href="/">로켓그로스 계산기로 확인</a>
          </article>
          <section class="sellerdit-qna-list">
            <h2>최근 셀러 질문</h2>
            ${qnaPosts.map(renderCommunityVoteCard).join("")}
          </section>
        </section>
      </section>
    </main>`,
    jsonLd: buildCommunityCategoryJsonLd(COMMUNITY_CATEGORIES.qna, canonicalUrl, qnaPosts),
    script: renderCommunityScript(),
  });
}

function renderCommunityCategoryPage(categorySlug, query = {}) {
  if (categorySlug === "qna") {
    return renderCommunityAiAnswerPage(query);
  }
  const category = COMMUNITY_CATEGORIES[categorySlug] || COMMUNITY_CATEGORIES["final-margin"];
  const basePath = `/community/${category.slug}`;
  const sort = COMMUNITY_SORTS[query.sort] ? String(query.sort) : "hot";
  const search = String(query.q || "").trim().slice(0, 60);
  const pageSize = 12;
  const feedOptions = { category: category.slug, notice: false, sort, search };
  const total = countCommunityPosts(feedOptions);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const posts = getCommunityPosts({ ...feedOptions, limit: pageSize, offset: (page - 1) * pageSize });
  const notices =
    !search && page === 1 ? getCommunityPosts({ category: category.slug, notice: true, sort: "new", limit: 3 }) : [];
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/${category.slug}`;
  const heading = search ? `‘${search}’ 검색 결과` : category.title;
  const subLabel = search ? `${category.label} · ${formatInteger(total)}개` : category.label;

  return renderDocumentShell({
    title: `${category.title} | 로켓그로스 계산기 커뮤니티`,
    description: category.description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader(category.slug)}
      <section class="community-workspace community-reddit-layout">
        ${renderCommunityLeftRail(category.slug)}
        <section class="community-feed-panel" aria-labelledby="community-category-title">
          <div class="community-feed-head">
            <div>
              <span class="community-page-label">${escapeHtml(subLabel)}</span>
              <h1 id="community-category-title">${escapeHtml(heading)}</h1>
            </div>
            <div class="community-head-actions">
              <a class="community-head-action is-muted" href="${escapeHtml(getCommunityCalculatorHref(category.slug))}">계산기</a>
              <a class="community-head-action" href="#community-write">글쓰기</a>
            </div>
          </div>
          ${renderCommunitySortBar(basePath, sort, search, "")}
          ${renderCommunityPinned(notices)}
          ${renderCommunityFeed(posts, search ? "검색 결과가 없습니다. 다른 키워드로 찾아보세요." : "이 게시판에는 아직 글이 없습니다.")}
          ${renderCommunityPager(basePath, page, totalPages, search, sort, "")}
          <div id="community-write" class="sellerdit-write-anchor">${renderCommunityWritePanel(category.slug)}</div>
        </section>
        ${renderSellerditRightRail("list")}
      </section>
    </main>`,
    jsonLd: buildCommunityCategoryJsonLd(category, canonicalUrl, posts),
    script: renderCommunityScript(),
  });
}

function renderCommunityPostPage(post) {
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/${post.slug}`;
  const comments = getCommunityCommentTree(post.id);
  const displayComments = comments.length ? comments : getSampleCommunityComments(post);
  const commentCount = comments.length ? countRenderedComments(comments) : countRenderedComments(displayComments);
  const relatedPosts = getCommunityPosts({ category: post.category, limit: 5 }).filter((item) => item.id !== post.id).slice(0, 4);
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];

  return renderDocumentShell({
    title: `${post.title} | 로켓그로스 계산기 커뮤니티`,
    description: post.summary,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader(post.category)}
      <section class="community-workspace community-reddit-layout is-post-detail">
        ${renderCommunityLeftRail(post.category)}
        <section class="community-detail-main">
          <article class="community-post-article sellerdit-detail-post" data-community-post="${escapeHtml(post.slug)}">
            <div class="sellerdit-post-meta">
              <span class="sellerdit-avatar" style="background:${escapeHtml(getCommunityAuthorColor(post.authorName))}">${escapeHtml(getCommunityAuthorInitial(post.authorName))}</span>
              <a class="sellerdit-author" href="/u/${escapeHtml(makeCommunityHandle(post.authorName))}">u/${escapeHtml(makeCommunityHandle(post.authorName))}</a>
              <span class="sellerdit-dot">·</span>
              <time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(formatDate(post.createdAt) || "")}</time>
              <span class="sellerdit-dot">·</span>
              <span>조회 ${formatInteger(post.views)}</span>
              <button class="sellerdit-follow" type="button">팔로우</button>
              <span class="sellerdit-more">⋯</span>
            </div>
            <h1>${escapeHtml(post.title)}</h1>
            <div class="sellerdit-detail-body">
              <p>${escapeHtml(post.summary)}</p>
              ${post.sections
                .map(
                  (section) => `${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ""}
                    ${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}`,
                )
                .join("")}
            </div>
            ${renderCommunityDetailMedia(post)}
            <div class="community-vote-actions sellerdit-actions sellerdit-detail-actions" aria-label="게시글 작업">
              <button type="button" class="sellerdit-action" data-community-reaction="like" data-post-slug="${escapeHtml(post.slug)}">👍 ${formatInteger(post.likesCount || 0)}</button>
              <a class="sellerdit-action" href="#comments">💬 댓글 ${formatInteger(commentCount)}</a>
              <button type="button" class="sellerdit-action">↗ 공유</button>
              <button type="button" class="sellerdit-action" data-community-reaction="bookmark" data-post-slug="${escapeHtml(post.slug)}">🔖 저장</button>
            </div>
          </article>
          ${renderCommunityAdSlot("wide")}
          <section class="community-comments sellerdit-comments" id="comments" aria-labelledby="community-comments-title">
            <header class="community-comments-head sellerdit-comments-toolbar">
              <div>
                <strong id="community-comments-title">댓글 ${formatInteger(commentCount)}개</strong>
                <span>대화에 참여해 셀러 비용 기준을 함께 확인하세요.</span>
              </div>
              <button class="sellerdit-comment-sort" type="button">정렬: 좋아요 비율 높은 순 ▾</button>
              <label class="sellerdit-comment-search"><span>🔍</span><input type="search" placeholder="댓글 검색" aria-label="댓글 검색" /></label>
            </header>
            <form class="community-comment-form sellerdit-composer" data-community-comment-form data-post-slug="${escapeHtml(post.slug)}">
              <div class="sellerdit-composer-head">
                <span class="sellerdit-avatar is-muted">?</span>
                <strong>댓글 작성</strong>
                <a class="community-comment-login" href="/auth/kakao/start?returnTo=${encodeURIComponent(`/community/${post.slug}#comments`)}">카카오로 시작하기</a>
              </div>
              <textarea name="body" rows="3" maxlength="1500" placeholder="이 게시글에 대한 생각을 남겨보세요"></textarea>
              <div class="sellerdit-composer-actions">
                <p data-community-message></p>
                <button class="primary-small-button" type="submit">댓글 남기기</button>
              </div>
            </form>
            ${renderCommunityCommentTopAd()}
            <div class="community-comment-list sellerdit-comment-tree">
              ${renderSellerditComments(displayComments, post)}
            </div>
          </section>
        </section>
        ${renderSellerditRightRail("detail", relatedPosts)}
      </section>
    </main>`,
    jsonLd: buildCommunityPostJsonLd(post, canonicalUrl, comments),
    script: renderCommunityScript(post.slug),
  });
}

function getSampleCommunityComments(post) {
  const now = Date.now();
  const author = post.authorName || "글쓴이";
  return [
    {
      id: "sample-comment-1",
      authorName: "마진체크러",
      body: "사입가만 보면 안 되고, 쿠팡 수수료와 입고 작업비까지 한 번에 빼서 봐야 합니다. 특히 판매가 2만원 이하 상품은 500원 차이도 마진에 크게 들어옵니다.",
      createdAt: new Date(now - 1000 * 60 * 44).toISOString(),
      likesCount: 38,
      badge: "상위 1% 댓글 작성자",
      replies: [
        {
          id: "sample-reply-1",
          authorName: author,
          body: "맞습니다. 그래서 본문 기준도 비용을 하나로 뭉치지 않고 단계별로 나눠 보는 쪽으로 잡았습니다.",
          createdAt: new Date(now - 1000 * 60 * 31).toISOString(),
          likesCount: 14,
          badge: "원글 작성자",
          replies: [],
        },
      ],
    },
    {
      id: "sample-comment-2",
      authorName: "초보셀러민수",
      body: "저는 처음에 광고비를 월 비용으로만 봤는데, 주문당 비용으로 나누니까 실제 남는 돈이 훨씬 잘 보였습니다.",
      createdAt: new Date(now - 1000 * 60 * 24).toISOString(),
      likesCount: 21,
      badge: "",
      replies: [],
    },
    {
      id: "sample-comment-3",
      authorName: "물류검수팀",
      body: "LCL이면 CBM, 통관, 국내 운송비가 따로 붙을 수 있습니다. 견적서 항목을 그대로 계산기에 옮겨 넣는 방식이 가장 안전합니다.",
      createdAt: new Date(now - 1000 * 60 * 12).toISOString(),
      likesCount: 17,
      badge: "상위 1% 댓글 작성자",
      replies: [
        {
          id: "sample-reply-2",
          authorName: "첫사입준비중",
          body: "그럼 포워더 견적 받을 때 국내 운송비 포함 여부부터 물어보면 되겠네요.",
          createdAt: new Date(now - 1000 * 60 * 8).toISOString(),
          likesCount: 5,
          badge: "",
          replies: [],
        },
      ],
    },
  ];
}

function countRenderedComments(comments) {
  return comments.reduce((sum, comment) => sum + 1 + countRenderedComments(comment.replies || []), 0);
}

function renderCommunityCommentTopAd() {
  return `<aside class="sellerdit-comment-ad is-top" aria-label="홍보 광고">
    <div><span>홍보 광고</span><strong>마진 계산 전, 비용 누락부터 확인하세요</strong></div>
    <a href="/">더 알아보기</a>
  </aside>`;
}

function renderCommunityCommentInlineAd() {
  return `<aside class="sellerdit-comment-ad is-inline" aria-label="홍보 광고">
    <div><span>광고</span><strong>셀러 비용 체크리스트</strong></div>
    <a href="/guides">보기</a>
  </aside>`;
}

function renderSellerditComments(comments, post, depth = 0) {
  if (!comments.length) {
    return `<p class="community-empty">아직 댓글이 없습니다. 첫 질문을 남겨보세요.</p>`;
  }
  return comments.map((comment, index) => `${depth === 0 && index === 2 ? renderCommunityCommentInlineAd() : ""}${renderSellerditComment(comment, post, depth, index)}`).join("");
}

function renderSellerditComment(comment, post, depth = 0, index = 0) {
  const authorName = comment.authorName || "셀러";
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  const isAuthor = makeCommunityHandle(authorName) === makeCommunityHandle(post.authorName);
  const badge = comment.badge || (isAuthor ? "원글 작성자" : "");
  const handle = makeCommunityHandle(authorName);
  return `<article class="sellerdit-comment ${depth > 0 ? "is-reply" : ""}" style="--comment-depth:${depth}" data-comment-id="${escapeHtml(comment.id || "")}">
    <button class="sellerdit-thread-toggle" type="button" aria-label="댓글 접기"></button>
    <span class="sellerdit-avatar" style="background:${escapeHtml(getCommunityAuthorColor(authorName))}">${escapeHtml(getCommunityAuthorInitial(authorName))}</span>
    <div class="sellerdit-comment-body">
      <header>
        <a class="sellerdit-author" href="/u/${escapeHtml(handle)}">u/${escapeHtml(handle)}</a>
        ${badge ? `<span class="sellerdit-comment-badge ${isAuthor || badge === "원글 작성자" ? "is-author" : ""}">${escapeHtml(badge)}</span>` : ""}
        <time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDate(comment.createdAt) || "방금 전")}</time>
      </header>
      <p>${escapeHtml(comment.body)}</p>
      <footer>
        <button type="button" class="sellerdit-comment-action">추천 ${formatInteger(comment.likesCount || 0)}</button>
        <button type="button" class="sellerdit-comment-action" data-comment-reply-button data-parent-id="${escapeHtml(comment.id || "")}">답글</button>
        <button type="button" class="sellerdit-comment-action">공유</button>
        <button type="button" class="sellerdit-comment-action">⋯</button>
      </footer>
      <form class="community-comment-form sellerdit-reply-form" data-community-comment-form data-post-slug="${escapeHtml(post.slug)}" data-parent-id="${escapeHtml(comment.id || "")}" hidden>
        <textarea name="body" rows="2" maxlength="1500" placeholder="u/${escapeHtml(handle)}님에게 답글 남기기"></textarea>
        <div class="sellerdit-reply-actions">
          <p data-community-message></p>
          <button type="button" data-comment-reply-cancel>취소</button>
          <button class="primary-small-button" type="submit">답글 등록</button>
        </div>
      </form>
      ${replies.length ? `<div class="sellerdit-replies">${renderSellerditComments(replies, post, depth + 1)}</div>` : ""}
    </div>
  </article>`;
}
function renderSellerditProfilePage(handle) {
  const normalizedHandle = makeCommunityHandle(handle || "seller");
  const posts = getCommunityPosts({ limit: 100, sort: "new" }).filter((post) => makeCommunityHandle(post.authorName) === normalizedHandle);
  const displayName = posts[0]?.authorName || normalizedHandle;
  const likes = posts.reduce((sum, post) => sum + Number(post.likesCount || 0), 0);
  const comments = posts.reduce((sum, post) => sum + Number(post.commentsCount || 0), 0);
  const title = `u/${normalizedHandle} | 셀러딧 프로필`;
  const description = `셀러딧 사용자 u/${normalizedHandle}의 게시물과 활동 요약입니다.`;
  const canonicalUrl = `${PUBLIC_SITE_URL}/u/${encodeURIComponent(normalizedHandle)}`;

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("community")}
      <section class="community-workspace community-reddit-layout sellerdit-profile-layout">
        ${renderCommunityLeftRail("community")}
        <section class="community-feed-panel sellerdit-profile-main" aria-labelledby="sellerdit-profile-title">
          <header class="sellerdit-profile-header" style="${escapeHtml(getCommunityAuthorStyle(displayName))}">
            <span class="sellerdit-profile-avatar" style="background:${escapeHtml(getCommunityAuthorColor(displayName))}">${escapeHtml(getCommunityAuthorInitial(displayName))}</span>
            <div>
              <h1 id="sellerdit-profile-title">u/${escapeHtml(normalizedHandle)}</h1>
              <p>${escapeHtml(displayName)} · 케이크데이 2026년 6월 22일</p>
              <dl>
                <div><dt>받은 좋아요</dt><dd>${formatInteger(likes)}</dd></div>
                <div><dt>게시물</dt><dd>${formatInteger(posts.length)}</dd></div>
                <div><dt>댓글 카르마</dt><dd>${formatInteger(comments)}</dd></div>
              </dl>
            </div>
            <button class="sellerdit-follow" type="button">팔로우</button>
            <span class="sellerdit-more">⋯</span>
          </header>
          <nav class="sellerdit-profile-tabs" aria-label="프로필 탭">
            <a class="is-active" href="/u/${escapeHtml(normalizedHandle)}">개요</a>
            <a href="/u/${escapeHtml(normalizedHandle)}?tab=posts">게시물</a>
            <a href="/u/${escapeHtml(normalizedHandle)}?tab=comments">댓글</a>
          </nav>
          ${renderCommunityFeed(posts, "아직 공개된 게시물이 없습니다.")}
        </section>
        <aside class="community-right-rail sellerdit-right-rail sellerdit-profile-side">
          <section class="sellerdit-profile-card" style="${escapeHtml(getCommunityAuthorStyle(displayName))}">
            <span class="sellerdit-profile-avatar is-small" style="background:${escapeHtml(getCommunityAuthorColor(displayName))}">${escapeHtml(getCommunityAuthorInitial(displayName))}</span>
            <strong>u/${escapeHtml(normalizedHandle)}</strong>
            <p>🍰 2026년 6월 22일 가입 · 카르마 ${formatInteger(likes + comments)}</p>
            <a href="/community">r/셀러딧으로 돌아가기</a>
          </section>
          ${renderSellerditFooterLinks()}
        </aside>
      </section>
    </main>`,
    jsonLd: null,
    script: renderCommunityScript(),
  });
}

function renderCommunityHeader(activeKey) {
  const navItems = [
    { key: "calculator", label: "로켓계산기", href: "/" },
    { key: "trends", label: "검색 트렌드", href: "/trends" },
    { key: "community", label: "셀러 커뮤니티", href: "/community" },
    { key: "qna", label: "질문답변", href: "/community/qna" },
    { key: "guides", label: "계산 기준", href: "/guides" },
  ];

  return `<header class="community-topbar sellerdit-topbar">
    <div class="sellerdit-topbar-inner">
    <a class="community-brand" href="/community"><span>r/</span> 셀러딧</a>
    <form class="community-global-search" method="get" action="/community" role="search">
      <input type="search" name="q" placeholder="커뮤니티 검색" aria-label="커뮤니티 전체 검색" />
    </form>
    <nav aria-label="커뮤니티 메뉴">
      ${navItems
        .map((item) => {
          const isCommunityCategory = activeKey === "community" || COMMUNITY_STAGE_SLUGS.includes(activeKey);
          const isActive = item.key === activeKey || (item.key === "community" && isCommunityCategory);
          return `<a class="${isActive ? "is-active" : ""}" href="${item.href}">${escapeHtml(item.label)}</a>`;
        })
        .join("")}
    </nav>
    <a class="sellerdit-kakao" href="/auth/kakao/start" data-auth-button>카카오 로그인</a>
    <button class="sellerdit-logout" type="button" data-auth-logout hidden>로그아웃</button>
    <span class="sellerdit-header-dots">⋯</span>
    </div>
  </header>`;
}

function renderCommunityCategoryNav(activeKey = "community", mode = "default") {
  const isRail = mode === "rail";
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

  return `<section class="community-category-nav ${mode === "compact" ? "is-compact" : ""} ${isRail ? "is-rail" : ""}" aria-labelledby="community-category-title">
    <div class="community-category-nav-head">
      <div>
        <span>카테고리</span>
        <h2 id="community-category-title">${isRail ? "5단계" : "계산기와 같은 5단계"}</h2>
      </div>
      ${isRail ? "" : "<p>중국사입부터 최종 비용까지 계산기 순서 그대로 나눴습니다.</p>"}
    </div>
    <div class="community-category-tabs" role="list">
      ${items
        .map((item) => {
          const isActive = item.slug === activeKey || (activeKey === "community" && item.slug === "community");
          return `<a class="community-category-chip ${isActive ? "is-active" : ""}" href="${item.href}" ${isActive ? 'aria-current="page"' : ""} role="listitem">
            ${isRail ? "" : `<span>${escapeHtml(item.label)}</span>`}
            <strong>${escapeHtml(isRail ? item.label : item.title)}</strong>
            ${isRail ? "" : `<small>${escapeHtml(item.description)}</small>`}
            <em>${formatInteger(item.count)}개</em>
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
      <span>보드</span>
      <h2 id="community-board-title">질문답변</h2>
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
  return `<section class="community-stat-card is-compact" aria-label="커뮤니티 현황">
    <strong>현황</strong>
    <p>전체 ${formatInteger(total)} · 질문 ${formatInteger(counts.qna || 0)}</p>
  </section>`;
}

function renderCommunityPostSection(title, posts, mode = "default") {
  return `<section class="community-post-section ${mode === "compact" ? "is-compact" : ""}">
    <div class="community-section-head">
      <h2>${escapeHtml(title)}</h2>
      <span>${formatInteger(posts.length)}개</span>
    </div>
    <div class="community-post-list">
      ${posts.length ? posts.map((post) => renderCommunityPostCard(post, mode)).join("") : `<p class="community-empty">아직 공개된 글이 없습니다.</p>`}
    </div>
  </section>`;
}

function renderCommunityCollapsedPostPanel(title, posts) {
  return `<details class="community-collapsible-panel">
    <summary>
      <strong>${escapeHtml(title)}</strong>
      <span>${formatInteger(posts.length)}개</span>
    </summary>
    <div class="community-post-list">
      ${posts.length ? posts.map((post) => renderCommunityPostCard(post, "compact")).join("") : `<p class="community-empty">아직 공개된 글이 없습니다.</p>`}
    </div>
  </details>`;
}

function renderCommunityPostCard(post, mode = "default") {
  const isCompact = mode === "compact";
  const dateLabel = formatDate(post.createdAt);
  return `<a class="community-post-card ${isCompact ? "is-compact" : ""}" href="/community/${post.slug}">
    <div class="community-post-main">
      <strong class="community-post-title">${escapeHtml(post.title)}</strong>
      <div class="community-post-meta">
        <span>댓글 ${formatInteger(post.commentsCount)} · 조회 ${formatInteger(post.views)}</span>
        ${dateLabel ? `<time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(dateLabel)}</time>` : ""}
      </div>
    </div>
  </a>`;
}

function renderCommunityWritePanel(defaultCategory = "final-margin") {
  const stageOptions = COMMUNITY_STAGE_SLUGS.map((slug) => COMMUNITY_CATEGORIES[slug]);
  const boardOptions = COMMUNITY_BOARD_SLUGS.map((slug) => COMMUNITY_CATEGORIES[slug]);

  return `<details class="community-write-panel" aria-labelledby="community-write-title">
    <summary>
      <span>글쓰기</span>
      <strong id="community-write-title">질문 남기기</strong>
    </summary>
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
  </details>`;
}

function renderCommunityTagPanel() {
  const tags = ["로켓그로스", "중국사입", "LCL", "쿠팡수수료", "파레트", "광고", "세금", "초보셀러"];
  return `<details class="community-tag-panel community-collapsible-panel">
    <summary>
      <strong>태그</strong>
      <span>${formatInteger(tags.length)}개</span>
    </summary>
    <div>${tags.map((tag) => `<a href="/community?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>
  </details>`;
}

function renderTrendMiniPanel() {
  return `<section class="community-trend-mini" aria-labelledby="community-trend-mini-title">
    <div>
      <span>검색어 순위</span>
      <strong id="community-trend-mini-title">Google · Naver · Daum</strong>
    </div>
    <p>플랫폼별 검색 흐름을 한곳에서 확인합니다.</p>
    <a href="/trends">트렌드 보기</a>
  </section>`;
}

function renderTrendPage(trends) {
  const title = "셀러 검색어 순위 | 로켓그로스 계산기";
  const description =
    "Google Trends, 네이버 데이터랩, Daum 검색 흐름을 10분 캐시 기준으로 확인하는 셀러용 검색어 순위 화면입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/trends`;

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("trends")}
      <section class="trend-page" aria-labelledby="trend-page-title">
        <div class="trend-page-head">
          <div>
            <span class="community-page-label">검색어 순위</span>
            <h1 id="trend-page-title">셀러 검색어 흐름</h1>
          </div>
          <p>10분 캐시로 갱신합니다.</p>
        </div>
        <div class="trend-provider-grid" data-trend-grid>
          ${trends.providers.map(renderTrendProviderCard).join("")}
        </div>
        <section class="trend-note-panel">
          <strong>운영 기준</strong>
          <p>구글은 트렌딩 RSS, 네이버는 데이터랩 관심도, Daum은 검색 결과량 기준으로 표시합니다. 플랫폼 정책에 따라 표시 방식은 달라질 수 있습니다.</p>
        </section>
      </section>
    </main>`,
    jsonLd: buildTrendPageJsonLd(title, description, canonicalUrl, trends),
    script: renderTrendScript(),
  });
}

function renderTrendProviderCard(provider) {
  const statusLabel = formatTrendBaseTime(provider.updatedAt);
  const items = provider.items.slice(0, 10);
  return `<article class="trend-provider-card" data-trend-provider="${escapeHtml(provider.key)}">
    <header>
      <div>
        <span class="trend-base-time"><i aria-hidden="true"></i>${escapeHtml(statusLabel)}</span>
        <h2>${escapeHtml(provider.label)}</h2>
      </div>
    </header>
    ${
      items.length
        ? `<ol class="trend-keyword-list">
            ${items
              .map((item, index) => {
                const rank = index + 1;
                const itemUrl = item.url || buildTrendSearchUrl(provider.key, item.title);
                const rankClass = rank <= 3 ? ` class="is-top-rank is-rank-${rank}"` : "";
                return `<li${rankClass}>
                  <b>${rank}</b>
                  ${itemUrl ? `<a href="${escapeHtml(itemUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(item.title)}</a>` : `<span>${escapeHtml(item.title)}</span>`}
                  ${item.traffic ? `<em>${escapeHtml(item.traffic)}</em>` : ""}
                </li>`;
              })
              .join("")}
          </ol>`
        : `<p class="trend-provider-empty">${escapeHtml(provider.message || "표시할 검색어가 없습니다.")}</p>`
    }
  </article>`;
}

function renderTrendScript() {
  return `<script>
    (function () {
      var grid = document.querySelector("[data-trend-grid]");
      if (!grid) return;
      function escapeText(value) {
        return String(value || "").replace(/[&<>"']/g, function (char) {
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
        });
      }
      function trendBaseTime(value) {
        if (!value) return "기준시간 대기";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return "기준시간 대기";
        return "기준시간 " + date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
      }
      function trendSearchUrl(providerKey, title) {
        var query = encodeURIComponent(title || "");
        if (!query) return "";
        if (providerKey === "naver") return "https://search.naver.com/search.naver?query=" + query;
        if (providerKey === "daum") return "https://search.daum.net/search?w=tot&q=" + query;
        return "https://www.google.com/search?q=" + query;
      }
      function renderProvider(provider) {
        var status = trendBaseTime(provider.updatedAt);
        var list = (provider.items || []).slice(0, 10);
        return '<article class="trend-provider-card" data-trend-provider="' + escapeText(provider.key) + '">' +
          '<header><div><span class="trend-base-time"><i aria-hidden="true"></i>' + escapeText(status) + '</span><h2>' + escapeText(provider.label) + '</h2></div></header>' +
          (list.length
            ? '<ol class="trend-keyword-list">' + list.map(function (item, index) {
                var rank = index + 1;
                var itemUrl = item.url || trendSearchUrl(provider.key, item.title);
                var rankClass = rank <= 3 ? ' class="is-top-rank is-rank-' + rank + '"' : "";
                return '<li' + rankClass + '><b>' + rank + '</b>' +
                  (itemUrl ? '<a href="' + escapeText(itemUrl) + '" rel="nofollow noopener" target="_blank">' + escapeText(item.title) + '</a>' : '<span>' + escapeText(item.title) + '</span>') +
                  (item.traffic ? '<em>' + escapeText(item.traffic) + '</em>' : '') + '</li>';
              }).join("") + '</ol>'
            : '<p class="trend-provider-empty">' + escapeText(provider.message || "표시할 검색어가 없습니다.") + '</p>') +
          '</article>';
      }
      async function refreshTrends() {
        try {
          var response = await fetch("/api/search-trends", { headers: { "Accept": "application/json" } });
          if (!response.ok) return;
          var data = await response.json();
          grid.classList.add("is-refreshing");
          grid.innerHTML = (data.providers || []).map(renderProvider).join("");
          window.setTimeout(function () { grid.classList.remove("is-refreshing"); }, 700);
          if (typeof gtag === "function") gtag("event", "trend_refresh", { providers: (data.providers || []).length });
        } catch (error) {
          // Keep the server-rendered list if refresh fails.
        }
      }
      window.setInterval(refreshTrends, 600000);
    })();
  </script>`;
}

function formatTrendBaseTime(value) {
  if (!value) return "기준시간 대기";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "기준시간 대기";
  return `기준시간 ${new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date)}`;
}

function buildTrendSearchUrl(providerKey, title) {
  const query = encodeURIComponent(String(title || "").trim());
  if (!query) return "";
  if (providerKey === "naver") return `https://search.naver.com/search.naver?query=${query}`;
  if (providerKey === "daum") return `https://search.daum.net/search?w=tot&q=${query}`;
  return `https://www.google.com/search?q=${query}`;
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

      function loginUrl() {
        return "/auth/kakao/start?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      }

      async function refreshCommunityAuth() {
        var loginButton = document.querySelector("[data-auth-button]");
        var logoutButton = document.querySelector("[data-auth-logout]");
        try {
          var response = await fetch("/api/me", { credentials: "same-origin" });
          var data = await response.json();
          if (!loginButton) return;
          if (data.accountFeatureEnabled === false) {
            loginButton.hidden = true;
            logoutButton && (logoutButton.hidden = true);
            return;
          }
          if (!data.kakaoConfigured) {
            loginButton.textContent = "카카오 설정 필요";
            loginButton.href = "/auth/kakao/start";
            logoutButton && (logoutButton.hidden = true);
            return;
          }
          if (data.authenticated && data.user) {
            var name = data.user.nickname || "셀러";
            loginButton.textContent = name + "님";
            loginButton.href = "/u/" + encodeURIComponent(data.user.handle || name);
            logoutButton && (logoutButton.hidden = false);
          } else {
            loginButton.textContent = "카카오 로그인";
            loginButton.href = loginUrl();
            logoutButton && (logoutButton.hidden = true);
          }
        } catch (error) {
          if (loginButton) loginButton.href = loginUrl();
        }
      }

      document.querySelector("[data-auth-button]")?.addEventListener("click", function (event) {
        if (this.getAttribute("href") === "/auth/kakao/start") {
          this.setAttribute("href", loginUrl());
        }
      });

      document.querySelector("[data-auth-logout]")?.addEventListener("click", async function () {
        await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
        window.location.href = window.location.pathname + "?logout=success";
      });

      document.querySelectorAll("[data-comment-reply-button]").forEach(function (button) {
        button.addEventListener("click", function () {
          var comment = button.closest("[data-comment-id]");
          var form = comment && comment.querySelector(".sellerdit-reply-form");
          if (!form) return;
          form.hidden = !form.hidden;
          if (!form.hidden) {
            var textarea = form.querySelector("textarea");
            textarea && textarea.focus();
          }
        });
      });

      document.querySelectorAll("[data-comment-reply-cancel]").forEach(function (button) {
        button.addEventListener("click", function () {
          var form = button.closest(".sellerdit-reply-form");
          if (form) form.hidden = true;
        });
      });

      refreshCommunityAuth();

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
              window.location.href = loginUrl();
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
              body: JSON.stringify({ slug: form.dataset.postSlug, body: textarea.value, parentId: form.dataset.parentId || "" })
            });
            var result = await response.json().catch(function () { return {}; });
            if (response.status === 401) {
              window.location.href = loginUrl();
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
              window.location.href = loginUrl();
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
  const title = "로켓그로스 계산 기준";
  const description =
    "로켓그로스 계산기, LCL 물류비, 수입 부가세, 쿠팡 파레트 비용, 쿠팡 판매 수수료처럼 초보 셀러가 헷갈리는 계산 기준을 문서로 정리한 지식 허브입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/guides`;
  const guideCard = (guide) => `<a class="guide-library-card" href="/guides/${guide.slug}">
        <strong>${escapeHtml(guide.title)}</strong>
        <em>보기</em>
      </a>`;
  const primaryGuides = SEO_GUIDES.slice(0, 5).map(guideCard).join("");
  const secondaryGuides = SEO_GUIDES.slice(5).map(guideCard).join("");
  const guideLinks = `${primaryGuides}${
    secondaryGuides
      ? `<details class="guide-more-panel">
          <summary><strong>나머지 문서</strong><span>${formatInteger(SEO_GUIDES.length - 5)}개</span></summary>
          <div>${secondaryGuides}</div>
        </details>`
      : ""
  }`;

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("guides")}
      <section class="community-forum-shell">
        <section class="community-feed-panel" aria-labelledby="guide-library-title">
          <div class="community-feed-head">
            <div>
              <span class="community-page-label">계산 기준</span>
              <h1 id="guide-library-title">셀러 비용 계산 기준</h1>
            </div>
            <a class="community-head-action" href="/">로켓계산기</a>
          </div>
          <section class="community-post-section guide-resource-section">
            <div class="community-section-head">
              <h2>문서 목록</h2>
              <span>${formatInteger(SEO_GUIDES.length)}개</span>
            </div>
            <div class="guide-library-grid">${guideLinks}</div>
          </section>
        </section>
        <aside class="community-right-rail">
          <section class="community-stat-card is-compact" aria-label="계산 기준 현황">
            <strong>계산 기준</strong>
            <p>문서 ${formatInteger(SEO_GUIDES.length)} · FAQ ${formatInteger(SEO_GUIDES.reduce((sum, guide) => sum + guide.faq.length, 0))}</p>
          </section>
          ${renderTrendMiniPanel()}
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

function buildTrendPageJsonLd(title, description, canonicalUrl, trends) {
  const items = trends.providers
    .flatMap((provider) => provider.items.map((item) => ({ provider: provider.label, ...item })))
    .slice(0, 30);

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
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#items`,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: `${item.provider}: ${item.title}`,
          url: item.url || canonicalUrl,
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

async function getSearchTrends() {
  const now = Date.now();
  if (searchTrendCache.data && searchTrendCache.expiresAt > now) {
    return searchTrendCache.data;
  }

  const providers = await Promise.all([
    fetchGoogleSearchTrends(),
    fetchNaverDatalabTrends(),
    fetchDaumSearchInterest(),
  ]);
  const data = {
    updatedAt: new Date().toISOString(),
    cacheTtlSeconds: Math.round(SEARCH_TREND_CACHE_TTL_MS / 1000),
    providers,
  };

  searchTrendCache = {
    expiresAt: now + SEARCH_TREND_CACHE_TTL_MS,
    data,
  };

  return data;
}

async function fetchGoogleSearchTrends() {
  try {
    const response = await fetch(GOOGLE_TRENDS_RSS_URL, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml",
        "User-Agent": "rocket-growth-calculator/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`Google Trends RSS ${response.status}`);
    }
    const xml = await response.text();
    const items = parseGoogleTrendsRss(xml).slice(0, 10);
    return {
      key: "google",
      label: "Google",
      status: items.length ? "ok" : "empty",
      updatedAt: new Date().toISOString(),
      sourceUrl: GOOGLE_TRENDS_RSS_URL,
      items,
      message: items.length ? "" : "Google Trends RSS에서 검색어를 찾지 못했습니다.",
    };
  } catch (error) {
    return {
      key: "google",
      label: "Google",
      status: "error",
      updatedAt: new Date().toISOString(),
      sourceUrl: GOOGLE_TRENDS_RSS_URL,
      items: [],
      message: "Google Trends 연결을 확인해 주세요.",
    };
  }
}

async function fetchNaverDatalabTrends() {
  if (NAVER_TREND_API_URL) {
    return fetchConfiguredTrendProvider({
      key: "naver",
      label: "네이버",
      url: NAVER_TREND_API_URL,
      message: "네이버 검색어 제공 경로를 연결하면 표시됩니다.",
    });
  }

  if (!NAVER_DATALAB_CLIENT_ID || !NAVER_DATALAB_CLIENT_SECRET) {
    return {
      key: "naver",
      label: "네이버",
      status: "unconfigured",
      updatedAt: "",
      sourceUrl: "https://datalab.naver.com/keyword/trendSearch.naver",
      items: [],
      message: "네이버 데이터랩 키를 연결하면 주제어 관심도를 표시합니다.",
    };
  }

  try {
    const response = await fetch("https://openapi.naver.com/v1/datalab/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Naver-Client-Id": NAVER_DATALAB_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_DATALAB_CLIENT_SECRET,
        "User-Agent": "rocket-growth-calculator/1.0",
      },
      body: JSON.stringify({
        startDate: getDateString(-30),
        endDate: getDateString(0),
        timeUnit: "date",
        keywordGroups: TREND_KEYWORD_GROUPS.slice(0, 5).map((group) => ({
          groupName: group.title,
          keywords: group.keywords,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Naver Datalab ${response.status}`);
    }
    const payload = await response.json();
    const items = (payload.results || [])
      .map((result) => {
        const latest = Array.isArray(result.data) && result.data.length ? result.data[result.data.length - 1] : null;
        const group = TREND_KEYWORD_GROUPS.find((item) => item.title === result.title);
        const ratio = latest ? Number(latest.ratio || 0) : 0;
        return {
          title: normalizeText(result.title, 80),
          traffic: `관심도 ${Math.round(ratio * 10) / 10}`,
          url: buildTrendSearchUrl("naver", group ? group.title : result.title),
          ratio,
        };
      })
      .filter((item) => item.title)
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 10)
      .map(({ ratio, ...item }) => item);

    return {
      key: "naver",
      label: "네이버",
      status: items.length ? "ok" : "empty",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://datalab.naver.com/keyword/trendSearch.naver",
      items,
      message: items.length ? "" : "네이버 데이터랩에서 표시할 관심도 데이터를 찾지 못했습니다.",
    };
  } catch (error) {
    return {
      key: "naver",
      label: "네이버",
      status: "error",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://datalab.naver.com/keyword/trendSearch.naver",
      items: [],
      message: "네이버 데이터랩 연결을 확인해 주세요.",
    };
  }
}

async function fetchDaumSearchInterest() {
  if (DAUM_TREND_API_URL) {
    return fetchConfiguredTrendProvider({
      key: "daum",
      label: "Daum",
      url: DAUM_TREND_API_URL,
      message: "Daum 검색어 제공 경로를 연결하면 표시됩니다.",
    });
  }

  if (!KAKAO_REST_API_KEY) {
    return {
      key: "daum",
      label: "Daum",
      status: "unconfigured",
      updatedAt: "",
      sourceUrl: "https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide",
      items: [],
      message: "카카오 REST 키를 연결하면 Daum 검색 결과량 기준 관심도를 표시합니다.",
    };
  }

  try {
    const responses = await Promise.all(
      TREND_KEYWORD_GROUPS.slice(0, 5).map(async (group) => {
        const url = `https://dapi.kakao.com/v2/search/web?query=${encodeURIComponent(group.title)}&size=1`;
        const response = await fetch(url, {
          headers: {
            Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
            Accept: "application/json",
            "User-Agent": "rocket-growth-calculator/1.0",
          },
        });
        if (!response.ok) {
          throw new Error(`Daum search ${response.status}`);
        }
        const payload = await response.json();
        return {
          title: group.title,
          traffic: `${formatInteger(payload.meta?.total_count || 0)}건`,
          totalCount: Number(payload.meta?.total_count || 0),
          url: `https://search.daum.net/search?w=tot&q=${encodeURIComponent(group.title)}`,
        };
      }),
    );

    const items = responses
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 10)
      .map(({ totalCount, ...item }) => item);

    return {
      key: "daum",
      label: "Daum",
      status: items.length ? "ok" : "empty",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide",
      items,
      message: items.length ? "" : "Daum 검색에서 표시할 결과량을 찾지 못했습니다.",
    };
  } catch (error) {
    return {
      key: "daum",
      label: "Daum",
      status: "error",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide",
      items: [],
      message: "Daum 검색 연결을 확인해 주세요.",
    };
  }
}

async function fetchConfiguredTrendProvider({ key, label, url, message }) {
  if (!url) {
    return {
      key,
      label,
      status: "unconfigured",
      updatedAt: "",
      sourceUrl: "",
      items: [],
      message,
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "rocket-growth-calculator/1.0",
      },
    });
    if (!response.ok) {
      throw new Error(`${label} trend API ${response.status}`);
    }
    const payload = await response.json();
    const sourceItems = Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : [];
    const items = sourceItems
      .map((item) => ({
        title: normalizeText(item.title || item.keyword || item.query || item.name, 80),
        traffic: normalizeText(item.traffic || item.volume || item.rankText || "", 40),
        url: normalizeText(item.url || item.link || "", 300),
      }))
      .filter((item) => item.title)
      .slice(0, 10);

    return {
      key,
      label,
      status: items.length ? "ok" : "empty",
      updatedAt: new Date().toISOString(),
      sourceUrl: url,
      items,
      message: items.length ? "" : "연결된 API에서 표시할 검색어를 찾지 못했습니다.",
    };
  } catch (error) {
    return {
      key,
      label,
      status: "error",
      updatedAt: new Date().toISOString(),
      sourceUrl: url,
      items: [],
      message: `${label} 트렌드 연결을 확인해 주세요.`,
    };
  }
}

function parseGoogleTrendsRss(xml) {
  return [...String(xml || "").matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const block = match[1];
    const title = decodeXmlText(extractXmlTag(block, "title"));
    return {
      title,
      traffic: decodeXmlText(extractXmlTag(block, "ht:approx_traffic") || extractXmlTag(block, "approx_traffic")),
      url: buildTrendSearchUrl("google", title),
    };
  }).filter((item) => item.title);
}

function extractXmlTag(block, tagName) {
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(block || "").match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
  return match ? match[1] : "";
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function getCalculatorHref(slug) {
  const routes = {
    "rocket-growth-calculator": "/",
    "margin-price-calculator": "/community/final-margin",
    "china-purchase-cost": "/community/china-sourcing",
    "ad-break-even-roas": "/community/coupang-selling-cost",
    "cash-flow-calculator": "/guides/cash-flow-calculator",
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
    { loc: `${PUBLIC_SITE_URL}/trends`, priority: "0.8", changefreq: "daily" },
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
    `- 검색 트렌드: ${PUBLIC_SITE_URL}/trends`,
    `- 중국사입 단계: ${PUBLIC_SITE_URL}/community/china-sourcing`,
    `- 중국→한국 물류: ${PUBLIC_SITE_URL}/community/china-korea-logistics`,
    `- 한국→쿠팡 입고: ${PUBLIC_SITE_URL}/community/korea-coupang-inbound`,
    `- 쿠팡 소모 비용: ${PUBLIC_SITE_URL}/community/coupang-selling-cost`,
    `- 최종 비용·마진: ${PUBLIC_SITE_URL}/community/final-margin`,
    `- 질문답변: ${PUBLIC_SITE_URL}/community/qna`,
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

function shortenText(value, maxLength = 40) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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

function getSafeReturnPath(value) {
  const fallback = "/";
  const raw = String(value || fallback).trim();
  try {
    const url = new URL(raw, PUBLIC_SITE_URL);
    const publicUrl = new URL(PUBLIC_SITE_URL);
    if (url.origin !== publicUrl.origin && raw.startsWith("http")) {
      return fallback;
    }
    const pathValue = `${url.pathname}${url.search}${url.hash}`;
    if (!pathValue.startsWith("/") || pathValue.startsWith("//") || pathValue.startsWith("/auth/kakao")) {
      return fallback;
    }
    return pathValue;
  } catch {
    if (raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/auth/kakao")) {
      return raw;
    }
    return fallback;
  }
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
    secure: COOKIE_SECURE,
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
    secure: COOKIE_SECURE,
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
      parent_id TEXT,
      user_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      likes_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES community_comments(id) ON DELETE CASCADE,
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
    CREATE INDEX IF NOT EXISTS community_comments_parent_idx ON community_comments (parent_id, created_at);
  `);

  ensureColumn("community_comments", "parent_id", "TEXT");
  ensureColumn("community_comments", "likes_count", "INTEGER NOT NULL DEFAULT 0");

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

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function seedCommunityPosts() {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO community_posts (
      id, slug, category, title, summary, body_json, tags_json, author_user_id, author_name,
      status, is_featured, is_notice, views, likes_count, bookmarks_count, comments_count, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'published', ?, ?, ?, 0, 0, ?, 'seed', ?, ?)`,
  );
  const update = db.prepare(
    `UPDATE community_posts
     SET category = ?, title = ?, summary = ?, body_json = ?, tags_json = ?, author_name = ?,
         is_featured = ?, is_notice = ?, views = ?, comments_count = ?, source = 'seed', created_at = ?, updated_at = ?
     WHERE slug = ? AND source = 'seed'`,
  );

  SEED_COMMUNITY_POSTS.forEach((post, index) => {
    const existing = db.prepare("SELECT id FROM community_posts WHERE slug = ?").get(post.slug);
    const createdAt = post.createdAt || new Date(Date.now() - (SEED_COMMUNITY_POSTS.length - index) * 3600 * 1000).toISOString();
    const updatedAt = post.updatedAt || createdAt;
    const views = Number.isFinite(Number(post.views)) ? Number(post.views) : Math.max(12, 120 - index * 4);
    const commentsCount = Number.isFinite(Number(post.commentsCount)) ? Number(post.commentsCount) : 0;
    const values = [
      post.category,
      post.title,
      post.summary,
      JSON.stringify(post.sections || []),
      JSON.stringify(post.tags || []),
      post.authorName || "브랜드코어",
      post.isFeatured ? 1 : 0,
      post.isNotice ? 1 : 0,
      views,
      commentsCount,
      createdAt,
      updatedAt,
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
      views,
      commentsCount,
      createdAt,
      updatedAt,
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

const COMMUNITY_SORTS = {
  hot: "(likes_count * 4 + comments_count * 3 + views / 10.0) DESC, created_at DESC",
  new: "created_at DESC",
  top: "likes_count DESC, created_at DESC",
  comments: "comments_count DESC, created_at DESC",
  views: "views DESC, created_at DESC",
};

function buildCommunityWhere(options = {}) {
  const category = normalizeCommunityCategory(options.category);
  const search = String(options.search || "").trim();
  const tag = String(options.tag || "").trim();
  const where = ["status = 'published'"];
  const params = [];

  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (options.featured) {
    where.push("is_featured = 1");
  }
  if (options.notice === true) {
    where.push("is_notice = 1");
  } else if (options.notice === false) {
    where.push("is_notice = 0");
  }
  if (search) {
    where.push("(title LIKE ? OR summary LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (tag) {
    where.push("tags_json LIKE ?");
    params.push(`%"${tag}"%`);
  }
  return { clause: where.join(" AND "), params };
}

function getCommunityPosts(options = {}) {
  const { clause, params } = buildCommunityWhere(options);
  const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
  const offset = Math.max(0, Number(options.offset || 0));
  const orderBy = COMMUNITY_SORTS[options.sort] || "is_notice DESC, is_featured DESC, updated_at DESC";
  return db
    .prepare(
      `SELECT * FROM community_posts
       WHERE ${clause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)
    .map(communityPostFromRow);
}

function countCommunityPosts(options = {}) {
  const { clause, params } = buildCommunityWhere(options);
  const row = db.prepare(`SELECT COUNT(*) AS n FROM community_posts WHERE ${clause}`).get(...params);
  return Number(row?.n || 0);
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

function getCommunityCommentTree(postId) {
  const comments = getCommunityComments(postId).filter(Boolean);
  const byId = new Map(comments.map((comment) => [comment.id, { ...comment, replies: [] }]));
  const roots = [];
  byId.forEach((comment) => {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId).replies.push(comment);
    } else {
      roots.push(comment);
    }
  });
  return roots;
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
    parentId: row.parent_id || null,
    userId: row.user_id,
    authorName: row.author_name,
    body: row.body,
    likesCount: Number(row.likes_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    replies: [],
  };
}

function deleteCommunityCommentThread(commentId, userId) {
  const owned = db.prepare("SELECT id, post_id FROM community_comments WHERE id = ? AND user_id = ?").get(commentId, userId);
  if (!owned) return;
  const ids = collectCommunityCommentChildIds(commentId);
  ids.push(commentId);
  const deleteStmt = db.prepare("DELETE FROM community_comments WHERE id = ?");
  ids.forEach((id) => deleteStmt.run(id));
}

function collectCommunityCommentChildIds(parentId) {
  const rows = db.prepare("SELECT id FROM community_comments WHERE parent_id = ?").all(parentId);
  return rows.flatMap((row) => [row.id, ...collectCommunityCommentChildIds(row.id)]);
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

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
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

function getDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getDisplayUserName(user) {
  return user?.nickname || "카카오 셀러";
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

