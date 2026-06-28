#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const rootDir = new URL("..", import.meta.url).pathname;
const requestedBaseUrl = process.env.PWA_SMOKE_BASE_URL || "";
const shouldLaunchServer = !requestedBaseUrl;
const port = Number(process.env.PWA_SMOKE_PORT || 4197 + Math.floor(Math.random() * 1000));
const baseUrl = requestedBaseUrl || `http://127.0.0.1:${port}`;
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sellerdit-pwa-smoke-"));
const databasePath = path.join(tmpDir, "app.sqlite");
let serverProcess;

function fail(message) {
  throw new Error(message);
}

async function fetchText(pathname, options = {}) {
  const response = await fetch(new URL(pathname, baseUrl), { redirect: options.redirect || "follow" });
  const text = await response.text();
  if (options.status && response.status !== options.status) {
    fail(`${pathname} expected ${options.status}, got ${response.status}: ${text.slice(0, 200)}`);
  }
  if (!options.status && (response.status < 200 || response.status >= 300)) {
    fail(`${pathname} returned ${response.status}: ${text.slice(0, 200)}`);
  }
  return { response, text };
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await fetchText("/healthz", { status: 200 });
      return;
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
      SESSION_SECRET: "sellerdit-pwa-smoke",
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

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) fail(`${label} missing ${needle}`);
}

async function main() {
  console.log(`PWA smoke base: ${baseUrl}`);
  await startServer();

  const manifestResult = await fetchText("/manifest.webmanifest", { status: 200 });
  const manifestType = manifestResult.response.headers.get("content-type") || "";
  if (!manifestType.includes("application/manifest+json")) fail(`manifest content-type is ${manifestType}`);
  const manifest = JSON.parse(manifestResult.text);
  if (manifest.name !== "셀러딧 커뮤니티") fail("manifest name mismatch");
  if (manifest.start_url !== "/community?source=pwa") fail("manifest start_url mismatch");
  if (manifest.display !== "standalone") fail("manifest display mismatch");
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 1) fail("manifest icons missing");
  console.log("OK manifest.webmanifest");

  const swResult = await fetchText("/service-worker.js", { status: 200 });
  const swType = swResult.response.headers.get("content-type") || "";
  if (!swType.includes("javascript")) fail(`service worker content-type is ${swType}`);
  assertIncludes(swResult.text, "self.addEventListener(\"install\"", "service worker");
  assertIncludes(swResult.text, "networkFirst", "service worker");
  console.log("OK service-worker.js");

  for (const pathname of ["/", "/community", "/community/suppliers", "/community/user-q-price-19900-margin", "/u/%EC%B4%88%EB%B3%B4%EC%85%80%EB%9F%AC%EB%AF%BC%EC%88%98"]) {
    const page = await fetchText(pathname, { status: 200 });
    assertIncludes(page.text, '<link rel="manifest" href="/manifest.webmanifest"', pathname);
    assertIncludes(page.text, "navigator.serviceWorker.register('/service-worker.js')", pathname);
    console.log(`OK PWA tags ${pathname}`);
  }

  console.log("PWA smoke passed");
}

try {
  await main();
} finally {
  await cleanup();
}
