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
const SEO_SITE_BRAND = "셀러딧";
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
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI || `${PUBLIC_SITE_URL}/auth/kakao/callback`;
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
  const requestedRole = req.body?.role === "admin" ? "admin" : "user";
  const kakaoId = `virtual-${nickname.replace(/\s+/g, "-")}`;
  const user = upsertUser({
    id: kakaoId,
    kakao_account: {
      email: `${kakaoId}@sellerdit.test`,
      profile: { nickname },
    },
  });
  if (requestedRole === "admin" && user.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
    user.role = "admin";
  }
  const sessionId = createSession(user.id);
  setSignedCookie(res, SESSION_COOKIE, sessionId, {
    maxAgeMs: SESSION_TTL_MS,
    path: "/",
  });
  res.json({ ok: true, user: { id: user.id, nickname: user.nickname, handle: makeCommunityHandle(nickname), role: user.role || requestedRole } });
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
  const category = normalizeCommunityCategory(req.query.category || req.query.cat);
  const sort = COMMUNITY_SORTS[req.query.sort] ? String(req.query.sort) : "hot";
  const search = String(req.query.q || "").trim().slice(0, 80);
  const posts = getCommunityPosts({ category, sort, search, limit: 50 });
  res.json({ posts });
});

app.get("/api/community/search", (req, res) => {
  const search = String(req.query.q || "").trim().slice(0, 80);
  const posts = search ? attachCommunityPostsState(getCommunityPosts({ search, sort: "new", limit: 50 }), req.currentUser) : [];
  res.json({ query: search, posts });
});

app.get("/api/community/memberships", requireLogin, (req, res) => {
  res.json({ communities: getCommunityMembershipsForUser(req.currentUser.id) });
});

app.post("/api/community/memberships", requireLogin, (req, res) => {
  const slug = normalizeCommunitySlug(req.body?.slug || req.body?.communitySlug);
  const community = getCommunityBySlug(slug);
  if (!community) {
    res.status(400).json({ error: "invalid_community", message: "가입할 커뮤니티를 찾지 못했습니다." });
    return;
  }
  const existing = db.prepare("SELECT user_id FROM memberships WHERE user_id = ? AND community_id = ?").get(req.currentUser.id, community.id);
  if (existing) db.prepare("DELETE FROM memberships WHERE user_id = ? AND community_id = ?").run(req.currentUser.id, community.id);
  else db.prepare("INSERT INTO memberships (user_id, community_id, created_at) VALUES (?, ?, ?)").run(req.currentUser.id, community.id, new Date().toISOString());
  syncCommunityMemberCount(community.id);
  res.json({ active: !existing, community: getCommunityBySlug(slug), communities: getCommunityMembershipsForUser(req.currentUser.id) });
});

app.get("/api/community/notifications", requireLogin, (req, res) => {
  const rows = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30").all(req.currentUser.id);
  res.json({ notifications: rows.map(notificationFromRow) });
});

app.get("/api/admin/suppliers", requireAdmin, (req, res) => {
  res.json({ suppliers: getSuppliers() });
});

app.post("/api/admin/suppliers", requireAdmin, (req, res) => {
  const supplier = normalizeSupplierPayload(req.body);
  if (!supplier.name || !supplier.category || !supplier.linkUrl) {
    res.status(400).json({ error: "invalid_supplier", message: "공급처 이름, 카테고리, 바로가기 URL을 입력해 주세요." });
    return;
  }
  const slug = createUniqueSupplierSlug(supplier.slug || supplier.name);
  const id = `supplier-${slug}`;
  db.prepare("INSERT INTO suppliers (id, slug, name, category, avatar_color, link_url, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, slug, supplier.name, supplier.category, supplier.avatarColor, supplier.linkUrl, req.currentUser.id, new Date().toISOString());
  res.status(201).json({ supplier: getSupplierBySlug(slug) });
});

app.put("/api/admin/suppliers/:slug", requireAdmin, (req, res) => {
  const existing = getSupplierBySlug(req.params.slug);
  const supplier = normalizeSupplierPayload(req.body);
  if (!existing || !supplier.name || !supplier.category || !supplier.linkUrl) {
    res.status(existing ? 400 : 404).json({ error: existing ? "invalid_supplier" : "supplier_not_found", message: existing ? "공급처 정보를 확인해 주세요." : "공급처를 찾지 못했습니다." });
    return;
  }
  db.prepare("UPDATE suppliers SET name = ?, category = ?, avatar_color = ?, link_url = ? WHERE slug = ?")
    .run(supplier.name, supplier.category, supplier.avatarColor, supplier.linkUrl, existing.slug);
  res.json({ supplier: getSupplierBySlug(existing.slug) });
});

app.delete("/api/admin/suppliers/:slug", requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM suppliers WHERE slug = ?").run(String(req.params.slug || ""));
  if (result.changes === 0) {
    res.status(404).json({ error: "supplier_not_found", message: "삭제할 공급처를 찾지 못했습니다." });
    return;
  }
  res.json({ ok: true, deletedSlug: req.params.slug });
});

app.get("/api/community/posts/:slug", (req, res) => {
  const post = getCommunityPostBySlug(req.params.slug);
  if (!post) {
    res.status(404).json({ error: "post_not_found", message: "게시글을 찾지 못했습니다." });
    return;
  }
  res.json({ post: attachCommunityPostState(post, req.currentUser), comments: getCommunityCommentTree(post.id) });
});

app.post("/api/community/posts", requireLogin, (req, res) => {
  const title = normalizeText(req.body?.title, 90);
  const category = normalizeCommunityCategory(req.body?.category) || "final-margin";
  const summary = normalizeText(req.body?.summary, 180);
  const bodyText = normalizeText(req.body?.body, 5000);
  const imageUrl = normalizeUrl(req.body?.imageUrl || req.body?.image_url, 500);
  const postType = imageUrl ? "image" : "text";
  const tags = normalizeTags(req.body?.tags);

  if (!title || !bodyText) {
    res.status(400).json({ error: "invalid_post", message: "제목과 본문을 입력해 주세요." });
    return;
  }

  const now = new Date().toISOString();
  const id = `post-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const slug = createUniqueCommunitySlug(title);
  const bodyJson = JSON.stringify([{ heading: "본문", body: bodyText.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean), imageUrl, type: postType }]);

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
    summary,
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
  const existing = getEditableCommunityPost(req.params.id, req.currentUser);
  if (!existing) {
    res.status(404).json({ error: "post_not_found", message: "수정할 게시글을 찾지 못했습니다." });
    return;
  }

  const title = normalizeText(req.body?.title, 90) || existing.title;
  const category = normalizeCommunityCategory(req.body?.category) || existing.category;
  const summary = normalizeText(req.body?.summary, 180) || existing.summary;
  const bodyText = normalizeText(req.body?.body, 5000);
  const imageUrl = normalizeUrl(req.body?.imageUrl || req.body?.image_url, 500);
  const tags = normalizeTags(req.body?.tags);
  const bodyJson = bodyText
    ? JSON.stringify([{ heading: "본문", body: bodyText.split(/\n{2,}/).map((line) => line.trim()).filter(Boolean), imageUrl, type: imageUrl ? "image" : "text" }])
    : JSON.stringify(existing.sections);

  db.prepare(
    `UPDATE community_posts
     SET title = ?, category = ?, summary = ?, body_json = ?, tags_json = ?, updated_at = ?
     WHERE id = ? AND author_user_id = ?`,
  ).run(title, category, summary, bodyJson, JSON.stringify(tags.length ? tags : existing.tags), new Date().toISOString(), existing.id, existing.authorUserId);

  res.json({ post: communityPostFromRow(db.prepare("SELECT * FROM community_posts WHERE id = ?").get(existing.id)) });
});

app.delete("/api/community/posts/:id", requireLogin, (req, res) => {
  const existing = getEditableCommunityPost(req.params.id, req.currentUser);
  if (!existing) {
    res.status(404).json({ error: "post_not_found", message: "삭제할 게시글을 찾지 못했습니다." });
    return;
  }

  db.prepare("DELETE FROM community_comments WHERE post_id = ?").run(existing.id);
  db.prepare("DELETE FROM community_reactions WHERE post_id = ?").run(existing.id);
  db.prepare("DELETE FROM community_posts WHERE id = ?").run(existing.id);
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
  createCommunityNotificationForComment(post, id, parentComment?.id || null, req.currentUser);
  res.status(201).json({ comment: getCommunityCommentById(id), comments: getCommunityCommentTree(post.id), post: getCommunityPostById(post.id) });
});

app.put("/api/community/comments/:id", requireLogin, (req, res) => {
  const comment = getEditableCommunityComment(req.params.id, req.currentUser);
  const body = normalizeText(req.body?.body, 1500);
  if (!comment || !body) {
    res.status(comment ? 400 : 404).json({ error: comment ? "invalid_comment" : "comment_not_found", message: comment ? "댓글 내용을 입력해 주세요." : "수정할 댓글을 찾지 못했습니다." });
    return;
  }
  db.prepare("UPDATE community_comments SET body = ?, updated_at = ? WHERE id = ?").run(body, new Date().toISOString(), comment.id);
  res.json({ comment: getCommunityCommentById(comment.id), comments: getCommunityCommentTree(comment.postId), post: getCommunityPostById(comment.postId) });
});

app.delete("/api/community/comments/:id", requireLogin, (req, res) => {
  const comment = getEditableCommunityComment(req.params.id, req.currentUser);
  if (!comment) {
    res.status(404).json({ error: "comment_not_found", message: "삭제할 댓글을 찾지 못했습니다." });
    return;
  }

  deleteCommunityCommentThread(comment.id);
  updateCommunityCommentCount(comment.post_id);
  res.json({ ok: true, deletedId: comment.id });
});

app.post("/api/community/comment-reactions", requireLogin, (req, res) => {
  const comment = getCommunityCommentById(req.body?.commentId);
  if (!comment) {
    res.status(400).json({ error: "invalid_comment", message: "추천할 댓글을 찾지 못했습니다." });
    return;
  }
  const existing = db.prepare("SELECT id FROM community_comment_votes WHERE comment_id = ? AND user_id = ?").get(comment.id, req.currentUser.id);
  if (existing) {
    db.prepare("DELETE FROM community_comment_votes WHERE comment_id = ? AND user_id = ?").run(comment.id, req.currentUser.id);
  } else {
    db.prepare("INSERT INTO community_comment_votes (id, comment_id, user_id, value, created_at) VALUES (?, ?, ?, 1, ?)").run(`comment-vote-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, comment.id, req.currentUser.id, new Date().toISOString());
  }
  updateCommunityCommentVoteCount(comment.id);
  res.json({ comment: getCommunityCommentById(comment.id), active: !existing });
});

app.post("/api/community/follow", requireLogin, (req, res) => {
  const handle = makeCommunityHandle(req.body?.handle || req.body?.target || "");
  if (!handle) {
    res.status(400).json({ error: "invalid_follow", message: "팔로우할 대상을 찾지 못했습니다." });
    return;
  }
  const existing = db.prepare("SELECT user_id FROM community_follows WHERE user_id = ? AND target_handle = ?").get(req.currentUser.id, handle);
  if (existing) {
    db.prepare("DELETE FROM community_follows WHERE user_id = ? AND target_handle = ?").run(req.currentUser.id, handle);
  } else {
    db.prepare("INSERT INTO community_follows (user_id, target_handle, created_at) VALUES (?, ?, ?)").run(req.currentUser.id, handle, new Date().toISOString());
  }
  res.json({ active: !existing, handle });
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
  res.type("html").send(renderCommunityIndexPage(req.query, req.currentUser));
});

app.get(["/community/search", "/community/search/"], (req, res) => {
  res.type("html").send(renderCommunityIndexPage({ ...req.query, q: req.query.q || req.query.query || "" }, req.currentUser));
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


app.get(["/community/suppliers", "/community/suppliers/"], (req, res) => {
  res.type("html").send(renderCommunitySupplierDirectoryPage(req.query, req.currentUser));
});
app.get("/community/:category(china-sourcing|china-korea-logistics|korea-coupang-inbound|coupang-selling-cost|final-margin|qna)", (req, res) => {
  res.type("html").send(renderCommunityCategoryPage(req.params.category, req.query, req.currentUser));
});

app.get("/community/:slug", (req, res) => {
  const post = getCommunityPostBySlug(req.params.slug);
  if (!post) {
    res.status(404).type("html").send(renderNotFoundPage());
    return;
  }

  incrementCommunityViews(post.id);
  res.type("html").send(renderCommunityPostPage(getCommunityPostById(post.id), req.currentUser));
});

app.get("/u/:handle", (req, res) => {
  res.type("html").send(renderSellerditProfilePage(req.params.handle, req.query, req.currentUser));
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

app.get("/app.js", (req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});

app.get("/styles.css", (req, res) => {
  res.sendFile(path.join(__dirname, "styles.css"));
});

app.use("/assets", express.static(path.join(__dirname, "assets"), {
  fallthrough: false,
  immutable: true,
  maxAge: "1y",
}));

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
  if (params.cat) parts.push(`cat=${encodeURIComponent(params.cat)}`);
  if (params.page && Number(params.page) > 1) parts.push(`page=${Number(params.page)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

function renderCommunitySortBar(basePath, activeSort, search, tag, cat = "") {
  const links = [
    { key: "hot", label: "인기" },
    { key: "new", label: "최신" },
    { key: "top", label: "추천" },
    { key: "comments", label: "댓글" },
    { key: "views", label: "조회" },
  ];
  const categoryLinks = [
    { key: "", label: "전체" },
    ...COMMUNITY_STAGE_SLUGS.map((slug) => ({ key: slug, label: COMMUNITY_CATEGORIES[slug].label })),
  ];
  return `<div class="community-toolbar sellerdit-sortbar">
    <nav class="community-sort" aria-label="정렬 기준">
      <span class="sellerdit-sort-links sellerdit-filter-links">
        ${links.map((item) => {
          const href = `${basePath}${communityQueryString({ sort: item.key, q: search, tag, cat })}`;
          return `<a class="${item.key === activeSort ? "is-active" : ""}" href="${escapeHtml(href)}">${escapeHtml(item.label)}</a>`;
        }).join("")}
      </span>
      ${basePath === "/community" ? `<span class="sellerdit-sort-links sellerdit-cat-links">
        ${categoryLinks.map((item) => {
          const href = `${basePath}${communityQueryString({ sort: activeSort, q: search, tag, cat: item.key })}`;
          const isActive = (cat || "") === item.key;
          return `<a class="${isActive ? "is-active" : ""}" href="${escapeHtml(href)}">${escapeHtml(item.label)}</a>`;
        }).join("")}
      </span>` : ""}
    </nav>
  </div>`;
}

function renderCommunityActionIcon(type) {
  const icons = {
    like: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>',
    dislike: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20 4.5 12.5h4.25V4h6.5v8.5h4.25L12 20Z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>',
  };
  return icons[type] || "";
}

function renderCommunityActions(post, options = {}) {
  const commentsCount = options.commentsCount ?? post.commentsCount ?? 0;
  const commentsHref = options.commentsHref || `/community/${escapeHtml(post.slug)}#comments`;
  const extraActions = options.extraActions || "";
  return `<div class="community-vote-actions sellerdit-actions${options.detail ? " sellerdit-detail-actions" : ""}" aria-label="게시글 작업">
    <button type="button" class="sellerdit-action sellerdit-action-like ${post.likedByMe ? "is-active" : ""}" aria-label="좋아요" data-community-reaction="like" data-post-slug="${escapeHtml(post.slug)}">${renderCommunityActionIcon("like")}<span data-reaction-count>${formatInteger(post.likesCount || 0)}</span></button>
    <a class="sellerdit-action sellerdit-action-comment" aria-label="댓글" href="${commentsHref}">${renderCommunityActionIcon("comment")}<span>${formatInteger(commentsCount)}</span></a>
    <button type="button" class="sellerdit-action sellerdit-action-share" aria-label="공유" data-community-share data-share-url="/community/${escapeHtml(post.slug)}">${renderCommunityActionIcon("share")}</button>
    <button type="button" class="sellerdit-action sellerdit-action-bookmark ${post.savedByMe ? "is-active" : ""}" aria-label="${post.savedByMe ? "저장됨" : "저장"}" data-community-reaction="bookmark" data-post-slug="${escapeHtml(post.slug)}">${renderCommunityActionIcon("bookmark")}</button>
    ${extraActions}
  </div>`;
}

function renderCommunityVoteCard(post, index = 0) {
  const dateLabel = formatRelativeDate(post.createdAt);
  const authorName = post.authorName || "셀러";
  const threadContent = getThreadDisplayContent(post);
  const primaryActions = post.canEdit
    ? `<button type="button" class="sellerdit-action" data-community-edit-post data-post-id="${escapeHtml(post.id)}" data-post-body="${escapeHtml(threadContent)}" data-post-category="${escapeHtml(post.category)}" data-post-tags="${escapeHtml((post.tags || []).join(", "))}">수정</button>
      <button type="button" class="sellerdit-action" data-community-delete-post data-post-id="${escapeHtml(post.id)}">삭제</button>`
    : "";
  return `<article class="community-vote-card sellerdit-feed-post${post.isNotice ? " is-notice" : ""}" data-post-id="${escapeHtml(post.id)}">
    <span class="sellerdit-avatar sellerdit-feed-avatar" style="background:${escapeHtml(getCommunityAuthorColor(authorName))}">${escapeHtml(getCommunityAuthorInitial(authorName))}</span>
    <div class="sellerdit-feed-content">
      <div class="sellerdit-post-meta">
        <a class="sellerdit-author" href="/u/${escapeHtml(makeCommunityHandle(authorName))}">u/${escapeHtml(makeCommunityHandle(authorName))}</a>
        <span class="sellerdit-dot">·</span>
        ${dateLabel ? `<time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(dateLabel)}</time>` : ""}
        ${post.isNotice ? `<span class="community-pin-badge">공지</span>` : ""}
        <button class="sellerdit-follow" type="button" data-community-follow data-follow-handle="${escapeHtml(makeCommunityHandle(authorName))}">팔로우</button>
        <span class="sellerdit-more">⋯</span>
      </div>
      <a class="sellerdit-thread-body is-feed" href="/community/${escapeHtml(post.slug)}">${escapeHtml(threadContent)}</a>
            <a class="sellerdit-thread-more" href="/community/${escapeHtml(post.slug)}">더 보기</a>
      ${renderCommunityFeedMedia(post, index)}
      ${renderCommunityActions(post, { extraActions: primaryActions })}
    </div>
  </article>`;
}
function getCommunityMediaLabel(category) {
  return {
    "china-sourcing": "사입 박스 사진",
    "china-korea-logistics": "LCL 화물 사진",
    "korea-coupang-inbound": "입고 박스 사진",
    "coupang-selling-cost": "정산 화면 사진",
    "final-margin": "입고 박스 사진",
  }[category] || "입고 박스 사진";
}

function renderCommunityFeedMedia(post, index = 0) {
  if (post.imageUrl) {
    return `<a class="sellerdit-post-media" href="/community/${escapeHtml(post.slug)}" aria-label="${escapeHtml(getThreadPostSeoTitle(post))} 이미지"><img src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy"></a>`;
  }
  if (post.isNotice || post.category === "qna" || index % 4 !== 0) {
    return "";
  }
  const mediaLabel = getCommunityMediaLabel(post.category);
  return `<a class="sellerdit-post-media sellerdit-box-photo is-${escapeHtml(post.category)}" href="/community/${escapeHtml(post.slug)}" aria-label="${escapeHtml(getThreadPostSeoTitle(post))} 미리보기">
    <span>${escapeHtml(mediaLabel)}</span>
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
  if (post?.imageUrl) {
    return `<div class="sellerdit-post-media is-detail"><img src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy"></div>`;
  }
  if (!post || post.category === "qna") {
    return "";
  }
  const mediaLabel = getCommunityMediaLabel(post.category);
  return `<div class="sellerdit-post-media sellerdit-box-photo is-detail is-${escapeHtml(post.category)}" aria-label="${escapeHtml(getThreadPostSeoTitle(post))} 이미지">
    <span>${escapeHtml(mediaLabel)}</span>
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
  return `<div class="community-vote-list sellerdit-feedpanel" style="border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;overflow:visible!important">${items}</div>`;
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
        <strong>${escapeHtml(getThreadPostSeoTitle(post, 80))}</strong>
        <span class="community-pinned-meta">댓글 ${formatInteger(post.commentsCount)}</span>
      </a>`,
      )
      .join("")}
  </div>`;
}

function sellerditIcon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
    popular: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m10 14 4-4"/><path d="M10 10h4v4"/></svg>',
    notice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h14v12H4z"/><path d="M8 10h7"/><path d="M8 14h5"/><path d="M18 9h2v8h-2"/></svg>',
    explore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="8" cy="7" r="2"/><path d="m9.6 8.2 5.8-1.4"/><path d="m7.2 16.3.8-7.4"/><path d="m7.6 17 9.1-9.6"/></svg>',
    create: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
    calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 7h6"/><path d="M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l5-5 4 4 7-8"/><path d="M15 7h5v5"/></svg>',
    guide: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h9v16H8a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M9 8h5"/><path d="M9 12h5"/><path d="M9 16h4"/></svg>',
  };
  return icons[name] || "";
}

function renderCommunityLeftRail(activeKey = "community", currentUser = null) {
  const topItems = [
    ["home", "/community", "홈", activeKey === "community"],
    ["popular", "/community?sort=hot", "인기", false],
    ["notice", "/community?tag=공지", "공지", false],
    ["explore", "/community", "둘러보기", false],
    ["create", "#community-write", "커뮤니티 만들기", false],
  ];
  const quickItems = [
    ["calc", "/", "로켓계산기"],
    ["trend", "/trends", "검색 트렌드"],
  ];
  const renderItem = ([icon, href, label, active = false]) => `<a class="sellerdit-lnav-item ${active ? "is-active" : ""}" href="${href}"><span class="sellerdit-lnav-ic">${sellerditIcon(icon)}</span><span>${escapeHtml(label)}</span></a>`;
  const supplierItems = [
    ["yiwu", "🏬", "이우 종합도매"],
    ["gz", "👗", "광저우 패션상가"],
    ["domestic", "📦", "도매꾹 국내도매"],
  ];
  const recentItems = ["r/로켓그로스", "r/1688사입", "r/초보셀러"];
  return `<aside id="sellerdit-mobile-drawer" class="community-left-rail sellerdit-left-rail sellerdit-reddit-left-rail" aria-label="셀러딧 왼쪽 메뉴" aria-hidden="true">
    <div class="sellerdit-drawer-head"><strong>셀러딧</strong><button type="button" aria-label="메뉴 닫기" data-mobile-drawer-close>×</button></div>
    <nav class="sellerdit-lnav" aria-label="셀러딧 섹션">
      <section class="sellerdit-lnav-section sellerdit-main-nav">
        ${topItems.map(renderItem).join("")}
      </section>
      <section class="sellerdit-lnav-section sellerdit-supplier-nav" aria-labelledby="sellerdit-supplier-nav-title">
        <div class="sellerdit-lnav-sec" id="sellerdit-supplier-nav-title"><span>SELLERDIT 공급처</span><span aria-hidden="true">▲</span></div>
        <a class="sellerdit-supplier-card" href="/community/suppliers" aria-label="추천 공급처 1688 직소싱 파트너">
          <span class="supplier-card-icon">16</span>
          <span class="supplier-card-copy"><strong>1688 직소싱 파트너</strong><em>월 거래 1.2만 건</em></span>
          <span class="badge-new">신규</span>
        </a>
        ${supplierItems.map(([theme, icon, label]) => `<a class="sellerdit-lnav-item sellerdit-supplier-row" href="/community/suppliers"><span class="sellerdit-lnav-ic sellerdit-round-ic supplier-thumb is-${escapeHtml(theme)}">${escapeHtml(icon)}</span><span>${escapeHtml(label)}</span></a>`).join("")}
        <a class="sellerdit-lnav-item sellerdit-more-browse" href="/community/suppliers"><span class="sellerdit-lnav-ic sellerdit-browse-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8 14.4 9l5.6.6-4.2 3.7 1.2 5.5-5-2.9-5 2.9 1.2-5.5L4 9.6 9.6 9 12 3.8Z"/><path d="M12 8.8v4.8M9.6 11.2h4.8"/></svg></span><span>더 둘러보기</span></a>
      </section>
      <section class="sellerdit-lnav-section sellerdit-recent-nav" aria-labelledby="sellerdit-recent-nav-title">
        <div class="sellerdit-lnav-sec" id="sellerdit-recent-nav-title"><span>최근 방문</span><span aria-hidden="true">▲</span></div>
        ${recentItems.map((name) => `<a class="sellerdit-lnav-item sellerdit-recent-row" href="/community"><span class="sellerdit-lnav-ic sellerdit-recent-avatar">${escapeHtml(name.replace("r/", "").slice(0, 1))}</span><span>${escapeHtml(name)}</span></a>`).join("")}
      </section>
      <section class="sellerdit-lnav-section sellerdit-shortcut-nav" aria-labelledby="sellerdit-shortcut-nav-title">
        <div class="sellerdit-lnav-sec" id="sellerdit-shortcut-nav-title"><span>바로가기</span><span aria-hidden="true">▲</span></div>
        ${quickItems.map(renderItem).join("")}
      </section>
    </nav>
  </aside>`;
}
function renderCommunityAboutCard() {
  return renderPopularCommunitiesPanel();
}

function renderCommunityPostBridge(post, category) {
  return renderKillerContentPanel();
}

function renderCommunityRelatedPanel(posts) {
  const items = [
    { type: "post", community: "r/셀러딧", time: "4일 전", title: "로켓그로스 입고 전 꼭 확인할 비용 7가지", stats: "👍 122 · 댓글 8", avatar: "r", color: "#2563eb", href: "/community/rocket-growth-cost-checklist-7" },
    { type: "ad", community: "Meshyai", time: "홍보 광고", title: "셀러 상세페이지, AI로 10분 만에 완성", stats: "meshy.ai", avatar: "M", color: "#7c3aed", href: "http://meshy.ai" },
    { type: "post", community: "r/셀러딧", time: "5일 전", title: "로켓그로스 판매가 정하기 전 체크리스트", stats: "👍 93 · 댓글 3", avatar: "r", color: "#2563eb", href: "/community/rocket-growth-price-checklist" },
    { type: "post", community: "r/셀러딧", time: "6일 전", title: "정산금액과 순이익이 왜 다르게 나오나요?", stats: "👍 146 · 댓글 5", avatar: "r", color: "#2563eb", href: "/community/settlement-is-not-sales" },
  ];
  const thumb = (type, index) => type === "ad"
    ? `<span class="rthumb is-ad"><svg viewBox="0 0 60 60" aria-hidden="true"><defs><linearGradient id="mesh-thumb-${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ede9fe"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs><rect width="60" height="60" rx="8" fill="url(#mesh-thumb-${index})"/><circle cx="30" cy="24" r="10" fill="#fff" opacity=".84"/><rect x="15" y="39" width="30" height="8" rx="4" fill="#fff" opacity=".62"/></svg></span>`
    : `<span class="rthumb"><svg viewBox="0 0 60 60" aria-hidden="true"><rect width="60" height="60" rx="8" fill="#f1f5f9"/><rect x="13" y="16" width="34" height="5" rx="2.5" fill="#94a3b8"/><rect x="13" y="29" width="26" height="5" rx="2.5" fill="#cbd5e1"/><rect x="13" y="41" width="30" height="5" rx="2.5" fill="#cbd5e1"/></svg></span>`;
  return `<section class="community-related-feed sellerdit-related-feed" aria-label="관련 게시물">
    <div class="community-related-feed-head"><strong>관련 게시물</strong></div>
    <div>
      ${items.map((item, index) => `<a class="relitem community-related-item ${item.type === "ad" ? "is-ad" : ""}" href="${escapeHtml(item.href)}" ${item.type === "ad" ? 'rel="nofollow noopener" target="_blank"' : ""}>
        <div class="relhead"><span class="ravatar" style="background:${escapeHtml(item.color)}">${escapeHtml(item.avatar)}</span><span class="rcomm">${escapeHtml(item.community)}</span><span class="dot">·</span> <span>${escapeHtml(item.time)}</span><span class="rdots">⋯</span></div>
        <div class="relrow">
          <div class="relcopy"><div class="rtitle">${escapeHtml(item.title)}</div><div class="rstats">${escapeHtml(item.stats)}</div></div>
          ${item.type === "ad" ? `<span class="reljoin">가입</span>` : thumb(item.type, index)}
        </div>
      </a>`).join("")}
    </div>
  </section>`;
}
function renderCommunityPromotedPost() {
  return `<article class="community-vote-card sellerdit-feed-post sellerdit-promoted">
    <span class="sellerdit-avatar sellerdit-feed-avatar is-ad">A</span>
    <div class="sellerdit-feed-content">
      <div class="sellerdit-post-meta">
        <span class="sellerdit-author">Alibaba_B2B</span>
        <span class="sellerdit-dot">·</span>
        <span class="ad-tag">홍보 광고</span>
        <span class="sellerdit-more">⋯</span>
      </div>
      <a class="sellerdit-thread-body is-feed" href="https://www.1688.com/" rel="nofollow noopener" target="_blank">1688 대량 사입 단가, 물류비까지 같이 비교해 보세요

상품 단가만 보지 말고 배송대행, 통관, 입고 비용까지 함께 확인하는 셀러용 체크 포인트입니다.</a>
      <a class="sellerdit-promoted-cta" href="https://www.1688.com/" rel="nofollow noopener" target="_blank">더 알아보기</a>
      <div class="community-vote-actions sellerdit-actions sellerdit-promoted-actions" aria-label="광고 작업">
        <span class="sellerdit-action sellerdit-action-share">${renderCommunityActionIcon("share")}<span>공유</span></span>
        <span class="sellerdit-action sellerdit-action-info"><span aria-hidden="true">⋯</span><span>광고 정보</span></span>
      </div>
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
    ["농", "r/농수산사입", "멤버 12,480명", "#16a34a"],
    ["16", "r/1688사입", "멤버 9,742명", "#f97316"],
    ["로", "r/로켓그로스", "멤버 8,115명", "#2563eb"],
    ["물", "r/LCL물류", "멤버 5,233명", "#0ea5e9"],
    ["셀", "r/초보셀러", "멤버 4,901명", "#8b5cf6"],
  ];
  return `<section class="community-about-card sellerdit-widget sellerdit-communities" aria-label="인기 커뮤니티">
    <div class="sellerdit-widget-title"><h2>인기 커뮤니티</h2></div>
    ${communities
      .map(([initial, name, meta, color]) => `<a class="sellerdit-community-row" href="/community">
        <span class="sellerdit-community-avatar" style="background:${color}">${escapeHtml(initial)}</span>
        <span class="sellerdit-community-copy"><strong>${escapeHtml(name)}</strong><em>${escapeHtml(meta)}</em></span>
      </a>`)
      .join("")}
    <a class="sellerdit-communities-more" href="/community">더 보기</a>
  </section>`;
}

function renderCommunityPopularContentPanel() {
  const posts = getCommunityPosts({ sort: "hot", limit: 5 });
  return `<section class="sellerdit-widget sellerdit-popular-content" aria-label="실시간 인기 콘텐츠">
    <h2>실시간 인기 콘텐츠 TOP 5</h2>
    ${posts
      .map((post, index) => `<a href="/community/${escapeHtml(post.slug)}">
        <b>${index + 1}</b>
        <span>${escapeHtml(getThreadPostSeoTitle(post, 90))}</span>
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

function renderSellerditRecentPostsPanel() {
  const posts = getCommunityPosts({ sort: "new", limit: 3 });
  const fallbacks = [
    { community: "r/로켓그로스", title: "입고 전 꼭 확인할 비용 7가지", commentsCount: 8, likesCount: 290, createdAt: "12시간 전", color: "#2563eb", image: "/assets/final-cost-summary.svg", imageCount: 2 },
    { community: "r/1688사입", title: "1688 상품단가 말고 어떤 비용을 더 봐야 하나요?", commentsCount: 25, likesCount: 75, createdAt: "4일 전", color: "#f97316", image: "/assets/china-sourcing.svg", imageCount: 3 },
    { community: "r/초보셀러", title: "판매가 19,900원인데 마진이 남을까요?", commentsCount: 10, likesCount: 528, createdAt: "1일 전", color: "#8b5cf6", image: "/assets/coupang-costs.svg", imageCount: 10 },
  ];
  const source = posts.length ? posts : fallbacks;
  const elapsed = (value, index) => {
    if (String(value || "").includes("전")) return value;
    return ["12시간 전", "4일 전", "1일 전"][index] || "방금 전";
  };
  const communityName = (post, index) => post.community || ["r/로켓그로스", "r/1688사입", "r/초보셀러"][index] || "r/셀러딧";
  const imageFor = (post, index) => post.image || ["/assets/final-cost-summary.svg", "/assets/china-sourcing.svg", "/assets/coupang-costs.svg"][index] || "";
  return `<section class="sellerdit-recent-posts-panel" aria-label="최근 게시물">
    <div class="sellerdit-recent-posts-head"><strong>최근 게시물</strong><a href="/community">지우기</a></div>
    <div class="sellerdit-recent-posts-list">
      ${source.slice(0, 3).map((post, index) => {
        const fallback = fallbacks[index] || fallbacks[0];
        const title = post.slug ? getThreadPostSeoTitle(post, 90) : (post.title || fallback.title);
        const href = post.slug ? `/community/${escapeHtml(post.slug)}` : "/community";
        const likes = formatInteger(post.likesCount || fallback.likesCount || 0);
        const comments = formatInteger(post.commentsCount || fallback.commentsCount || 0);
        const community = communityName(post, index);
        const avatar = getCommunityAuthorInitial(community.replace("r/", ""));
        const color = post.color || fallback.color;
        const image = imageFor(post, index);
        const imageCount = post.imageCount || fallback.imageCount || index + 2;
        return `<a class="sellerdit-recent-post" href="${href}">
          <span class="sellerdit-recent-copy">
            <span class="sellerdit-recent-meta"><span class="sellerdit-recent-avatar" style="background:${escapeHtml(color)}">${escapeHtml(avatar)}</span><b>${escapeHtml(community)}</b><i>·</i><em>${escapeHtml(elapsed(post.createdAt, index))}</em></span>
            <strong>${escapeHtml(title)}</strong>
            <small>좋아요 ${likes}개 · 댓글 ${comments}개</small>
          </span>
          ${image ? `<span class="sellerdit-recent-thumb"><img src="${escapeHtml(image)}" alt="" loading="lazy" /><em><svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="3" width="7" height="6" rx="1.2"/><path d="M4 2h6v6"/></svg>${formatInteger(imageCount)}</em></span>` : ""}
        </a>`;
      }).join("")}
    </div>
  </section>`;
}

function renderSellerditRightRail(mode = "list", relatedPosts = []) {
  return `<aside class="community-right-rail sellerdit-right-rail">
    ${renderSellerditRecentPostsPanel()}
    <section class="sellerdit-rail-card sellerdit-board-info" aria-label="게시판 정보">
      <strong>셀러딧 커뮤니티</strong>
      <p>쿠팡셀러와 개인셀러가 로켓그로스 비용을 단계별로 묻고 답하는 공간입니다.</p>
      <dl>
        <div><dt>게시글</dt><dd>${formatInteger(countCommunityPosts({}))}</dd></div>
        <div><dt>주제</dt><dd>5단계 비용</dd></div>
      </dl>
    </section>
    <section class="sellerdit-rail-card sellerdit-board-rules" aria-label="게시판 규칙">
      <strong>규칙</strong>
      <ol>
        <li>실제 비용 기준으로 질문하기</li>
        <li>광고·홍보는 명확히 표시하기</li>
        <li>공급처 정보는 출처와 함께 공유하기</li>
      </ol>
    </section>
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

function renderCommunityIndexPage(query = {}, currentUser = null) {
  const sort = COMMUNITY_SORTS[query.sort] ? String(query.sort) : "hot";
  const search = String(query.q || "").trim().slice(0, 60);
  const tag = String(query.tag || "").trim().slice(0, 40);
  const pageSize = 12;
  const category = normalizeCommunityCategory(query.cat || query.category);
  const feedOptions = { notice: false, sort, search, tag, category };
  const total = countCommunityPosts(feedOptions);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(query.page) || 1), totalPages);
  const posts = attachCommunityPostsState(getCommunityPosts({ ...feedOptions, limit: pageSize, offset: (page - 1) * pageSize }), currentUser);
  const notices = !search && !tag && page === 1 ? getCommunityPosts({ notice: true, sort: "new", limit: 3 }) : [];
  const title = "셀러딧 커뮤니티";
  const description =
    "쿠팡셀러와 개인셀러를 위한 로켓그로스 5단계 커뮤니티입니다. 중국사입, 중국→한국 물류, 한국→쿠팡 입고, 쿠팡 소모 비용, 최종 비용을 단계별로 묻고 답합니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/community`;
  const heading = search ? `‘${search}’ 검색 결과` : (category ? COMMUNITY_CATEGORIES[category].title : "쿠팡셀러 비용 게시판");
  const subLabel = search ? `${formatInteger(total)}개의 글` : (category ? COMMUNITY_CATEGORIES[category].label : "셀러 커뮤니티");

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("community")}
      <section class="community-workspace community-reddit-layout sellerdit-with-left-rail">
        ${renderCommunityLeftRail("community", currentUser)}
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
          ${renderCommunitySortBar("/community", sort, search, tag, category)}
          ${renderCommunityPinned(notices)}
          ${renderCommunityFeed(posts, search ? "검색 결과가 없습니다. 다른 키워드로 찾아보세요." : "아직 등록된 글이 없습니다.")}
          ${renderCommunityPager("/community", page, totalPages, search, sort, tag)}
          ${renderCommunityWritePanel()}
        </section>
        ${renderSellerditRightRail("list")}
      </section>
    </main>`,
    jsonLd: buildCommunityIndexJsonLd(title, description, canonicalUrl, posts.length ? posts : popularPosts),
    script: renderCommunityScript(),
  });
}


function getCommunitySupplierTiles(currentUser = null) {
  const communityTiles = getCommunities().map((community) => ({
    type: "community",
    initial: getCommunityAuthorInitial(community.name),
    name: community.name,
    slug: community.slug,
    memberCount: community.memberCount,
    postsCount: countCommunityPosts({ category: community.category || "" }),
    description: community.description,
    href: community.slug && COMMUNITY_CATEGORIES[community.slug] ? `/community?cat=${encodeURIComponent(community.slug)}` : "/community",
    color: "#2563eb",
    joinedByMe: Boolean(currentUser?.id && isCommunityMember(currentUser.id, community.id)),
  }));
  const supplierTiles = getSuppliers().map((supplier) => ({
    type: "supplier",
    initial: getCommunityAuthorInitial(supplier.name),
    name: supplier.name,
    category: supplier.category,
    filter: supplier.filter || supplier.categoryFilter || "",
    href: supplier.linkUrl || `/suppliers/${supplier.slug}`,
    color: supplier.avatarColor || "#2563eb",
  }));
  return [...communityTiles, ...supplierTiles];
}

function renderCommunitySupplierTile(tile) {
  if (tile.type === "supplier") {
    return `<a class="sellerdit-tile sellerdit-tile-supplier" href="${escapeHtml(tile.href)}" data-tile-type="supplier" data-supplier-filter="${escapeHtml(tile.filter || "")}">
      <div class="sellerdit-tile-head">
        <span class="sellerdit-tile-avatar" style="--tile-avatar:${escapeHtml(tile.color)}">${escapeHtml(tile.initial)}</span>
        <strong>${escapeHtml(tile.name)}</strong>
      </div>
      <span class="sellerdit-supplier-tag">${escapeHtml(tile.category)}</span>
      <span class="sellerdit-supplier-link">바로가기 →</span>
    </a>`;
  }
  return `<article class="sellerdit-tile sellerdit-tile-community" data-tile-type="community" data-supplier-filter="community">
    <a class="sellerdit-tile-main" href="${escapeHtml(tile.href)}">
      <div class="sellerdit-tile-head">
        <span class="sellerdit-tile-avatar" style="--tile-avatar:${escapeHtml(tile.color)}">${escapeHtml(tile.initial)}</span>
        <strong>${escapeHtml(tile.name)}</strong>
      </div>
      <span class="sellerdit-tile-meta">멤버 ${formatInteger(tile.memberCount || 0)} · 글 ${formatInteger(tile.postsCount || 0)}</span>
      <p>${escapeHtml(tile.description)}</p>
    </a>
    <div class="sellerdit-tile-actions">
      <button type="button" class="${tile.joinedByMe ? "is-active" : ""}" data-community-membership data-community-slug="${escapeHtml(tile.slug)}">${tile.joinedByMe ? "가입됨" : "＋ 팔로우"}</button>
      <span>⋯</span>
    </div>
  </article>`;
}

function renderCommunitySupplierFilterRail() {
  const topItems = [
    ["home", "/community", "홈", false],
    ["popular", "/community?sort=hot", "인기", false],
    ["notice", "/community?tag=공지", "공지", false],
    ["explore", "/community", "둘러보기", false],
    ["create", "#community-write", "커뮤니티 만들기", false],
  ];
  const quickItems = [
    ["calc", "/", "로켓계산기"],
    ["trend", "/trends", "검색 트렌드"],
    ["guide", "/guides", "계산 기준"],
  ];
  const filters = [
    ["all", "전체 공급처", 24],
    ["agriculture", "농산물", 8],
    ["industrial", "공산품", 6],
    ["direct", "농수산 직매입", 4],
    ["china-market", "1688·타오바오", 3],
    ["wholesale", "국내 도매", 2],
    ["logistics", "물류·검수", 1],
  ];
  const renderNavItem = ([icon, href, label, active = false]) => `<a class="sellerdit-lnav-item ${active ? "is-active" : ""}" href="${href}"><span class="sellerdit-lnav-ic">${sellerditIcon(icon)}</span><span>${escapeHtml(label)}</span></a>`;
  const renderFilterItem = ([value, label, count], index) => `<button class="sellerdit-lnav-item sellerdit-supplier-filter-item ${index === 0 ? "is-active" : ""}" type="button" data-supplier-filter="${escapeHtml(value)}"><span>${escapeHtml(label)}</span><em class="sellerdit-lnav-count">${escapeHtml(String(count))}</em></button>`;
  return `<aside class="community-left-rail sellerdit-left-rail sellerdit-supplier-filter-rail" aria-label="셀러딧 왼쪽 메뉴">
    <nav class="sellerdit-lnav" aria-label="셀러딧 섹션">
      ${topItems.map(renderNavItem).join("")}
      <div class="sellerdit-lnav-sec">바로가기</div>
      ${quickItems.map(renderNavItem).join("")}
      <div class="sellerdit-lnav-sec sellerdit-supplier-lnav-sec">공급처 카테고리</div>
      ${filters.map(renderFilterItem).join("")}
      <p class="sellerdit-lnav-login-note">로그인하면 내 커뮤니티가 여기에 표시됩니다</p>
    </nav>
  </aside>`;
}

function renderCommunitySupplierDirectoryPage(query = {}, currentUser = null) {
  const title = "셀러딧 공급처";
  const description = "가입 운영 커뮤니티와 운영자가 등록한 공급처를 구분해 보는 셀러딧 공급처 카테고리입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/suppliers`;
  const tiles = getCommunitySupplierTiles(currentUser);
  const communityTiles = tiles.filter((tile) => tile.type === "community");
  const supplierTiles = tiles.filter((tile) => tile.type === "supplier");
  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `${renderCommunityHeader("suppliers")}
    <main class="community-shell">
      <section class="community-reddit-layout sellerdit-with-left-rail sellerdit-supplier-layout">
        ${renderCommunitySupplierFilterRail()}
        <section class="community-feed-panel sellerdit-supplier-main" aria-label="공급처">
          <section class="sellerdit-supplier-section" data-tile-section="community">
            <h2>가입 커뮤니티</h2>
            <div class="sellerdit-tile-grid">${communityTiles.map(renderCommunitySupplierTile).join("")}</div>
          </section>
          <section class="sellerdit-supplier-section" data-tile-section="supplier">
            <h2>운영자 등록 공급처</h2>
            <div class="sellerdit-tile-grid">${supplierTiles.map(renderCommunitySupplierTile).join("")}</div>
          </section>
        </section>
        <aside class="community-right-rail sellerdit-right-rail">
          ${renderPopularCommunitiesPanel()}
          ${renderSellerditFooterLinks()}
        </aside>
      </section>
    </main>`,
    jsonLd: null,
    script: renderCommunityScript(),
  });
}

function renderCommunityAiAnswerPage(query = {}) {
  const search = String(query.q || "").trim().slice(0, 80);
  const qnaPosts = getCommunityPosts({ category: "qna", notice: false, sort: "hot", limit: 8 });
  const title = "셀러딧 AI 답변";
  const description = "쿠팡셀러와 개인셀러의 로켓그로스 비용, 사입, 물류, 수수료 질문을 AI 답변형으로 정리하는 셀러딧 질문답변 화면입니다.";
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/qna`;
  const answerTitle = search || "터미널 운송료는 무슨 비용인가요?";
  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("qna")}
      <section class="community-workspace community-reddit-layout sellerdit-ai-layout sellerdit-with-left-rail sellerdit-no-right-rail">
        ${renderCommunityLeftRail("qna", currentUser)}
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

function renderCommunityCategoryPage(categorySlug, query = {}, currentUser = null) {
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
  const posts = attachCommunityPostsState(getCommunityPosts({ ...feedOptions, limit: pageSize, offset: (page - 1) * pageSize }), currentUser);
  const notices =
    !search && page === 1 ? getCommunityPosts({ category: category.slug, notice: true, sort: "new", limit: 3 }) : [];
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/${category.slug}`;
  const heading = search ? `‘${search}’ 검색 결과` : category.title;
  const subLabel = search ? `${category.label} · ${formatInteger(total)}개` : category.label;

  return renderDocumentShell({
    title: `${category.title} | 셀러딧 커뮤니티`,
    description: category.description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader(category.slug)}
      <section class="community-workspace community-reddit-layout">
        ${renderCommunityLeftRail(category.slug, currentUser)}
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
          ${renderCommunityWritePanel(category.slug)}
        </section>
        ${renderSellerditRightRail("list")}
      </section>
    </main>`,
    jsonLd: buildCommunityCategoryJsonLd(category, canonicalUrl, posts),
    script: renderCommunityScript(),
  });
}

function renderCommunityPostPage(post, currentUser = null) {
  const canonicalUrl = `${PUBLIC_SITE_URL}/community/${post.slug}`;
  post = attachCommunityPostState(post, currentUser);
  const comments = attachCommunityCommentsState(getCommunityCommentTree(post.id), currentUser);
  const displayComments = comments.length ? comments : getSampleCommunityComments(post);
  const commentCount = comments.length ? countRenderedComments(comments) : countRenderedComments(displayComments);
  const relatedPosts = getCommunityPosts({ category: post.category, limit: 5 }).filter((item) => item.id !== post.id).slice(0, 4);
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];
  const threadContent = getThreadDisplayContent(post);
  const seoTitle = getThreadPostSeoTitle(post);
  const seoDescription = getThreadSummaryFromText(threadContent);

  return renderDocumentShell({
    title: `${seoTitle} | 셀러딧 커뮤니티`,
    description: seoDescription,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader(post.category)}
      <section class="community-workspace community-reddit-layout sellerdit-with-left-rail is-post-detail">
        ${renderCommunityLeftRail("community", currentUser)}
        <section class="community-detail-main">
          <div class="sellerdit-mobile-detailbar"><a href="/community" aria-label="목록으로 돌아가기">←</a></div>
          <article class="community-post-article sellerdit-detail-post" data-community-post="${escapeHtml(post.slug)}">
            <div class="sellerdit-post-meta">
              <span class="sellerdit-avatar" style="background:${escapeHtml(getCommunityAuthorColor(post.authorName))}">${escapeHtml(getCommunityAuthorInitial(post.authorName))}</span>
              <a class="sellerdit-author" href="/u/${escapeHtml(makeCommunityHandle(post.authorName))}">u/${escapeHtml(makeCommunityHandle(post.authorName))}</a>
              <span class="sellerdit-dot">·</span>
              <time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(formatRelativeDate(post.createdAt) || "")}</time>
              <span class="sellerdit-dot sellerdit-detail-views-dot">·</span>
              <span class="sellerdit-detail-views">조회 ${formatInteger(post.views)}</span>
              <button class="sellerdit-follow" type="button">팔로우</button>
              <span class="sellerdit-more">⋯</span>
            </div>
            <div class="sellerdit-thread-body is-detail">${escapeHtml(threadContent)}</div>
            ${renderCommunityDetailMedia(post)}
            ${renderCommunityActions(post, { commentsCount: commentCount, commentsHref: "#comments", detail: true, extraActions: post.canEdit ? `<button type="button" class="sellerdit-action" data-community-edit-post data-post-id="${escapeHtml(post.id)}" data-post-body="${escapeHtml(threadContent)}" data-post-category="${escapeHtml(post.category)}" data-post-tags="${escapeHtml((post.tags || []).join(", "))}">수정</button><button type="button" class="sellerdit-action" data-community-delete-post data-post-id="${escapeHtml(post.id)}">삭제</button>` : "" })}
          </article>
          ${renderCommunityDetailPromo()}
          <section class="community-comments sellerdit-comments" id="comments" aria-labelledby="community-comments-title">
            <header class="community-comments-head sellerdit-comments-titlebar">
              <strong id="community-comments-title">댓글 ${formatInteger(commentCount)}개</strong>
            </header>
            <form class="community-comment-form sellerdit-composer sellerdit-pill-composer" data-community-comment-form data-post-slug="${escapeHtml(post.slug)}">
              <textarea name="body" rows="1" maxlength="1500" placeholder="대화에 참여해보세요" aria-label="댓글 입력"></textarea>
              <div class="sellerdit-composer-actions">
                <a class="community-comment-login" href="/auth/kakao/start?returnTo=${encodeURIComponent(`/community/${post.slug}#comments`)}">카카오로 시작하기</a>
                <p data-community-message></p>
                <button class="primary-small-button" type="submit">댓글 남기기</button>
              </div>
            </form>
            <div class="comment-sort sellerdit-comment-sortbar"><span>정렬 기준: <b>좋아요 비율 높은 순 ▾</b></span></div>
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

function renderCommunityDetailPromo() {
  return `<aside class="sellerdit-detail-promo promo" aria-label="홍보 광고">
    <div class="promo-head"><span class="pavatar sellerdit-avatar" style="background:#1f2937">E</span><span class="uname sellerdit-author">SellerERP</span><span class="dot sellerdit-dot">·</span><span class="ad-tag">홍보 광고</span><span class="dots sellerdit-more">⋯</span></div>
    <div class="promo-body">재고·정산·마진을 한 화면에서 — 셀러 ERP 무료 체험</div>
    <svg class="promo-img" viewBox="0 0 600 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SellerERP 미리보기">
      <rect width="600" height="180" rx="10" fill="#f8fafc"/>
      <rect x="34" y="32" width="154" height="116" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
      <rect x="54" y="54" width="112" height="10" rx="5" fill="#2563eb" opacity=".82"/>
      <rect x="54" y="80" width="88" height="8" rx="4" fill="#cbd5e1"/>
      <rect x="54" y="102" width="108" height="8" rx="4" fill="#cbd5e1"/>
      <rect x="224" y="32" width="154" height="116" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
      <rect x="246" y="58" width="54" height="54" rx="8" fill="#22c55e" opacity=".72"/>
      <rect x="314" y="66" width="40" height="8" rx="4" fill="#cbd5e1"/>
      <rect x="314" y="86" width="32" height="8" rx="4" fill="#cbd5e1"/>
      <rect x="414" y="32" width="154" height="116" rx="10" fill="#ffffff" stroke="#e5e7eb"/>
      <rect x="436" y="58" width="94" height="14" rx="7" fill="#f59e0b" opacity=".76"/>
      <rect x="436" y="88" width="72" height="8" rx="4" fill="#cbd5e1"/>
      <rect x="436" y="108" width="86" height="8" rx="4" fill="#cbd5e1"/>
    </svg>
    <div class="promo-foot"><span>sellererp.app</span><a class="go" href="/" rel="nofollow">더 알아보기</a></div>
  </aside>`;
}

function renderCommunityCommentTopAd() {
  return renderCommunityDetailPromo();
}
function renderCommunityCommentInlineAd() {
  return `<aside class="ad-banner sellerdit-comment-ad is-inline" aria-label="댓글 중간 광고">
    <span class="ico">🧮</span>
    <div><div class="t">마진 계산이 헷갈린다면? 로켓그로스 계산기 <span class="ad-tag">· 광고</span></div><div class="s">사입·물류·수수료까지 한 화면에서 확인하세요.</div></div>
    <a class="go" href="/">계산기 열기</a>
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
  const commentId = escapeHtml(comment.id || "");
  const commentUrl = `/community/${escapeHtml(post.slug)}#comment-${commentId}`;
  const body = `<article id="comment-${commentId}" class="sellerdit-comment c ${depth > 0 ? "is-reply" : ""}" data-comment-id="${commentId}">
    <button type="button" class="sellerdit-comment-collapse" aria-label="댓글 접기" data-comment-collapse>−</button>
    <span class="sellerdit-avatar avatar" style="background:${escapeHtml(getCommunityAuthorColor(authorName))}">${escapeHtml(getCommunityAuthorInitial(authorName))}</span>
    <div class="sellerdit-comment-body body">
      <header class="chead">
        <a class="sellerdit-author cauthor" href="/u/${escapeHtml(handle)}">${escapeHtml(handle)}</a>
        ${badge ? `<span class="sellerdit-comment-badge cbadge ${isAuthor || badge === "원글 작성자" ? "is-author op" : "top"}">${escapeHtml(badge)}</span>` : ""}
        <span class="sellerdit-dot dot">·</span>
        <time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDate(comment.createdAt) || "방금 전")}</time>
      </header>
      <p class="ctext">${escapeHtml(comment.body)}</p>
      <footer class="cactions">
        <button type="button" class="sellerdit-comment-action cv ${comment.likedByMe ? "is-active" : ""}" aria-label="좋아요" data-community-comment-reaction data-comment-id="${commentId}">${renderCommunityActionIcon("like")}<span data-comment-reaction-count>${formatInteger(comment.likesCount || 0)}</span></button>
        <button type="button" class="sellerdit-comment-action cbtn" data-comment-reply-button data-parent-id="${commentId}">${renderCommunityActionIcon("comment")}<span>답글 달기</span></button>
        <button type="button" class="sellerdit-comment-action cbtn" data-comment-award>⚭<span>어워드</span></button>
        <button type="button" class="sellerdit-comment-action cbtn" data-comment-share data-share-url="${commentUrl}">${renderCommunityActionIcon("share")}<span>공유</span></button>
        ${comment.canEdit ? `<button type="button" class="sellerdit-comment-action cbtn" data-comment-edit-button data-comment-id="${commentId}">수정</button><button type="button" class="sellerdit-comment-action cbtn" data-comment-delete-button data-comment-id="${commentId}">삭제</button>` : `<button type="button" class="sellerdit-comment-action cbtn is-more" aria-label="더 보기">...</button>`}
      </footer>
      <form class="community-comment-form sellerdit-reply-form" data-comment-edit-form data-comment-id="${commentId}" hidden>
        <textarea name="body" rows="2" maxlength="1500">${escapeHtml(comment.body)}</textarea>
        <div class="sellerdit-reply-actions">
          <p data-community-message></p>
          <button type="button" data-comment-edit-cancel>취소</button>
          <button class="primary-small-button" type="submit">수정 저장</button>
        </div>
      </form>
      <form class="community-comment-form sellerdit-reply-form" data-community-comment-form data-post-slug="${escapeHtml(post.slug)}" data-parent-id="${commentId}" hidden>
        <textarea name="body" rows="2" maxlength="1500" placeholder="${escapeHtml(handle)}님에게 답글 남기기"></textarea>
        <div class="sellerdit-reply-actions">
          <p data-community-message></p>
          <button type="button" data-comment-reply-cancel>취소</button>
          <button class="primary-small-button" type="submit">답글 등록</button>
        </div>
      </form>
      ${replies.length ? `<div class="sellerdit-replies reply" data-replies-group>${renderSellerditComments(replies, post, depth + 1)}<button class="more-replies" type="button" aria-expanded="true" data-replies-toggle><span class="plus" aria-hidden="true"></span><span>답글 ${formatInteger(replies.length)}개 접기</span></button></div>` : ""}
    </div>
  </article>`;
  return body;
}
function getCommunityCommentsByHandle(handle) {
  const normalizedHandle = makeCommunityHandle(handle || "seller");
  return db.prepare(`SELECT c.*, p.slug AS post_slug, p.title AS post_title
    FROM community_comments c
    JOIN community_posts p ON p.id = c.post_id
    WHERE p.status = 'published'
    ORDER BY c.created_at DESC
    LIMIT 100`).all()
    .map((row) => ({ ...communityCommentFromRow(row), postSlug: row.post_slug, postTitle: row.post_title }))
    .filter((comment) => makeCommunityHandle(comment.authorName) === normalizedHandle);
}

function renderProfileComments(comments) {
  if (!comments.length) return `<div class="community-feed-empty">아직 공개된 댓글이 없습니다.</div>`;
  return `<div class="community-vote-list sellerdit-feedpanel sellerdit-profile-feed-list" style="border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;box-shadow:none!important">${comments.map((comment) => `<article class="community-vote-card sellerdit-feed-post"><div class="sellerdit-post-meta"><a class="sellerdit-author" href="/community/${escapeHtml(comment.postSlug)}#comments">${escapeHtml(comment.postTitle)}</a><span class="sellerdit-dot">·</span><time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDate(comment.createdAt) || "")}</time></div><p class="sellerdit-post-excerpt">${escapeHtml(comment.body)}</p></article>`).join("")}</div>`;
}

function renderSellerditProfilePage(handle, query = {}, currentUser = null) {
  const normalizedHandle = makeCommunityHandle(handle || "seller");
  const posts = attachCommunityPostsState(getCommunityPosts({ limit: 100, sort: "new" }).filter((post) => makeCommunityHandle(post.authorName) === normalizedHandle), currentUser);
  const userComments = getCommunityCommentsByHandle(normalizedHandle);
  const displayName = posts[0]?.authorName || userComments[0]?.authorName || normalizedHandle;
  const likes = posts.reduce((sum, post) => sum + Number(post.likesCount || 0), 0);
  const comments = userComments.length;
  const tab = ["posts", "comments"].includes(String(query.tab || "")) ? String(query.tab) : "posts";
  const isMe = Boolean(currentUser && makeCommunityHandle(getDisplayUserName(currentUser)) === normalizedHandle);
  const title = `u/${normalizedHandle} | 셀러딧 프로필`;
  const description = `셀러딧 사용자 u/${normalizedHandle}의 게시물과 활동 요약입니다.`;
  const canonicalUrl = `${PUBLIC_SITE_URL}/u/${encodeURIComponent(normalizedHandle)}`;

  return renderDocumentShell({
    title,
    description,
    canonicalUrl,
    body: `<main class="community-shell">
      ${renderCommunityHeader("community")}
      <section class="community-workspace community-reddit-layout sellerdit-profile-layout sellerdit-with-left-rail">
        ${renderCommunityLeftRail("community", currentUser)}
        <section class="community-feed-panel sellerdit-profile-main" aria-labelledby="sellerdit-profile-title">
          <header class="sellerdit-profile-header" style="${escapeHtml(getCommunityAuthorStyle(displayName))}">
            <span class="sellerdit-profile-avatar" style="background:${escapeHtml(getCommunityAuthorColor(displayName))}">${escapeHtml(getCommunityAuthorInitial(displayName))}</span>
            <div class="sellerdit-profile-summary">
              <h1 id="sellerdit-profile-title">${escapeHtml(displayName)}</h1>
              <p>u/${escapeHtml(normalizedHandle)} · 🍰 가입일 2026년 6월 22일</p>
              <dl aria-label="프로필 요약">
                <div><dt>받은 좋아요</dt><dd>${formatInteger(likes)}</dd></div>
                <div><dt>게시물</dt><dd>${formatInteger(posts.length)}</dd></div>
                <div><dt>댓글 카르마</dt><dd>${formatInteger(comments)}</dd></div>
              </dl>
            </div>
            <div class="sellerdit-profile-actions">${isMe ? `<a class="sellerdit-follow" href="#community-write">글쓰기</a><button class="sellerdit-follow" type="button">설정</button>` : `<button class="sellerdit-follow" type="button">팔로우</button>`}</div>
            <span class="sellerdit-more">⋯</span>
          </header>
          <nav class="sellerdit-profile-tabs" aria-label="프로필 탭">
            <a class="${tab === "posts" ? "is-active" : ""}" href="/u/${escapeHtml(normalizedHandle)}?tab=posts">게시물</a>
            <a class="${tab === "comments" ? "is-active" : ""}" href="/u/${escapeHtml(normalizedHandle)}?tab=comments">댓글</a>
          </nav>
          ${tab === "comments" ? renderProfileComments(userComments) : renderCommunityFeed(posts, "아직 공개된 게시물이 없습니다.").replace('class="community-vote-list sellerdit-feedpanel"', 'class="community-vote-list sellerdit-feedpanel sellerdit-profile-feed-list" style="border:0!important;border-radius:0!important;padding:0!important;background:transparent!important;box-shadow:none!important"')}
          ${isMe ? renderCommunityWritePanel() : ""}
        </section>
        <aside class="community-right-rail sellerdit-right-rail sellerdit-profile-side">
          <section class="sellerdit-profile-card" style="${escapeHtml(getCommunityAuthorStyle(displayName))}">
            <span class="sellerdit-profile-avatar is-small" style="background:${escapeHtml(getCommunityAuthorColor(displayName))}">${escapeHtml(getCommunityAuthorInitial(displayName))}</span>
            <strong>u/${escapeHtml(normalizedHandle)}</strong>
            <p>🍰 2026년 6월 22일 가입 · 카르마 ${formatInteger(likes + comments)}</p>
            <a href="/community">r/셀러딧으로 돌아가기</a>
            ${isMe ? "" : `<button class="sellerdit-follow" type="button">팔로우</button>`}
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
  return `<header class="community-topbar sellerdit-topbar sellerdit-reddit-topbar" data-active-section="${escapeHtml(activeKey || "community")}">
    <div class="sellerdit-topbar-inner">
      <button class="sellerdit-mobile-icon topbar-hamburger" type="button" aria-label="왼쪽 메뉴 토글" aria-controls="sellerdit-mobile-drawer" aria-expanded="false" data-mobile-drawer-open>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <a class="community-brand" href="/community"><span class="sellerdit-brand-mark">S</span><strong>셀러딧</strong></a>
      <form class="community-global-search sellerdit-reddit-search" method="get" action="/community/search" role="search" data-mobile-search>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.8 3.5a5.3 5.3 0 1 0 0 10.6 5.3 5.3 0 0 0 0-10.6Zm0 1.6a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4Zm4.2 8.7 3.2 3.2 1.1-1.1-3.2-3.2-1.1 1.1Z" fill="currentColor"/></svg>
        <input type="search" name="q" placeholder="커뮤니티 검색" aria-label="커뮤니티 전체 검색" />
        <button class="sellerdit-mobile-search-close" type="button" aria-label="검색 닫기" data-mobile-search-close>×</button>
      </form>
      <div class="sellerdit-reddit-actions" aria-label="상단 작업">
        <button class="sellerdit-mobile-icon sellerdit-mobile-search-trigger" type="button" aria-label="검색 열기" data-mobile-search-open>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM15 15l4 4"/></svg>
        </button>
        <a class="sellerdit-reddit-icon sellerdit-chat-desktop" href="/community?chat=1" aria-label="채팅" title="채팅">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.4 8.5 8.5 0 0 1-3.9-.9L3 21l1.9-5.1A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z"/></svg>
        </a>
        <a class="sellerdit-create-pill sellerdit-create-desktop" href="#community-write" aria-label="게시물 만들기"><span>⊕</span>만들기</a>
        <a class="sellerdit-reddit-icon sellerdit-notification-desktop" href="/api/community/notifications" aria-label="알림" title="알림">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M9.8 21a2.4 2.4 0 0 0 4.4 0"/></svg>
        </a>
        <a class="sellerdit-avatar-button sellerdit-kakao" href="/auth/kakao/start" data-auth-button aria-label="프로필 또는 로그인">카카오 로그인</a>
        <a class="sellerdit-open-app-pill" href="/auth/kakao/start" data-auth-button aria-label="로그인">로그인</a>
        <span class="sellerdit-mobile-dots" aria-hidden="true">•••</span>
        <button class="sellerdit-logout" type="button" data-auth-logout hidden>로그아웃</button>
      </div>
      <div class="sellerdit-mobile-filterbar" aria-label="피드 필터">
        <a href="/community?sort=hot">좋아요 비율 높은 순 <span>⌄</span></a>
        <a href="/community">전 세계 <span>⌄</span></a>
        <a href="/community?view=card" aria-label="보기 방식">▭ <span>⌄</span></a>
      </div>
    </div>
  </header>
  <div class="sellerdit-mobile-drawer-overlay" data-mobile-drawer-close hidden></div>
  <nav class="sellerdit-bottom-tab" aria-label="셀러딧 하단 탭">
    <a class="${activeKey === "community" ? "is-active" : ""}" href="/community"><span>⌂</span><em>홈</em></a>
    <a href="/community?sort=hot"><span>⌕</span><em>둘러보기</em></a>
    <a class="is-create" href="#community-write" aria-label="글쓰기"><span>＋</span><em>글쓰기</em></a>
    <a href="/api/community/notifications"><span>♡</span><em>알림</em></a>
    <a href="/auth/kakao/start" data-auth-button-mobile><span>●</span><em>프로필</em></a>
  </nav>`;
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
      <span class="community-post-title">${escapeHtml(getThreadPostSeoTitle(post, 100))}</span>
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

  return `<div id="community-write" class="community-write-modal" data-community-write-modal hidden>
    <div class="community-write-backdrop" data-community-write-close></div>
    <section class="community-write-panel" role="dialog" aria-modal="true" aria-labelledby="community-write-title">
      <header class="community-write-modal-head">
        <div><span>글쓰기</span><strong id="community-write-title">질문 남기기</strong></div>
        <button type="button" aria-label="닫기" data-community-write-close>×</button>
      </header>
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
          <span>본문</span>
          <textarea name="body" rows="7" maxlength="5000" placeholder="셀러들과 나누고 싶은 이야기나 질문을 적어보세요" required></textarea>
        </label>
        <label>
          <span>이미지 URL</span>
          <input name="imageUrl" maxlength="500" placeholder="선택: https://..." />
        </label>
        <label>
          <span>태그</span>
          <input name="tags" placeholder="로켓그로스, 중국사입, LCL" />
        </label>
        <div class="community-write-submit-row">
          <p data-community-message></p>
          <button type="button" data-community-write-close>취소</button>
          <button class="primary-small-button" type="submit">글 등록</button>
        </div>
      </form>
    </section>
  </div>`;
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

function getTrendPageBaseLabel(trends) {
  const dates = (trends.providers || [])
    .map((provider) => (provider.updatedAt ? new Date(provider.updatedAt) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()));
  if (!dates.length) return "기준시간 대기 · 10분 캐시로 갱신합니다.";
  const latest = new Date(Math.max(...dates.map((date) => date.getTime())));
  return `${formatTrendBaseTime(latest.toISOString())} · 10분 캐시로 갱신합니다.`;
}

function buildNaverFallbackTrendItems() {
  return TREND_KEYWORD_GROUPS.map((group, index) => ({
    title: group.title,
    traffic: `관심도 ${100 - index * 8}`,
    url: buildTrendSearchUrl("naver", group.title),
  })).slice(0, 10);
}

function renderTrendPage(trends) {
  const title = "셀러 검색어 순위 | 셀러딧";
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
          <p data-trend-base-summary>${escapeHtml(getTrendPageBaseLabel(trends))}</p>
        </div>
        <div class="trend-provider-grid" data-trend-grid>
          ${trends.providers.map(renderTrendProviderCard).join("")}
        </div>
        <section class="trend-note-panel">
          <strong>운영 기준</strong>
          <p>구글은 트렌딩 RSS, 네이버는 데이터랩 관심도, Daum은 구글 트렌딩 키워드의 Daum 검색 결과량 기준으로 표시합니다. 플랫폼 정책에 따라 표시 방식은 달라질 수 있습니다.</p>
        </section>
      </section>
    </main>`,
    jsonLd: buildTrendPageJsonLd(title, description, canonicalUrl, trends),
    script: renderTrendScript(),
  });
}

function renderTrendProviderCard(provider) {
  const items = provider.items.slice(0, 10);
  return `<article class="trend-provider-card" data-trend-provider="${escapeHtml(provider.key)}">
    <header>
      <div>
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
      function trendSummary(data) {
        var times = (data.providers || []).map(function (provider) {
          var date = provider.updatedAt ? new Date(provider.updatedAt) : null;
          return date && !Number.isNaN(date.getTime()) ? date.getTime() : null;
        }).filter(function (time) { return time !== null; });
        if (!times.length) return "기준시간 대기 · 10분 캐시로 갱신합니다.";
        return trendBaseTime(new Date(Math.max.apply(Math, times)).toISOString()) + " · 10분 캐시로 갱신합니다.";
      }
      function trendSearchUrl(providerKey, title) {
        var query = encodeURIComponent(title || "");
        if (!query) return "";
        if (providerKey === "naver") return "https://search.naver.com/search.naver?query=" + query;
        if (providerKey === "daum") return "https://search.daum.net/search?w=tot&q=" + query;
        return "https://www.google.com/search?q=" + query;
      }
      function renderProvider(provider) {
        var list = (provider.items || []).slice(0, 10);
        return '<article class="trend-provider-card" data-trend-provider="' + escapeText(provider.key) + '">' +
          '<header><div><h2>' + escapeText(provider.label) + '</h2></div></header>' +
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
          var summary = document.querySelector("[data-trend-base-summary]");
          if (summary) summary.textContent = trendSummary(data);
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

      var drawer = document.querySelector("#sellerdit-mobile-drawer");
      var drawerOverlay = document.querySelector("[data-mobile-drawer-close].sellerdit-mobile-drawer-overlay, .sellerdit-mobile-drawer-overlay[data-mobile-drawer-close]");
      var drawerOpenButton = document.querySelector("[data-mobile-drawer-open]");
      function setDrawer(open) {
        document.body.classList.toggle("sellerdit-drawer-open", Boolean(open));
        drawer && drawer.setAttribute("aria-hidden", open ? "false" : "true");
        drawerOpenButton && drawerOpenButton.setAttribute("aria-expanded", open ? "true" : "false");
        if (drawerOverlay) drawerOverlay.hidden = !open;
      }
      drawerOpenButton && drawerOpenButton.addEventListener("click", function () {
        if (window.matchMedia && window.matchMedia("(min-width: 1024px)").matches) {
          var collapsed = !document.body.classList.contains("sellerdit-sidebar-collapsed");
          document.body.classList.toggle("sellerdit-sidebar-collapsed", collapsed);
          drawerOpenButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
          drawer && drawer.setAttribute("aria-hidden", collapsed ? "true" : "false");
          return;
        }
        setDrawer(true);
      });
      document.querySelectorAll("[data-mobile-drawer-close]").forEach(function (button) {
        button.addEventListener("click", function () { setDrawer(false); });
      });
      drawer && drawer.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () { setDrawer(false); });
      });
      var mobileSearch = document.querySelector("[data-mobile-search]");
      document.querySelector("[data-mobile-search-open]")?.addEventListener("click", function () {
        document.body.classList.add("sellerdit-search-open");
        var input = mobileSearch && mobileSearch.querySelector("input[type='search']");
        input && input.focus();
      });
      document.querySelector("[data-mobile-search-close]")?.addEventListener("click", function () {
        document.body.classList.remove("sellerdit-search-open");
      });

      var mobileAuthButton = document.querySelector("[data-auth-button-mobile]");
      if (mobileAuthButton) mobileAuthButton.href = loginUrl();

      var writeModal = document.querySelector("[data-community-write-modal]");
      function openWriteModal() {
        if (!writeModal) return;
        writeModal.hidden = false;
        document.body.classList.add("community-write-open");
        var firstInput = writeModal.querySelector("textarea[name='body'], select");
        firstInput && firstInput.focus();
      }
      function closeWriteModal() {
        if (!writeModal) return;
        writeModal.hidden = true;
        document.body.classList.remove("community-write-open");
        var form = writeModal.querySelector("[data-community-post-form]");
        if (form) {
          form.dataset.editPostId = "";
          form.reset();
          var submit = form.querySelector("button[type='submit']");
          if (submit) submit.textContent = "글 등록";
        }
      }
      function openEditModal(button) {
        if (!writeModal) return;
        var form = writeModal.querySelector("[data-community-post-form]");
        if (!form) return;
        form.dataset.editPostId = button.dataset.postId || "";
        form.querySelector("select[name='category']").value = button.dataset.postCategory || "final-margin";
                form.querySelector("textarea[name='body']").value = button.dataset.postBody || "";
        var tags = form.querySelector("input[name='tags']");
        if (tags) tags.value = button.dataset.postTags || "";
        var submit = form.querySelector("button[type='submit']");
        if (submit) submit.textContent = "수정 저장";
        openWriteModal();
      }
      document.querySelectorAll("a[href='#community-write']").forEach(function (link) {
        link.addEventListener("click", function (event) {
          event.preventDefault();
          openWriteModal();
        });
      });
      document.querySelectorAll("[data-community-edit-post]").forEach(function (button) {
        button.addEventListener("click", function () { openEditModal(button); });
      });
      document.querySelectorAll("[data-community-delete-post]").forEach(function (button) {
        button.addEventListener("click", async function () {
          if (!window.confirm("게시글을 삭제할까요?")) return;
          var response = await fetch("/api/community/posts/" + encodeURIComponent(button.dataset.postId), { method: "DELETE", credentials: "same-origin" });
          if (response.status === 401) { window.location.href = loginUrl(); return; }
          if (!response.ok) { window.alert("삭제하지 못했습니다."); return; }
          window.location.href = "/community";
        });
      });
      document.querySelectorAll("[data-community-write-close]").forEach(function (button) {
        button.addEventListener("click", closeWriteModal);
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeWriteModal();
      });

      document.querySelectorAll("[data-comment-reply-button]").forEach(function (button) {
        button.addEventListener("click", function () {
          var comment = button.closest("article.sellerdit-comment");
          var form = comment && comment.querySelector("form[data-community-comment-form][data-parent-id]");
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


      function setupSupplierFilters() {
        var tiles = Array.prototype.slice.call(document.querySelectorAll(".sellerdit-supplier-main [data-tile-type]"));
        var buttons = Array.prototype.slice.call(document.querySelectorAll(".sellerdit-supplier-filter-rail [data-supplier-filter]"));
        var sections = Array.prototype.slice.call(document.querySelectorAll(".sellerdit-supplier-main [data-tile-section]"));
        if (!tiles.length || !buttons.length) return;
        function applyFilter(value) {
          buttons.forEach(function (button) {
            if (button.disabled) return;
            button.classList.toggle("is-active", button.dataset.supplierFilter === value);
          });
          tiles.forEach(function (tile) {
            var tileType = tile.dataset.tileType || "";
            var tags = (tile.dataset.supplierFilter || "").split(/\\s+/);
            var visible = value === "all" || (value === "community" ? tileType === "community" : tags.indexOf(value) !== -1);
            tile.hidden = !visible;
          });
          sections.forEach(function (section) {
            var visibleTiles = Array.prototype.slice.call(section.querySelectorAll("[data-tile-type]")).filter(function (tile) {
              return !tile.hidden;
            });
            section.hidden = visibleTiles.length === 0;
          });
        }
        buttons.forEach(function (button) {
          button.addEventListener("click", function () {
            if (button.disabled) return;
            applyFilter(button.dataset.supplierFilter || "all");
          });
        });
        applyFilter("all");
      }

      setupSupplierFilters();
      document.querySelectorAll("[data-community-membership]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var beforeText = button.textContent;
          var beforeActive = button.classList.contains("is-active");
          button.classList.toggle("is-active", !beforeActive);
          button.textContent = beforeActive ? "＋ 팔로우" : "가입됨";
          try {
            var response = await fetch("/api/community/memberships", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: button.dataset.communitySlug || "" })
            });
            if (response.status === 401) { window.location.href = loginUrl(); return; }
            if (!response.ok) throw new Error("membership_failed");
          } catch {
            button.classList.toggle("is-active", beforeActive);
            button.textContent = beforeText;
          }
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
            body: data.get("body"),
            imageUrl: data.get("imageUrl"),
            tags: String(data.get("tags") || "").split(",").map(function (tag) { return tag.trim(); }).filter(Boolean)
          };
          try {
            var editPostId = form.dataset.editPostId || "";
            var response = await fetch(editPostId ? "/api/community/posts/" + encodeURIComponent(editPostId) : "/api/community/posts", {
              method: editPostId ? "PUT" : "POST",
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

      document.querySelectorAll("[data-community-follow]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var beforeText = button.textContent;
          var beforeActive = button.classList.contains("is-active");
          button.classList.toggle("is-active", !beforeActive);
          button.textContent = beforeActive ? "팔로우" : "팔로잉";
          try {
            var response = await fetch("/api/community/follow", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ handle: button.dataset.followHandle || "" })
            });
            if (response.status === 401) { window.location.href = loginUrl(); return; }
            if (!response.ok) throw new Error("follow_failed");
          } catch {
            button.classList.toggle("is-active", beforeActive);
            button.textContent = beforeText;
          }
        });
      });

      document.querySelectorAll("[data-community-share]").forEach(function (button) {
        button.addEventListener("click", function () {
          var url = new URL(button.dataset.shareUrl || window.location.pathname, window.location.origin).toString();
          var beforeText = button.textContent;
          try {
            var input = document.createElement("input");
            input.value = url;
            input.setAttribute("readonly", "readonly");
            input.style.position = "fixed";
            input.style.left = "-9999px";
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
            button.textContent = "링크 복사됨";
            window.setTimeout(function () { button.textContent = beforeText; }, 1400);
          } catch {
            button.textContent = "링크 복사 실패";
            window.setTimeout(function () { button.textContent = beforeText; }, 1400);
          }
        });
      });

      document.querySelectorAll("[data-comment-collapse]").forEach(function (button) {
        button.addEventListener("click", function () {
          var comment = button.closest("article.sellerdit-comment");
          if (!comment) return;
          var collapsed = comment.classList.toggle("is-collapsed");
          button.textContent = collapsed ? "+" : "−";
          button.setAttribute("aria-label", collapsed ? "댓글 펼치기" : "댓글 접기");
        });
      });

      document.querySelectorAll("[data-comment-award]").forEach(function (button) {
        button.addEventListener("click", function () {
          var active = button.classList.toggle("is-active");
          var label = button.querySelector("span");
          if (label) label.textContent = active ? "어워드됨" : "어워드";
        });
      });

      document.querySelectorAll("[data-comment-downvote]").forEach(function (button) {
        button.addEventListener("click", function () {
          button.classList.toggle("is-active");
        });
      });

      document.querySelectorAll("[data-comment-share]").forEach(function (button) {
        button.addEventListener("click", function () {
          var url = new URL(button.dataset.shareUrl || window.location.pathname, window.location.origin).toString();
          var beforeText = button.textContent;
          try {
            var input = document.createElement("input");
            input.value = url;
            input.setAttribute("readonly", "readonly");
            input.style.position = "fixed";
            input.style.left = "-9999px";
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
            button.textContent = "복사됨";
            window.setTimeout(function () { button.textContent = beforeText; }, 1200);
          } catch {
            button.textContent = "실패";
            window.setTimeout(function () { button.textContent = beforeText; }, 1200);
          }
        });
      });

      document.querySelectorAll("[data-replies-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
          var group = button.closest("[data-replies-group]");
          if (!group) return;
          var collapsed = group.classList.toggle("is-replies-collapsed");
          var replyCount = group.querySelectorAll(":scope > article.sellerdit-comment").length || 1;
          var label = button.querySelector("span:last-child");
          button.setAttribute("aria-expanded", collapsed ? "false" : "true");
          if (label) label.textContent = "답글 " + replyCount + "개 " + (collapsed ? "펼치기" : "접기");
        });
      });

      document.querySelectorAll("[data-comment-edit-button]").forEach(function (button) {
        button.addEventListener("click", function () {
          var comment = button.closest("article.sellerdit-comment");
          var form = comment && comment.querySelector("[data-comment-edit-form]");
          if (form) { form.hidden = !form.hidden; form.querySelector("textarea")?.focus(); }
        });
      });
      document.querySelectorAll("[data-comment-edit-cancel]").forEach(function (button) {
        button.addEventListener("click", function () {
          var form = button.closest("[data-comment-edit-form]");
          if (form) form.hidden = true;
        });
      });
      document.querySelectorAll("[data-comment-edit-form]").forEach(function (form) {
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          var textarea = form.querySelector("textarea");
          var response = await fetch("/api/community/comments/" + encodeURIComponent(form.dataset.commentId), { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: textarea.value }) });
          if (response.status === 401) { window.location.href = loginUrl(); return; }
          if (!response.ok) { setMessage(form, "댓글을 수정하지 못했습니다.", "warning"); return; }
          window.location.reload();
        });
      });
      document.querySelectorAll("[data-comment-delete-button]").forEach(function (button) {
        button.addEventListener("click", async function () {
          if (!window.confirm("댓글을 삭제할까요?")) return;
          var response = await fetch("/api/community/comments/" + encodeURIComponent(button.dataset.commentId), { method: "DELETE", credentials: "same-origin" });
          if (response.status === 401) { window.location.href = loginUrl(); return; }
          if (!response.ok) { window.alert("댓글을 삭제하지 못했습니다."); return; }
          window.location.reload();
        });
      });
      document.querySelectorAll("[data-community-comment-reaction]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var beforeActive = button.classList.contains("is-active");
          var countNode = button.querySelector("[data-comment-reaction-count]");
          var raw = parseInt((countNode?.textContent || "0").replace(/,/g, ""), 10) || 0;
          if (countNode) countNode.textContent = String(Math.max(0, raw + (beforeActive ? -1 : 1))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          button.classList.toggle("is-active", !beforeActive);
          try {
            var response = await fetch("/api/community/comment-reactions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId: button.dataset.commentId }) });
            if (response.status === 401) { window.location.href = loginUrl(); return; }
            if (!response.ok) throw new Error("failed");
          } catch {
            if (countNode) countNode.textContent = String(raw);
            button.classList.toggle("is-active", beforeActive);
          }
        });
      });

      document.querySelectorAll("[data-community-reaction]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var countNode = button.querySelector("[data-reaction-count]");
          var beforeActive = button.classList.contains("is-active");
          var beforeText = button.textContent;
          if (countNode && button.dataset.communityReaction === "like") {
            var raw = parseInt((countNode.textContent || "0").replace(/,/g, ""), 10) || 0;
            countNode.textContent = String(Math.max(0, raw + (beforeActive ? -1 : 1))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          }
          button.classList.toggle("is-active", !beforeActive);
          if (button.dataset.communityReaction === "bookmark") button.textContent = !beforeActive ? "🔖 저장됨" : "🔖 저장";
          try {
            var response = await fetch("/api/community/reactions", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug: button.dataset.postSlug, type: button.dataset.communityReaction })
            });
            if (response.status === 401) { window.location.href = loginUrl(); return; }
            if (!response.ok) throw new Error("반응을 저장하지 못했습니다.");
          } catch {
            button.classList.toggle("is-active", beforeActive);
            button.textContent = beforeText;
          }
        });
      });
    })();
  </script>`;
}

function renderGuideIndexPage() {
  const title = "셀러 비용 계산 기준 | 셀러딧";
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

function formatSeoTitle(title) {
  const rawTitle = String(title || "");
  const hadCommunitySuffix = /\|\s*로켓그로스 계산기 커뮤니티/.test(rawTitle);
  const normalizedTitle = rawTitle
    .replace(/\s*\|\s*로켓그로스 계산기 커뮤니티/g, "")
    .replace(/\s*\|\s*로켓그로스 계산기/g, "")
    .trim();
  if (!normalizedTitle) return SEO_SITE_BRAND;
  if (normalizedTitle.includes(SEO_SITE_BRAND)) return normalizedTitle;
  return `${normalizedTitle} | ${hadCommunitySuffix ? `${SEO_SITE_BRAND} 커뮤니티` : SEO_SITE_BRAND}`;
}

function renderDocumentShell({ title, description, canonicalUrl, body, jsonLd, script = "" }) {
  const seoTitle = formatSeoTitle(title);
  const jsonLdBlock = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2).replace(/</g, "\\u003c")}</script>`
    : "";

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(seoTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="icon" href="/assets/rocket-favicon.svg?v=20260611" type="image/svg+xml" />
    <link rel="shortcut icon" href="/assets/rocket-favicon.svg?v=20260611" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ko_KR" />
    <meta property="og:site_name" content="${SEO_SITE_BRAND}" />
    <meta property="og:title" content="${escapeHtml(seoTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${PUBLIC_SITE_URL}/assets/site-flow.svg" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seoTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${PUBLIC_SITE_URL}/assets/site-flow.svg" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
    <link rel="stylesheet" href="/styles.css?v=20260625-comments-v13" />
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
          name: getThreadPostSeoTitle(post),
          url: `${PUBLIC_SITE_URL}/community/${post.slug}`,
        })),
      },
      {
        "@type": "ItemList",
        "@id": `${canonicalUrl}#items`,
        itemListElement: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: getThreadPostSeoTitle(post),
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
          name: getThreadPostSeoTitle(post),
          url: `${PUBLIC_SITE_URL}/community/${post.slug}`,
        })),
      },
    ],
  };
}

function buildCommunityPostJsonLd(post, canonicalUrl, comments) {
  const category = COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"];
  const seoName = getThreadPostSeoTitle(post);
  const seoDescription = getThreadSummaryFromText(getThreadDisplayContent(post));
  const isQuestion = post.category === "qna";
  const mainEntity = isQuestion
    ? {
        "@type": "Question",
        name: seoName,
        text: seoDescription,
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
        name: seoName,
        description: seoDescription,
        url: canonicalUrl,
        inLanguage: "ko-KR",
        mainEntity,
      }
    : {
        "@type": post.source === "user" ? "DiscussionForumPosting" : "Article",
        "@id": `${canonicalUrl}#article`,
        headline: seoName,
        name: seoName,
        description: seoDescription,
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
          name: seoName,
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

  const [googleProvider, naverProvider] = await Promise.all([
    fetchGoogleSearchTrends(),
    fetchNaverDatalabTrends(),
  ]);
  const daumProvider = await fetchDaumSearchInterest(googleProvider.items);
  const providers = [googleProvider, naverProvider, daumProvider];
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
      status: "fallback",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://datalab.naver.com/keyword/trendSearch.naver",
      items: buildNaverFallbackTrendItems(),
      message: "네이버 데이터랩 키 연결 전 기본 주제어입니다.",
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
      status: "fallback",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://datalab.naver.com/keyword/trendSearch.naver",
      items: buildNaverFallbackTrendItems(),
      message: "네이버 데이터랩 연결 전 기본 주제어입니다.",
    };
  }
}

async function fetchDaumSearchInterest(seedItems = []) {
  if (DAUM_TREND_API_URL) {
    return fetchConfiguredTrendProvider({
      key: "daum",
      label: "Daum 검색량",
      url: DAUM_TREND_API_URL,
      message: "Daum 검색어 제공 경로를 연결하면 표시됩니다.",
    });
  }

  if (!KAKAO_REST_API_KEY) {
    return {
      key: "daum",
      label: "Daum 검색량",
      status: "unconfigured",
      updatedAt: "",
      sourceUrl: "https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide",
      items: [],
      message: "카카오 REST 키를 연결하면 트렌딩 키워드의 Daum 검색 결과량을 표시합니다.",
    };
  }

  try {
    const trendQueries = Array.from(
      new Set(
        (Array.isArray(seedItems) && seedItems.length
          ? seedItems.map((item) => item.title)
          : TREND_KEYWORD_GROUPS.map((group) => group.title))
          .map((title) => normalizeText(title, 80))
          .filter(Boolean),
      ),
    ).slice(0, 10);

    const responses = await Promise.all(
      trendQueries.map(async (title) => {
        const url = `https://dapi.kakao.com/v2/search/web?query=${encodeURIComponent(title)}&size=1`;
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
          title,
          traffic: `Daum ${formatInteger(payload.meta?.total_count || 0)}건`,
          totalCount: Number(payload.meta?.total_count || 0),
          url: `https://search.daum.net/search?w=tot&q=${encodeURIComponent(title)}`,
        };
      }),
    );

    const items = responses
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 10)
      .map(({ totalCount, ...item }) => item);

    return {
      key: "daum",
      label: "Daum 검색량",
      status: items.length ? "ok" : "empty",
      updatedAt: new Date().toISOString(),
      sourceUrl: "https://developers.kakao.com/docs/latest/ko/daum-search/dev-guide",
      items,
      message: items.length ? "" : "Daum 검색에서 표시할 결과량을 찾지 못했습니다.",
    };
  } catch (error) {
    return {
      key: "daum",
      label: "Daum 검색량",
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
    `- ${getThreadPostSeoTitle(post)}: ${PUBLIC_SITE_URL}/community/${post.slug}`,
    `  - 분류: ${(COMMUNITY_CATEGORIES[post.category] || COMMUNITY_CATEGORIES["final-margin"]).label}`,
    `  - 요약: ${getThreadSummaryFromText(getThreadDisplayContent(post))}`,
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
      `SELECT sessions.id AS session_id, sessions.expires_at, users.id, users.kakao_id, users.nickname, users.email, users.handle, users.display_name, users.avatar_color, users.role
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
      handle: row.handle,
      display_name: row.display_name,
      avatar_color: row.avatar_color,
      role: row.role || "user",
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

function requireAdmin(req, res, next) {
  requireLogin(req, res, () => {
    if (req.currentUser?.role !== "admin") {
      res.status(403).json({ error: "admin_required", message: "운영자 권한이 필요합니다." });
      return;
    }
    next();
  });
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
      updated_at TEXT NOT NULL,
      handle TEXT,
      display_name TEXT,
      avatar_color TEXT,
      role TEXT NOT NULL DEFAULT 'user'
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

    CREATE TABLE IF NOT EXISTS communities (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      member_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      user_id INTEGER NOT NULL,
      community_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, community_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS community_comment_votes (
      id TEXT PRIMARY KEY,
      comment_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      value INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES community_comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#2563eb',
      link_url TEXT NOT NULL DEFAULT '',
      created_by INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS community_follows (
      user_id INTEGER NOT NULL,
      target_handle TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, target_handle),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS community_comment_votes_comment_idx ON community_comment_votes (comment_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      post_id TEXT,
      comment_id TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES community_comments(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at);
  `);

  ensureColumn("users", "handle", "TEXT");
  ensureColumn("users", "display_name", "TEXT");
  ensureColumn("users", "avatar_color", "TEXT");
  ensureColumn("users", "role", "TEXT NOT NULL DEFAULT 'user'");
  ensureColumn("community_comments", "parent_id", "TEXT");
  ensureColumn("community_comments", "likes_count", "INTEGER NOT NULL DEFAULT 0");

  migrateProductMetadataColumns();
  migrateProductNameKeys();
  migrateUserProfileColumns();
  seedCommunities();
  seedCommunityPosts();
  seedSuppliers();
}

function migrateUserProfileColumns() {
  const users = db.prepare("SELECT id, nickname, handle, display_name, avatar_color, role FROM users").all();
  const update = db.prepare("UPDATE users SET handle = ?, display_name = ?, avatar_color = ?, role = ? WHERE id = ?");
  users.forEach((user) => {
    const displayName = user.display_name || user.nickname || `셀러${user.id}`;
    update.run(
      user.handle || makeCommunityHandle(displayName),
      displayName,
      user.avatar_color || getCommunityAuthorColor(displayName),
      user.role || "user",
      user.id,
    );
  });
}

function seedCommunities() {
  const now = new Date().toISOString();
  const rows = [
    ["community-sellerdit", "sellerdit", "r/셀러딧", "쿠팡셀러 비용과 로켓그로스 운영을 나누는 커뮤니티"],
    ["community-china-sourcing", "china-sourcing", "r/중국사입", "1688·타오바오 상품 단가와 사입 리스크를 공유합니다."],
    ["community-china-korea-logistics", "china-korea-logistics", "r/중국→한국", "포워더, LCL, 통관, 국내 도착 비용을 점검합니다."],
    ["community-korea-coupang-inbound", "korea-coupang-inbound", "r/한국→쿠팡", "쿠팡센터 입고와 작업비, 바코드 라벨 기준을 나눕니다."],
    ["community-coupang-selling-cost", "coupang-selling-cost", "r/쿠팡소모비", "판매 수수료, 광고비, 반품비처럼 판매 중 드는 비용을 계산합니다."],
    ["community-final-margin", "final-margin", "r/최종마진", "최종 판매가와 순이익 판단을 함께 점검합니다."],
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO communities (id, slug, name, description, member_count, created_at) VALUES (?, ?, ?, ?, 0, ?)");
  rows.forEach((row) => stmt.run(...row, now));
}

function seedSuppliers() {
  const now = new Date().toISOString();
  const rows = [
    { slug: "month-billion", name: "월억도전", category: "#농수산", color: "#2563eb", url: "/suppliers/month-billion" },
    { slug: "fresh-market", name: "신선마켓", category: "#농산물", color: "#3b82f6", url: "/suppliers/fresh-market" },
    { slug: "ddaggo-damgo", name: "따고담고", category: "#공산품", color: "#1e40af", url: "/suppliers/ddaggo-damgo" },
    { slug: "farm-hub", name: "팜허브", category: "#농수산", color: "#2563eb", url: "/suppliers/farm-hub" },
    { slug: "1688-sourcing", name: "1688소싱", category: "#1688·타오바오", color: "#1d4ed8", url: "/suppliers/1688-sourcing" },
    { slug: "inspection-partner", name: "검수파트너", category: "#물류·검수", color: "#2563eb", url: "/suppliers/inspection-partner" },
  ];
  const stmt = db.prepare("INSERT OR IGNORE INTO suppliers (id, slug, name, category, avatar_color, link_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  rows.forEach((row) => stmt.run(`supplier-${row.slug}`, row.slug, row.name, row.category, row.color, row.url, now));
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
    db.prepare("UPDATE users SET nickname = ?, email = ?, display_name = COALESCE(display_name, ?), handle = COALESCE(handle, ?), avatar_color = COALESCE(avatar_color, ?), updated_at = ? WHERE kakao_id = ?").run(
      nickname,
      email,
      nickname || `셀러${kakaoId}`,
      makeCommunityHandle(nickname || `seller${kakaoId}`),
      getCommunityAuthorColor(nickname || `seller${kakaoId}`),
      now,
      kakaoId,
    );
    return db.prepare("SELECT * FROM users WHERE kakao_id = ?").get(kakaoId);
  }

  const result = db
    .prepare("INSERT INTO users (kakao_id, nickname, email, handle, display_name, avatar_color, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'user', ?, ?)")
    .run(kakaoId, nickname, email, makeCommunityHandle(nickname || `seller${kakaoId}`), nickname || `셀러${kakaoId}`, getCommunityAuthorColor(nickname || `seller${kakaoId}`), now, now);

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
    imageUrl: getPostImageUrl(parseJson(row.body_json, [])),
    type: getPostImageUrl(parseJson(row.body_json, [])) ? "image" : "text",
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

function getPostImageUrl(sections) {
  if (!Array.isArray(sections)) return "";
  const found = sections.find((section) => section && section.imageUrl);
  return found ? String(found.imageUrl || "") : "";
}

function getPostPlainBody(post) {
  return (post?.sections || [])
    .flatMap((section) => Array.isArray(section.body) ? section.body : [section.body])
    .filter(Boolean)
    .join("\n\n");
}

function getThreadDisplayContent(post) {
  const title = String(post?.title || "").trim();
  const body = getPostPlainBody(post).trim();
  if (!title) return body;
  if (!body) return title;
  if (body === title || body.startsWith(`${title}\n`) || body.startsWith(`${title}\r\n`)) return body;
  return `${title}\n\n${body}`;
}

function getThreadSeoTitleFromText(value, maxLength = 60) {
  const firstLine = String(value || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "셀러딧 게시물";
  return firstLine.length > maxLength ? `${firstLine.slice(0, maxLength - 1)}…` : firstLine;
}

function getThreadSummaryFromText(value, maxLength = 180) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function getThreadPostSeoTitle(post, maxLength = 60) {
  return getThreadSeoTitleFromText(getThreadDisplayContent(post), maxLength);
}

function attachCommunityPostState(post, user) {
  if (!post) return post;
  const isOwner = Boolean(user && post.authorUserId && Number(post.authorUserId) === Number(user.id));
  const isAdmin = Boolean(user && user.role === "admin");
  const state = { ...post, canEdit: isOwner || isAdmin, canDelete: isOwner || isAdmin, likedByMe: false, savedByMe: false };
  if (user?.id) {
    state.likedByMe = Boolean(db.prepare("SELECT 1 FROM community_reactions WHERE post_id = ? AND user_id = ? AND type = 'like'").get(post.id, user.id));
    state.savedByMe = Boolean(db.prepare("SELECT 1 FROM community_reactions WHERE post_id = ? AND user_id = ? AND type = 'bookmark'").get(post.id, user.id));
  }
  return state;
}

function attachCommunityPostsState(posts, user) {
  return posts.map((post) => attachCommunityPostState(post, user));
}

function attachCommunityCommentsState(comments, user) {
  return comments.map((comment) => {
    const isOwner = Boolean(user && Number(comment.userId) === Number(user.id));
    const isAdmin = Boolean(user && user.role === "admin");
    return {
      ...comment,
      canEdit: isOwner || isAdmin,
      canDelete: isOwner || isAdmin,
      likedByMe: Boolean(user?.id && db.prepare("SELECT 1 FROM community_comment_votes WHERE comment_id = ? AND user_id = ?").get(comment.id, user.id)),
      replies: attachCommunityCommentsState(comment.replies || [], user),
    };
  });
}

function normalizeCommunitySlug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}

function getCommunities() {
  return db.prepare("SELECT id, slug, name, description, member_count FROM communities ORDER BY created_at ASC").all()
    .map((row) => ({ id: row.id, slug: row.slug, name: row.name, description: row.description, memberCount: row.member_count || 0, category: COMMUNITY_CATEGORIES[row.slug] ? row.slug : "" }));
}

function getCommunityBySlug(slug) {
  const normalized = normalizeCommunitySlug(slug);
  const row = db.prepare("SELECT id, slug, name, description, member_count FROM communities WHERE slug = ?").get(normalized);
  return row ? { id: row.id, slug: row.slug, name: row.name, description: row.description, memberCount: row.member_count || 0 } : null;
}

function isCommunityMember(userId, communityId) {
  return Boolean(db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND community_id = ?").get(userId, communityId));
}

function getCommunityMembershipsForUser(userId) {
  return db.prepare(`SELECT c.id, c.slug, c.name, c.description, c.member_count
    FROM memberships m JOIN communities c ON c.id = m.community_id
    WHERE m.user_id = ? ORDER BY m.created_at DESC`).all(userId)
    .map((row) => ({ id: row.id, slug: row.slug, name: row.name, description: row.description, memberCount: row.member_count || 0 }));
}

function syncCommunityMemberCount(communityId) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM memberships WHERE community_id = ?").get(communityId)?.count || 0;
  db.prepare("UPDATE communities SET member_count = ? WHERE id = ?").run(count, communityId);
}

function supplierCategoryFilter(category) {
  const text = String(category || "");
  const tags = [];
  if (/농|수산|신선/.test(text)) tags.push("agriculture", "direct");
  if (/공산|도매/.test(text)) tags.push("industrial", "wholesale");
  if (/1688|타오바오|중국/.test(text)) tags.push("china-market", "industrial");
  if (/물류|검수/.test(text)) tags.push("logistics");
  return [...new Set(tags)].join(" ") || "wholesale";
}

function supplierFromRow(row) {
  if (!row) return null;
  return { id: row.id, slug: row.slug, name: row.name, category: row.category, avatarColor: row.avatar_color, linkUrl: row.link_url, createdBy: row.created_by, createdAt: row.created_at, filter: supplierCategoryFilter(row.category) };
}

function getSuppliers() {
  return db.prepare("SELECT * FROM suppliers ORDER BY created_at ASC").all().map(supplierFromRow);
}

function getSupplierBySlug(slug) {
  return supplierFromRow(db.prepare("SELECT * FROM suppliers WHERE slug = ?").get(String(slug || "")));
}

function normalizeSupplierPayload(body = {}) {
  const name = normalizeText(body.name, 80);
  const category = normalizeText(body.category, 40);
  const slug = normalizeCommunitySlug(body.slug || name);
  const avatarColor = /^#[0-9a-fA-F]{6}$/.test(String(body.avatarColor || body.avatar_color || "")) ? String(body.avatarColor || body.avatar_color) : "#2563eb";
  const linkUrl = normalizeUrl(body.linkUrl || body.link_url, 500) || normalizeText(body.linkUrl || body.link_url, 500);
  return { name, category, slug, avatarColor, linkUrl };
}

function createUniqueSupplierSlug(seed) {
  const base = normalizeCommunitySlug(makeCommunityHandle(seed)) || `supplier-${Date.now()}`;
  let slug = base;
  let index = 2;
  while (getSupplierBySlug(slug)) slug = `${base}-${index++}`;
  return slug;
}

function notificationFromRow(row) {
  return { id: row.id, userId: row.user_id, actorUserId: row.actor_user_id, postId: row.post_id, commentId: row.comment_id, type: row.type, message: row.message, readAt: row.read_at, createdAt: row.created_at };
}

function createCommunityNotificationForComment(post, commentId, parentId, actorUser) {
  const targets = new Set();
  if (post.authorUserId && Number(post.authorUserId) !== Number(actorUser?.id)) targets.add(Number(post.authorUserId));
  if (parentId) {
    const parent = db.prepare("SELECT user_id FROM community_comments WHERE id = ?").get(parentId);
    if (parent?.user_id && Number(parent.user_id) !== Number(actorUser?.id)) targets.add(Number(parent.user_id));
  }
  const now = new Date().toISOString();
  targets.forEach((userId) => {
    db.prepare("INSERT INTO notifications (id, user_id, actor_user_id, post_id, comment_id, type, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(`notification-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`, userId, actorUser?.id || null, post.id, commentId, parentId ? "reply" : "comment", `${getDisplayUserName(actorUser)}님이 ${parentId ? "답글" : "댓글"}을 남겼습니다.`, now);
  });
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

function getEditableCommunityPost(id, user) {
  if (!user?.id) return null;
  const postId = String(id || "");
  const row = user.role === "admin"
    ? db.prepare("SELECT * FROM community_posts WHERE id = ? AND source = 'user'").get(postId)
    : db.prepare("SELECT * FROM community_posts WHERE id = ? AND author_user_id = ? AND source = 'user'").get(postId, user.id);
  return communityPostFromRow(row);
}

function getEditableCommunityComment(id, user) {
  if (!user?.id) return null;
  const commentId = String(id || "");
  const row = user.role === "admin"
    ? db.prepare("SELECT * FROM community_comments WHERE id = ?").get(commentId)
    : db.prepare("SELECT * FROM community_comments WHERE id = ? AND user_id = ?").get(commentId, user.id);
  return communityCommentFromRow(row);
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

function deleteCommunityCommentThread(commentId) {
  const ids = collectCommunityCommentChildIds(commentId);
  ids.push(commentId);
  const deleteStmt = db.prepare("DELETE FROM community_comments WHERE id = ?");
  ids.forEach((id) => deleteStmt.run(id));
}

function collectCommunityCommentChildIds(parentId) {
  const rows = db.prepare("SELECT id FROM community_comments WHERE parent_id = ?").all(parentId);
  return rows.flatMap((row) => [row.id, ...collectCommunityCommentChildIds(row.id)]);
}

function updateCommunityCommentVoteCount(commentId) {
  const likes = db.prepare("SELECT COUNT(*) AS count FROM community_comment_votes WHERE comment_id = ?").get(commentId)?.count || 0;
  db.prepare("UPDATE community_comments SET likes_count = ?, updated_at = ? WHERE id = ?").run(likes, new Date().toISOString(), commentId);
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

function normalizeUrl(value, maxLength = 500) {
  const text = normalizeText(value, maxLength);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
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

function formatRelativeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${Math.max(1, days)}일 전`;
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

