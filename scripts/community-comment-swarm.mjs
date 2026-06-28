#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.COMMENT_SWARM_PORT || 4198);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const dbPath = path.join(os.tmpdir(), `sellerdit-comment-swarm-${process.pid}.sqlite`);
const USER_COUNT = Number(process.env.COMMENT_SWARM_USERS || 50);

function log(message) {
  console.log(`[comment-swarm] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class HttpClient {
  constructor() { this.cookie = ""; }

  async request(route, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.cookie) headers.Cookie = this.cookie;
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const response = await fetch(`${BASE_URL}${route}`, { ...options, headers });
    const setCookie = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
    if (setCookie.length) {
      const nextCookies = setCookie.map((value) => String(value).split(";")[0]).filter(Boolean);
      const current = new Map(this.cookie.split(/;\s*/).filter(Boolean).map((pair) => {
        const index = pair.indexOf("=");
        return [pair.slice(0, index), pair.slice(index + 1)];
      }));
      nextCookies.forEach((pair) => {
        const index = pair.indexOf("=");
        current.set(pair.slice(0, index), pair.slice(index + 1));
      });
      this.cookie = Array.from(current.entries()).map(([key, value]) => `${key}=${value}`).join("; ");
    }
    return response;
  }

  async json(route, options = {}) {
    const response = await this.request(route, options);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; }
    catch { throw new Error(`${route} returned non-JSON ${response.status}: ${text.slice(0, 200)}`); }
    return { response, data, text };
  }

  async login(nickname) {
    const { response, data } = await this.json("/dev/auth/virtual-user", {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
    assert(response.status === 200, `login failed ${nickname}: ${response.status}`);
    assert(this.cookie.includes("rg_session="), `session cookie missing for ${nickname}`);
    return data.user;
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 15000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) return;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not become ready: ${lastError?.message || "timeout"}`);
}

async function run() {
  fs.rmSync(dbPath, { force: true });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_PATH: dbPath,
      COMMUNITY_TEST_AUTH: "true",
      ACCOUNT_FEATURE_ENABLED: "true",
      PUBLIC_SITE_URL: BASE_URL,
      SESSION_SECRET: "comment-swarm-session-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));

  try {
    await waitForServer(child);
    log("server ready");

    const owner = new HttpClient();
    await owner.login("댓글검수방장");
    const created = await owner.json("/api/community/posts", {
      method: "POST",
      body: JSON.stringify({
        category: "final-margin",
        body: "댓글 기능 50명 검수용 게시글입니다. 버튼을 여러 번 눌러도 픽토그램이 유지되어야 합니다.",
        tags: ["댓글검수", "50명"],
      }),
    });
    assert(created.response.status === 201, `post create failed: ${created.response.status}`);
    const slug = created.data.post.slug;
    log(`created test post ${slug}`);

    const clients = [];
    for (let index = 0; index < USER_COUNT; index += 1) {
      const client = new HttpClient();
      await client.login(`댓글검수유저${String(index + 1).padStart(2, "0")}`);
      clients.push(client);
    }
    log(`logged in ${clients.length} users`);

    const commentIds = [];
    for (let index = 0; index < clients.length; index += 1) {
      const client = clients[index];
      const commentResult = await client.json("/api/community/comments", {
        method: "POST",
        body: JSON.stringify({ slug, body: `50명 이용자 검수 댓글 ${index + 1}: 좋아요, 답글, 공유, 저장 버튼을 순서대로 눌러봅니다.` }),
      });
      assert(commentResult.response.status === 201, `comment ${index + 1} failed: ${commentResult.response.status}`);
      const comment = commentResult.data.comment;
      commentIds.push(comment.id);

      const like1 = await client.json("/api/community/comment-reactions", {
        method: "POST",
        body: JSON.stringify({ commentId: comment.id }),
      });
      assert(like1.data.active === true, `comment like on failed for user ${index + 1}`);
      if (index % 3 === 0) {
        const like2 = await client.json("/api/community/comment-reactions", {
          method: "POST",
          body: JSON.stringify({ commentId: comment.id }),
        });
        assert(like2.data.active === false, `comment like off failed for user ${index + 1}`);
      }
      if (index % 5 === 0) {
        const reply = await client.json("/api/community/comments", {
          method: "POST",
          body: JSON.stringify({ slug, parentId: comment.id, body: `답글 검수 ${index + 1}` }),
        });
        assert(reply.response.status === 201, `reply failed for user ${index + 1}`);
      }
      if (index % 4 === 0) {
        const save = await client.json("/api/community/reactions", {
          method: "POST",
          body: JSON.stringify({ slug, type: "bookmark" }),
        });
        assert(typeof save.data.active === "boolean", `bookmark failed for user ${index + 1}`);
      }
    }
    log(`created ${commentIds.length} comments and exercised reactions/replies/bookmarks`);

    const detail = await owner.json(`/api/community/posts/${slug}`);
    assert(detail.response.status === 200, "detail API failed after swarm");
    assert(detail.data.post.commentsCount === USER_COUNT + Math.ceil(USER_COUNT / 5), `commentsCount mismatch: ${detail.data.post.commentsCount}`);

    const htmlResponse = await owner.request(`/community/${slug}`);
    const html = await htmlResponse.text();
    assert(htmlResponse.status === 200, "detail HTML failed after swarm");
    assert(!html.includes("🔖 저장됨"), "visible bookmark saved text leaked into HTML");
    assert(!html.includes(">복사됨<"), "visible copied text leaked into HTML");
    assert(!html.includes(">링크 복사됨<"), "visible link copied text leaked into HTML");
    assert((html.match(/data-community-comment-reaction/g) || []).length >= USER_COUNT, "rendered comment reaction buttons missing");
    assert((html.match(/sellerdit-comment-share/g) || []).length >= USER_COUNT, "rendered comment share buttons missing");
    assert((html.match(/<svg viewBox=/g) || []).length >= USER_COUNT * 3, "rendered action SVG icons too few");
    log("rendered HTML keeps comment action icons and avoids visible saved/copied text");

    const source = fs.readFileSync(path.resolve("server.js"), "utf8");
    const forbidden = [
      'button.textContent = "복사됨"',
      'button.textContent = "링크 복사됨"',
      'button.textContent = !beforeActive ? "🔖 저장됨"',
      'button.textContent = "🔖 저장됨"',
    ];
    forbidden.forEach((token) => assert(!source.includes(token), `forbidden icon-destroying textContent remains: ${token}`));
    log("source guard OK: no action button textContent replacement for share/bookmark");

    const cleanup = await owner.json(`/api/community/posts/${created.data.post.id}`, { method: "DELETE" });
    assert(cleanup.response.status === 200, "cleanup delete failed");
    log("cleanup OK");
    log("COMMENT SWARM PASSED");
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 200));
    fs.rmSync(dbPath, { force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
