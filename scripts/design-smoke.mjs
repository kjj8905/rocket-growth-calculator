#!/usr/bin/env node

const baseUrl = process.env.DESIGN_BASE_URL || "http://localhost:4176";

const routes = [
  {
    path: "/community",
    mustContain: ["셀러딧", "sellerdit-layout-shell", "sellerdit-layout-grid", "data-community-reaction", "data-community-share"],
  },
  {
    path: "/community?sort=new&cat=china-sourcing",
    mustContain: ["중국사입", "sellerdit-layout-shell", "sellerdit-layout-grid", "data-community-reaction", "data-community-share"],
  },
  {
    path: "/community/suppliers",
    mustContain: ["공급처", "sellerdit-layout-shell", "sellerdit-layout-grid", "data-tile-type=\"community\"", "data-tile-type=\"supplier\"", "data-community-membership"],
    mustNotContain: ["무지개"],
  },
  {
    path: "/community/blog",
    mustContain: ["내 블로그", "sellerdit-blog-hero", "sellerdit-layout-shell", "sellerdit-layout-grid", "블로그 글 작성"],
  },
  {
    path: "/u/%EC%B4%88%EB%B3%B4%EC%85%80%EB%9F%AC%EB%AF%BC%EC%88%98",
    mustContain: ["sellerdit-layout-shell", "sellerdit-layout-grid", "sellerdit-profile-header", "sellerdit-profile-feed-list", "sellerdit-profile-card", "프로필 탭"],
  },
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

async function checkRoute(route) {
  const url = new URL(route.path, baseUrl).toString();
  const response = await fetch(url, { redirect: "manual" });
  const text = await response.text();

  if (response.status < 200 || response.status >= 400) {
    fail(`${route.path} returned ${response.status}`);
    return;
  }

  for (const token of route.mustContain || []) {
    if (!text.includes(token)) fail(`${route.path} missing token: ${token}`);
  }

  for (const token of route.mustNotContain || []) {
    if (text.includes(token)) fail(`${route.path} contains forbidden token: ${token}`);
  }

  console.log(`OK ${route.path} ${response.status} ${text.length}b`);
}

async function main() {
  console.log(`Design smoke base: ${baseUrl}`);
  for (const route of routes) await checkRoute(route);

  const cssUrl = new URL("/styles.css", baseUrl).toString();
  const cssResponse = await fetch(cssUrl);
  const css = await cssResponse.text();
  const cssTokens = [
    "sellerdit-layout-shell",
    "sellerdit-layout-grid",
    "--sellerdit-shell-feed-w",
    "--sellerdit-shell-right-w",
    "--sellerdit-shell-left-offset",
    "sellerdit-profile-main",
    "sellerdit-profile-header",
    "sellerdit-tile",
    "sellerdit-supplier-tag",
    "@media",
  ];
  for (const token of cssTokens) {
    if (!css.includes(token)) fail(`/styles.css missing token: ${token}`);
  }
  console.log(`OK /styles.css ${cssResponse.status} ${css.length}b`);

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Design smoke passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
