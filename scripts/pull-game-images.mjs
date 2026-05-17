/**
 * pull-game-images.mjs
 *
 * Downloads vertical game card images from a 1win-style casino page.
 * Uses system Chrome via puppeteer-core — no browser download required.
 *
 * Usage:
 *   node scripts/pull-game-images.mjs [url] [outputDir]
 *
 * Examples:
 *   node scripts/pull-game-images.mjs "https://1win.io/casino?p=ptmj&sub1=1xbetxx" public/games/crash
 *   node scripts/pull-game-images.mjs "https://1win.io/casino?p=ptmj&sub1=1xbetxx" public/games/all
 */

import puppeteer from "puppeteer-core";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import { pipeline } from "stream/promises";
import https from "https";
import http from "http";
import { URL } from "url";
import os from "os";

// Work around broken system Temp dir — use a unique profile dir per invocation
const PROFILE_DIR = join(process.cwd(), `.puppeteer-profile-${process.pid}`);
mkdirSync(PROFILE_DIR, { recursive: true });
// Cleanup on exit
process.on("exit", () => { try { import("fs").then(({rmSync}) => rmSync(PROFILE_DIR, {recursive:true, force:true})); } catch {} });

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const [, , targetUrl = "https://1win.io/casino?p=ptmj&sub1=1xbetxx", outputDir = "public/games/all"] = process.argv;

mkdirSync(outputDir, { recursive: true });

console.log(`\n→ URL:    ${targetUrl}`);
console.log(`→ Output: ${outputDir}`);
console.log(`→ Chrome: ${CHROME_PATH}\n`);

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: "new",
  userDataDir: PROFILE_DIR,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1400,900",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
);

// Intercept all image responses
const collectedUrls = new Set();

page.on("response", async (response) => {
  const url = response.url();
  const ct = response.headers()["content-type"] || "";
  // Capture by content-type OR URL extension — handles UUID-named files with no extension
  if (ct.startsWith("image/") || /\.(webp|avif|png|jpg|jpeg)(\?.*)?$/i.test(url)) {
    collectedUrls.add(url);
  }
});

console.log("Opening page…");
try {
  await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 60_000 });
} catch {
  console.log("(networkidle2 timed out — continuing with what loaded)");
}

// Scroll to trigger lazy loads
console.log("Scrolling to trigger lazy loads…");
for (let i = 0; i < 12; i++) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
  await new Promise((r) => setTimeout(r, 700));
}
await new Promise((r) => setTimeout(r, 2000));

// Also grab src from <img> tags
const imgUrls = await page.evaluate(() =>
  [...document.querySelectorAll("img")].map((img) => img.currentSrc || img.src).filter(Boolean)
);
imgUrls.forEach((u) => collectedUrls.add(u));

// Background images from CSS
const bgUrls = await page.evaluate(() => {
  const urls = [];
  document.querySelectorAll("*").forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
    if (match) urls.push(match[1]);
  });
  return urls;
});
bgUrls.forEach((u) => collectedUrls.add(u));

await browser.close();

console.log(`\nFound ${collectedUrls.size} image URL(s) total.`);

// Keep game card images — they use proxy URLs without file extensions
const toDownload = [...collectedUrls].filter((u) => {
  if (!u.startsWith("http")) return false;
  const lower = u.toLowerCase();
  if (lower.includes("data:")) return false;
  if (lower.endsWith(".svg")) return false;
  if (lower.includes("favicon")) return false;
  // Keep 1win-style image proxy URLs (no file extension but clearly images)
  if (lower.includes("casino_game_card")) return true;
  if (lower.includes("optimizeimages")) return true;
  if (lower.includes("bundlecdn") && !lower.includes(".js")) return true;
  // Keep standard image extensions
  return /\.(webp|avif|png|jpg|jpeg)(\?.*)?$/i.test(u);
});

console.log(`Downloading ${toDownload.length} image(s)…\n`);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    lib
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(fetchUrl(res.headers.location));
        } else {
          resolve(res);
        }
      })
      .on("error", reject);
  });
}

let downloaded = 0;
let skipped = 0;

for (const [i, url] of toDownload.entries()) {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    let rawName = pathParts[pathParts.length - 1] || `img_${i}`;

    // For proxy URLs like /optimizeimages/.../plain/https://...bundlecdn.com/path/file.avif
    // extract the real filename from the end of the proxied URL
    if (url.includes("optimizeimages") || url.includes("plain/https")) {
      const innerUrl = decodeURIComponent(url).split("plain/https").pop() || rawName;
      const innerParts = innerUrl.split("/").filter(Boolean);
      rawName = innerParts[innerParts.length - 1] || rawName;
    }

    const ext = extname(rawName) || ".avif";
    const stem = basename(rawName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const filename = join(outputDir, `${stem}${ext}`);

    if (existsSync(filename)) {
      console.log(`  [skip] ${stem}${ext}`);
      skipped++;
      continue;
    }

    const res = await fetchUrl(url);
    if (res.statusCode !== 200) {
      console.log(`  [${res.statusCode}] ${url.slice(0, 80)}`);
      continue;
    }

    await pipeline(res, createWriteStream(filename));
    console.log(`  [${i + 1}/${toDownload.length}] ${stem}${ext}`);
    downloaded++;
  } catch (err) {
    console.error(`  [error] ${url.slice(0, 80)} — ${err.message}`);
  }
}

console.log(`\nDone. ${downloaded} downloaded, ${skipped} skipped.`);
console.log(`Files saved to: ${outputDir}`);
