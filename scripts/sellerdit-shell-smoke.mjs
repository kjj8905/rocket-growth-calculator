#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = new URL("..", import.meta.url).pathname;
const requestedBaseUrl = process.env.SELLERDIT_SHELL_BASE_URL || "";
const shouldLaunchServer = !requestedBaseUrl;
const port = Number(process.env.SELLERDIT_SHELL_PORT || 4319 + Math.floor(Math.random() * 1000));
const baseUrl = requestedBaseUrl || `http://127.0.0.1:${port}`;
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sellerdit-shell-smoke-"));
const databasePath = path.join(tmpDir, "app.sqlite");
let serverProcess;

const desktopRoutes = [
  "/",
  "/trends",
  "/guides",
  "/community",
  "/community/suppliers",
  "/community/today-logistics-fee-question",
  "/u/%EB%AC%BC%EB%A5%98%EB%B9%84%EA%B3%84%EC%82%B0%EB%9F%AC",
  "/community/saved",
];

const mobileRoutes = [
  "/",
  "/trends",
  "/guides",
  "/community",
  "/community/suppliers",
  "/community/today-logistics-fee-question",
  "/u/%EB%AC%BC%EB%A5%98%EB%B9%84%EA%B3%84%EC%82%B0%EB%9F%AC",
  "/community/saved",
];

function fail(message) {
  throw new Error(message);
}

async function waitForServer() {
  const deadline = Date.now() + 12_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(new URL("/healthz", baseUrl));
      if (response.ok) return;
      lastError = new Error(`healthz ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
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
      SESSION_SECRET: "sellerdit-shell-smoke",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer();
}

async function cleanup() {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!serverProcess.killed) serverProcess.kill("SIGKILL");
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
}

function roundedRect(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.width),
    h: Math.round(rect.height),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
    display: rect.display,
    position: rect.position,
  };
}

async function measure(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        right: box.right,
        bottom: box.bottom,
        display: style.display,
        position: style.position,
      };
    };
    return {
      path: window.location.pathname,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyPaddingTop: getComputedStyle(document.body).paddingTop,
      header: rect(".sellerdit-topbar"),
      topbarInner: rect(".sellerdit-topbar-inner"),
      main: rect("main.community-shell, main"),
      workspace: rect(".community-reddit-layout, .trend-page, .community-forum-shell, .guide-detail-layout"),
      leftRail: rect(".community-left-rail"),
      feed: rect(".community-feed-panel, .community-detail-main, .trend-page, .guide-article"),
      rightRail: rect(".community-right-rail, .guide-detail-sidebar"),
      bottomTab: rect(".sellerdit-bottom-tab"),
      notificationPanelHidden: document.querySelector("[data-notification-panel]")?.hidden ?? null,
    };
  });
}

function pageViewportHeight(metrics) {
  return Math.round(metrics.innerHeight || 0);
}

function assertShellMetrics(label, metrics, viewportWidth, mode) {
  const header = roundedRect(metrics.header);
  const inner = roundedRect(metrics.topbarInner);
  const main = roundedRect(metrics.main);
  const feed = roundedRect(metrics.feed);
  const bottomTab = roundedRect(metrics.bottomTab);

  if (metrics.scrollWidth > metrics.clientWidth) {
    fail(`${label} horizontal overflow ${metrics.scrollWidth}/${metrics.clientWidth}`);
  }
  if (!header || header.x !== 0 || header.right !== viewportWidth) {
    fail(`${label} header must span viewport, got ${JSON.stringify(header)}`);
  }
  if (!inner || inner.h <= 0 || inner.y < -1) {
    fail(`${label} topbar inner clipped, got ${JSON.stringify(inner)}`);
  }
  if (!main || main.w <= 0 || main.right > viewportWidth + 1) {
    fail(`${label} main out of viewport, got ${JSON.stringify(main)}`);
  }
  if (feed && feed.right > viewportWidth + 1) {
    fail(`${label} content out of viewport, got ${JSON.stringify(feed)}`);
  }
  if (mode === "mobile") {
    if (!bottomTab || bottomTab.display === "none" || bottomTab.position !== "fixed" || Math.abs(bottomTab.bottom - pageViewportHeight(metrics)) > 1) {
      fail(`${label} mobile bottom tab is not fixed/visible, got ${JSON.stringify(bottomTab)}`);
    }
    if (![56, 64].includes(header.h)) {
      fail(`${label} mobile header height must be 56/64, got ${header.h}`);
    }
  } else if (header.h !== 56) {
    fail(`${label} desktop header height must be 56, got ${header.h}`);
  }
}

async function assertMobileInteractions(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(new URL("/community", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.locator("[data-mobile-drawer-open]").first().click();
  await page.waitForTimeout(120);
  const drawerOpen = await page.evaluate(() => document.body.classList.contains("sellerdit-drawer-open"));
  await page.locator("[data-mobile-drawer-open]").first().click();
  await page.waitForTimeout(120);
  const drawerClosed = await page.evaluate(() => !document.body.classList.contains("sellerdit-drawer-open"));
  if (!drawerOpen || !drawerClosed) fail(`mobile drawer toggle failed open=${drawerOpen} closed=${drawerClosed}`);

  await page.locator("[data-notification-button]").last().click();
  await page.waitForTimeout(180);
  const notification = await page.evaluate(() => ({
    toastVisible: document.querySelector("[data-community-toast]")?.classList.contains("is-visible") || false,
    panelHidden: document.querySelector("[data-notification-panel]")?.hidden ?? false,
  }));
  if (!notification.toastVisible || !notification.panelHidden) {
    fail(`logged-out notification must use centered toast and keep panel hidden: ${JSON.stringify(notification)}`);
  }
  await page.close();
}

async function assertCalculatorDirect(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  await page.goto(new URL("/rocket-growth-calculator", baseUrl).toString(), { waitUntil: "networkidle" });
  const result = await page.evaluate(() => ({
    href: window.location.href,
    visibleInputs: [...document.querySelectorAll("input")].filter((input) => input.type !== "hidden" && input.offsetWidth > 0 && input.offsetHeight > 0).length,
    hasResult: document.body.innerText.includes("실시간 예상 결과"),
  }));
  if (!result.href.includes("calc=china") || result.visibleInputs < 5 || !result.hasResult) {
    fail(`calculator direct shell failed: ${JSON.stringify(result)}`);
  }
  await page.close();
}

async function main() {
  console.log(`Sellerdit shell smoke base: ${baseUrl}`);
  await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of desktopRoutes) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
      assertShellMetrics(`desktop ${route}`, await measure(page), 1440, "desktop");
      await page.close();
      console.log(`OK desktop ${route}`);
    }
    for (const width of [280, 390, 600, 768]) {
      for (const route of mobileRoutes) {
        const page = await browser.newPage({ viewport: { width, height: width === 280 ? 653 : 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
        await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "networkidle" });
        assertShellMetrics(`mobile ${width} ${route}`, await measure(page), width, "mobile");
        await page.close();
      }
      console.log(`OK mobile shell width ${width}`);
    }
    await assertMobileInteractions(browser);
    console.log("OK mobile interactions");
    await assertCalculatorDirect(browser);
    console.log("OK calculator direct route");
  } finally {
    await browser.close();
  }
  console.log("Sellerdit shell smoke passed");
}

try {
  await main();
} finally {
  await cleanup();
}
