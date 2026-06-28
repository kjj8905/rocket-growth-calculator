#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const rootDir = new URL("..", import.meta.url).pathname;
const requestedBaseUrl = process.env.COMMUNITY_SMOKE_BASE_URL || "";
const shouldLaunchServer = !requestedBaseUrl;
const port = Number(process.env.COMMUNITY_SMOKE_PORT || 4187 + Math.floor(Math.random() * 1000));
const baseUrl = requestedBaseUrl || `http://127.0.0.1:${port}`;
const runId = `smoke-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sellerdit-community-smoke-"));
const databasePath = process.env.COMMUNITY_SMOKE_DATABASE_PATH || path.join(tmpDir, "app.sqlite");

let serverProcess;
let cookie = "";
let createdPostId = "";

function log(message) {
  console.log(message);
}

function fail(message) {
  throw new Error(message);
}

function rememberCookie(response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) return;
  cookie = setCookie
    .split(/,(?=\s*[^;,=]+=[^;,]+)/)
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function request(method, pathname, body, options = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  rememberCookie(response);
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (options.expectStatus && response.status !== options.expectStatus) {
    fail(`${method} ${pathname} expected ${options.expectStatus}, got ${response.status}: ${text.slice(0, 300)}`);
  }
  if (!options.expectStatus && !options.allowError && (response.status < 200 || response.status >= 300)) {
    fail(`${method} ${pathname} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return { response, data, text };
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await request("GET", "/api/community/posts?sort=new", null, { expectStatus: 200 });
      if (Array.isArray(result.data?.posts)) return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  fail(`server did not become ready: ${lastError?.message || "timeout"}`);
}

async function startServer() {
  if (!shouldLaunchServer) return;
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: databasePath,
      COMMUNITY_TEST_AUTH: "true",
      ACCOUNT_FEATURE_ENABLED: "true",
      PUBLIC_SITE_URL: baseUrl,
      SESSION_SECRET: `community-smoke-${runId}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  serverProcess.stdout.on("data", (chunk) => { output += chunk.toString(); });
  serverProcess.stderr.on("data", (chunk) => { output += chunk.toString(); });
  serverProcess.on("exit", (code, signal) => {
    if (!process.exitCode && code !== null && code !== 0) {
      console.error(`server exited early (${code || signal})\n${output}`);
      process.exitCode = 1;
    }
  });
  await waitForServer();
}

async function cleanup() {
  if (createdPostId) {
    try {
      await request("DELETE", `/api/community/posts/${encodeURIComponent(createdPostId)}`, null, { expectStatus: 200 });
      log(`OK deleted test post ${createdPostId}`);
    } catch (error) {
      console.error(`WARN cleanup failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!serverProcess.killed) serverProcess.kill("SIGKILL");
  }
  if (!process.env.COMMUNITY_SMOKE_KEEP_DB) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } else {
    log(`Kept smoke DB at ${databasePath}`);
  }
}

async function main() {
  log(`Community API smoke base: ${baseUrl}`);
  if (shouldLaunchServer) log(`Using isolated sqlite DB: ${databasePath}`);
  await startServer();

  await request("POST", "/api/community/posts", { title: "unauth smoke", body: "blocked" }, { expectStatus: 401 });
  log("OK unauthenticated post creation is rejected");

  const login = await request("POST", "/dev/auth/virtual-user", { nickname: `스모크셀러 ${runId}` }, requestedBaseUrl ? { allowError: true } : { expectStatus: 200 });
  if (requestedBaseUrl && login.response.status === 404) {
    log("SKIP authenticated mutation checks: production virtual test auth is disabled");
    log("Community API smoke public checks passed");
    await cleanup();
    return;
  }
  if (login.response.status !== 200 || !login.data?.ok || !cookie.includes("rg_session=")) fail("virtual-user login did not create a session cookie");
  log(`OK virtual user session ${login.data.user?.handle || ""}`.trim());

  const me = await request("GET", "/api/me", null, { expectStatus: 200 });
  if (!me.data?.authenticated) fail("/api/me did not report authenticated=true");
  log("OK /api/me authenticated");

  const membershipsBefore = await request("GET", "/api/community/memberships", null, { expectStatus: 200 });
  if (!Array.isArray(membershipsBefore.data?.communities)) fail("memberships response is not an array");
  const membership = await request("POST", "/api/community/memberships", { slug: "final-margin" }, { expectStatus: 200 });
  if (!membership.data?.active) fail("membership toggle did not activate final-margin");
  log("OK community membership toggle on");

  const title = `커뮤니티 API 스모크 ${runId}`;
  const postResponse = await request("POST", "/api/community/posts", {
    title,
    category: "final-margin",
    summary: "임시 스모크 테스트 글입니다.",
    body: "API 스모크 테스트 본문입니다.\n\n테스트 종료 시 삭제됩니다.",
    tags: ["로켓그로스", "초보셀러"],
  }, { expectStatus: 201 });
  const post = postResponse.data?.post;
  if (!post?.id || !post?.slug || post.title !== title) fail("post creation response missing expected post fields");
  createdPostId = post.id;
  log(`OK created post ${post.slug}`);

  const detail = await request("GET", `/api/community/posts/${encodeURIComponent(post.slug)}`, null, { expectStatus: 200 });
  if (detail.data?.post?.id !== post.id || !Array.isArray(detail.data?.comments)) fail("post detail did not return created post and comments array");
  if (detail.data?.post?.canEdit !== true) fail("post detail did not include owner canEdit state");
  log("OK fetched post detail");

  const list = await request("GET", `/api/community/search?q=${encodeURIComponent(title)}`, null, { expectStatus: 200 });
  if (!list.data?.posts?.some((item) => item.id === post.id)) fail("created post was not found by API search");
  log("OK search finds created post");

  const like = await request("POST", "/api/community/reactions", { slug: post.slug, type: "like" }, { expectStatus: 200 });
  if (!like.data?.active || like.data?.post?.likesCount !== 1) fail("post like did not activate/count to 1");
  const bookmark = await request("POST", "/api/community/reactions", { postId: post.id, type: "bookmark" }, { expectStatus: 200 });
  if (!bookmark.data?.active || bookmark.data?.post?.bookmarksCount !== 1) fail("post bookmark did not activate/count to 1");
  log("OK post like/bookmark reactions");

  const commentResponse = await request("POST", "/api/community/comments", { slug: post.slug, body: `스모크 댓글 ${runId}` }, { expectStatus: 201 });
  const comment = commentResponse.data?.comment;
  if (!comment?.id || commentResponse.data?.post?.commentsCount !== 1) fail("comment creation did not return expected count");
  log(`OK created comment ${comment.id}`);

  const detailAfterComment = await request("GET", `/api/community/posts/${encodeURIComponent(post.slug)}`, null, { expectStatus: 200 });
  if (detailAfterComment.data?.comments?.[0]?.canEdit !== true) fail("comment detail did not include owner canEdit state");

  const replyResponse = await request("POST", "/api/community/comments", { postId: post.id, parentId: comment.id, body: `스모크 답글 ${runId}` }, { expectStatus: 201 });
  const reply = replyResponse.data?.comment;
  if (!reply?.id || reply.parentId !== comment.id || replyResponse.data?.post?.commentsCount !== 2) fail("reply creation did not return expected tree/count");
  log(`OK created reply ${reply.id}`);

  const commentLike = await request("POST", "/api/community/comment-reactions", { commentId: comment.id }, { expectStatus: 200 });
  if (!commentLike.data?.active || commentLike.data?.comment?.likesCount !== 1) fail("comment reaction did not activate/count to 1");
  log("OK comment reaction");

  const updatedComment = await request("PUT", `/api/community/comments/${encodeURIComponent(comment.id)}`, { body: `수정된 스모크 댓글 ${runId}` }, { expectStatus: 200 });
  if (updatedComment.data?.comment?.body !== `수정된 스모크 댓글 ${runId}`) fail("comment update did not persist body");
  const updatedPost = await request("PUT", `/api/community/posts/${encodeURIComponent(post.id)}`, { title: `${title} 수정`, body: "수정된 스모크 본문" }, { expectStatus: 200 });
  if (updatedPost.data?.post?.title !== `${title} 수정`) fail("post update did not persist title");
  log("OK update post/comment");

  await request("DELETE", `/api/community/comments/${encodeURIComponent(comment.id)}`, null, { expectStatus: 200 });
  const afterDeleteComment = await request("GET", `/api/community/posts/${encodeURIComponent(post.slug)}`, null, { expectStatus: 200 });
  if (afterDeleteComment.data?.comments?.length !== 0 || afterDeleteComment.data?.post?.commentsCount !== 0) fail("comment thread delete did not remove root/reply or recount");
  log("OK delete comment thread and recount");

  await request("POST", "/api/community/memberships", { slug: "final-margin" }, { expectStatus: 200 });
  log("OK community membership toggle off");

  await cleanup();
  createdPostId = "";
  log("Community API smoke passed");
}

main().catch(async (error) => {
  console.error(error.stack || error.message || error);
  await cleanup();
  process.exit(1);
});
