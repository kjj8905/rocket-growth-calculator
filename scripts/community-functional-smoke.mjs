import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.COMMUNITY_SMOKE_PORT || 4186);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const dbPath = path.join(os.tmpdir(), `sellerdit-community-smoke-${process.pid}.sqlite`);

function log(message) {
  console.log(`[community-smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

class HttpClient {
  constructor() {
    this.cookie = "";
  }

  async request(route, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.cookie) headers.Cookie = this.cookie;
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
    const response = await fetch(`${BASE_URL}${route}`, { ...options, headers });
    const setCookie = typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : []);
    if (setCookie.length) {
      const nextCookies = setCookie
        .map((value) => String(value).split(";")[0])
        .filter(Boolean);
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
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(`${route} returned non-JSON ${response.status}: ${text.slice(0, 200)}`);
    }
    return { response, data };
  }

  async login(nickname, role = "user") {
    const { response, data } = await this.json("/dev/auth/virtual-user", {
      method: "POST",
      body: JSON.stringify({ nickname, role }),
    });
    assert(response.status === 200, `virtual login failed: ${response.status}`);
    assert(data.user?.nickname === nickname, "virtual login nickname mismatch");
    assert(this.cookie.includes("rg_session="), "session cookie missing after virtual login");
    return data.user;
  }
}

async function waitForServer(child) {
  const deadline = Date.now() + 15000;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not become ready: ${lastError?.message || "timeout"}`);
}

async function expectStatus(route, expected = 200) {
  const response = await fetch(`${BASE_URL}${route}`);
  assert(response.status === expected, `${route} expected ${expected}, got ${response.status}`);
  const text = await response.text();
  assert(text.length > 0, `${route} returned empty response`);
  return text;
}

async function runSmoke() {
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
      SESSION_SECRET: "community-smoke-session-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));

  try {
    await waitForServer(child);
    log("server ready");

    const communityHtml = await expectStatus("/community");
    assert(communityHtml.includes("인기 게시물"), "community page missing popular posts panel");
    assert(!communityHtml.includes("게시판 규칙"), "community page should not render board rules card");
    await expectStatus("/community/user-q-price-19900-margin");
    await expectStatus("/community/suppliers");
    await expectStatus("/u/%EC%B4%88%EB%B3%B4%EC%85%80%EB%9F%AC%EB%AF%BC%EC%88%98");
    log("public pages OK");

    const anonymous = new HttpClient();
    const unauth = await anonymous.json("/api/community/comments", {
      method: "POST",
      body: JSON.stringify({ slug: "user-q-price-19900-margin", body: "비로그인 댓글" }),
    });
    assert(unauth.response.status === 401, `anonymous comment expected 401, got ${unauth.response.status}`);
    log("anonymous auth guard OK");

    const user = new HttpClient();
    const smokeUser = await user.login("스모크셀러");
    assert(smokeUser.handle, "smoke user handle missing");

    const created = await user.json("/api/community/posts", {
      method: "POST",
      body: JSON.stringify({
        category: "final-margin",
        body: "스모크 테스트 글입니다.\n\n본문만 입력해도 제목이 자동 생성되어야 합니다.",
        tags: ["스모크", "검수"],
      }),
    });
    assert(created.response.status === 201, `create post failed ${created.response.status}: ${JSON.stringify(created.data)}`);
    const post = created.data.post;
    assert(post.slug && post.id, "created post missing id/slug");
    assert(post.title.startsWith("스모크 테스트 글입니다"), `derived title mismatch: ${post.title}`);
    log(`created post ${post.slug}`);

    const detail = await user.json(`/api/community/posts/${post.slug}`);
    assert(detail.response.status === 200, "created post detail API failed");

    const likeOn = await user.json("/api/community/reactions", {
      method: "POST",
      body: JSON.stringify({ slug: post.slug, type: "like" }),
    });
    assert(likeOn.data.active === true && likeOn.data.post.likesCount === 1, "post like on failed");
    const likeOff = await user.json("/api/community/reactions", {
      method: "POST",
      body: JSON.stringify({ slug: post.slug, type: "like" }),
    });
    assert(likeOff.data.active === false && likeOff.data.post.likesCount === 0, "post like off failed");
    const bookmark = await user.json("/api/community/reactions", {
      method: "POST",
      body: JSON.stringify({ slug: post.slug, type: "bookmark" }),
    });
    assert(bookmark.data.active === true && bookmark.data.post.bookmarksCount === 1, "bookmark failed");
    log("post reactions OK");

    const commentCreated = await user.json("/api/community/comments", {
      method: "POST",
      body: JSON.stringify({ slug: post.slug, body: "스모크 댓글입니다." }),
    });
    assert(commentCreated.response.status === 201, "comment create failed");
    const comment = commentCreated.data.comment;
    assert(commentCreated.data.post.commentsCount === 1, "comment count after create should be 1");

    const replyCreated = await user.json("/api/community/comments", {
      method: "POST",
      body: JSON.stringify({ slug: post.slug, parentId: comment.id, body: "스모크 답글입니다." }),
    });
    assert(replyCreated.response.status === 201, "reply create failed");
    assert(replyCreated.data.post.commentsCount === 2, "comment count after reply should be 2");

    const commentLike = await user.json("/api/community/comment-reactions", {
      method: "POST",
      body: JSON.stringify({ commentId: comment.id }),
    });
    assert(commentLike.data.active === true && commentLike.data.comment.likesCount === 1, "comment like failed");

    const commentEdited = await user.json(`/api/community/comments/${comment.id}`, {
      method: "PUT",
      body: JSON.stringify({ body: "스모크 댓글 수정본입니다." }),
    });
    assert(commentEdited.response.status === 200 && commentEdited.data.comment.body.includes("수정본"), "comment edit failed");

    const deleteComment = await user.json(`/api/community/comments/${comment.id}`, { method: "DELETE" });
    assert(deleteComment.response.status === 200, "comment delete failed");
    const afterCommentDelete = await user.json(`/api/community/posts/${post.slug}`);
    assert(afterCommentDelete.data.post.commentsCount === 0, `comment thread delete should reset count to 0, got ${afterCommentDelete.data.post.commentsCount}`);
    log("comments/replies OK");

    const postEdited = await user.json(`/api/community/posts/${post.id}`, {
      method: "PUT",
      body: JSON.stringify({ body: "스모크 게시글 수정본입니다.", tags: ["수정"] }),
    });
    assert(postEdited.response.status === 200 && postEdited.data.post.sections[0].body.join(" ").includes("수정본"), "post edit failed");

    const profileHtml = await expectStatus(`/u/${encodeURIComponent(smokeUser.handle)}`);
    assert(profileHtml.includes("스모크 게시글 수정본입니다") || profileHtml.includes("스모크 테스트 글입니다"), "profile should render user post");

    const follow = await user.json("/api/community/follow", {
      method: "POST",
      body: JSON.stringify({ handle: "초보셀러민수" }),
    });
    assert(follow.response.status === 200 && follow.data.active === true, "follow failed");

    const membership = await user.json("/api/community/memberships", {
      method: "POST",
      body: JSON.stringify({ slug: "final-margin" }),
    });
    assert(membership.response.status === 200 && membership.data.community, "membership toggle failed");
    log("profile/follow/membership OK");

    const admin = new HttpClient();
    await admin.login("스모크운영자", "admin");
    const supplierName = `스모크 공급처 ${Date.now()}`;
    const supplierCreated = await admin.json("/api/admin/suppliers", {
      method: "POST",
      body: JSON.stringify({ name: supplierName, category: "china", linkUrl: "https://example.com/smoke", avatarColor: "#2563eb" }),
    });
    assert(supplierCreated.response.status === 201, `supplier create failed ${supplierCreated.response.status}`);
    const supplier = supplierCreated.data.supplier;
    assert(supplier.slug, "supplier slug missing");
    const supplierUpdated = await admin.json(`/api/admin/suppliers/${supplier.slug}`, {
      method: "PUT",
      body: JSON.stringify({ name: `${supplierName} 수정`, category: "korea", linkUrl: "https://example.com/smoke2", avatarColor: "#334155" }),
    });
    assert(supplierUpdated.response.status === 200 && supplierUpdated.data.supplier.name.includes("수정"), "supplier update failed");
    const supplierDeleted = await admin.json(`/api/admin/suppliers/${supplier.slug}`, { method: "DELETE" });
    assert(supplierDeleted.response.status === 200, "supplier delete failed");
    log("admin suppliers OK");

    const deletePost = await user.json(`/api/community/posts/${post.id}`, { method: "DELETE" });
    assert(deletePost.response.status === 200, "post delete failed");
    const deletedDetail = await user.json(`/api/community/posts/${post.slug}`);
    assert(deletedDetail.response.status === 404, "deleted post should 404 from API");
    log("post delete OK");

    log("COMMUNITY FUNCTIONAL SMOKE PASSED");
  } finally {
    child.kill("SIGTERM");
    fs.rmSync(dbPath, { force: true });
  }
}

runSmoke().catch((error) => {
  console.error(error);
  process.exit(1);
});
