#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = new URL("..", import.meta.url).pathname;
const requiredFiles = [
  "capacitor.config.json",
  "capacitor-www/index.html",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/build.gradle",
  "android/app/src/main/res/values/strings.xml",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png",
  "android/app/src/main/res/drawable/splash.png",
];

function fail(message) {
  throw new Error(message);
}

function read(filePath) {
  return fs.readFileSync(path.join(rootDir, filePath), "utf8");
}

for (const filePath of requiredFiles) {
  if (!fs.existsSync(path.join(rootDir, filePath))) fail(`missing ${filePath}`);
}

const config = JSON.parse(read("capacitor.config.json"));
if (config.appId !== "site.wingcoupang.sellerdit") fail("unexpected Capacitor appId");
if (config.appName !== "셀러딧") fail("unexpected Capacitor appName");
if (config.webDir !== "capacitor-www") fail("unexpected Capacitor webDir");
if (config.server?.url !== "https://wingcoupang.site") fail("Capacitor server.url must point to production HTTPS");
if (config.server?.cleartext !== false) fail("Capacitor cleartext must be false");
if (config.android?.allowMixedContent !== false) fail("Android mixed content must be disabled");

const manifest = read("android/app/src/main/AndroidManifest.xml");
if (!manifest.includes('android.permission.INTERNET')) fail("Android INTERNET permission missing");
if (!manifest.includes('android:exported="true"')) fail("Android launcher activity exported flag missing");
if (manifest.includes('android:usesCleartextTraffic="true"')) fail("Android cleartext traffic must not be enabled");

const gradle = read("android/app/build.gradle");
if (!gradle.includes('applicationId "site.wingcoupang.sellerdit"')) fail("Android applicationId mismatch");
if (!gradle.includes('versionCode 1')) fail("Android versionCode should be explicit");
if (!gradle.includes('versionName "1.0"')) fail("Android versionName should be explicit");

const strings = read("android/app/src/main/res/values/strings.xml");
if (!strings.includes('<string name="app_name">셀러딧</string>')) fail("Android app_name mismatch");
if (!strings.includes('<string name="title_activity_main">셀러딧</string>')) fail("Android title mismatch");

const syncedConfig = JSON.parse(read("android/app/src/main/assets/capacitor.config.json"));
if (syncedConfig.server?.url !== config.server.url) fail("Android synced capacitor config is stale; run npm run app:sync");

try {
  execFileSync("git", ["diff", "--quiet", "--", "android/app/src/main/assets/capacitor.config.json"], { cwd: rootDir });
} catch {
  fail("Android Capacitor config has unsynced diff; run npm run app:sync and commit generated files");
}

console.log("Capacitor predeploy check passed");
console.log("NOTE Android release build still requires local JDK + Android SDK/Android Studio before store upload.");
