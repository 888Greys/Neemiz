/**
 * pull-game-images.mjs
 *
 * Scrapes vertical game card images from a 1win-style casino page.
 *
 * Usage:
 *   node scripts/pull-game-images.mjs [url] [outputDir]
 *
 * Examples:
 *   node scripts/pull-game-images.mjs "https://1win.io/casino/fast-games?p=ptmj" public/games/nezeem
 *   node scripts/pull-game-images.mjs "https://1win.io/casino/fast-games?p=ptmj" public/games/all
 *
 * Requires: npx playwright install chromium  (run once)
 */

import { chromium } from "playwright";
import { createWriteStream, mkdirSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import { pipeline } from "stream/promises";
import https from "https";
import http from "http";
import { URL } from "url";

const [, , targetUrl = "https://1win.io/casino/fast-games?p=ptmj&sub1=1xbetxx", outputDir = "public/games/nezeem"] = process.argv;

mkdirSync(outputDir, { recursive: true });

console.log(`\n→ URL:    ${targetUrl}`);
console.log(`→ Output: ${outputDir}\n`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Collect all image URLs that look like game card thumbnails
const collectedUrls = new Set();

page.on("response", async (response) => {
  const url = response.url();
  // Grab images that look like vertical game card thumbnails
  if (
    /\.(webp|avif|png|jpg|jpeg)(\?.*)?$/i.test(url) &&
    /vertical|portrait|cover|thumb|card|game/i.test(url)
  ) {
    collectedUrls.add(url);
  }
});

console.log("Opening page…");
await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });

// Scroll down to trigger lazy-loaded images
console.log("Scrolling to trigger lazy loads…");
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(600);
}
await page.waitForTimeout(2000);

// Also grab src/srcset from <img> tags inside game card elements
const imgUrls = await page.evaluate(() => {
  const imgs = document.querySelectorAll("img");
  const srcs = [];
  imgs.forEach((img) => {
    const src = img.currentSrc || img.src;
    if (src && /\.(webp|avif|png|jpg|jpeg)(\?.*)?$/i.test(src)) {
      srcs.push(src);
    }
  });
  return srcs;
});

imgUrls.forEach((u) => collectedUrls.add(u));

await browser.close();

console.log(`\nFound ${collectedUrls.size} image URL(s) total.`);

// ── Filter: keep only portrait/vertical looking ones ──────────────────────
// Many game card images on 1win come from CDN paths containing "vertical"
// or have ~3:4 aspect ratio. We keep anything with a recognisable pattern.
const filtered = [...collectedUrls].filter((u) => {
  const lower = u.toLowerCase();
  return (
    lower.includes("vertical") ||
    lower.includes("portrait") ||
    lower.includes("cover") ||
    lower.includes("game") ||
    lower.includes("casino") ||
    lower.includes("thumb")
  );
});

const toDownload = filtered.length > 0 ? filtered : [...collectedUrls];
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
    // Build a clean filename from the URL path
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const rawName = pathParts[pathParts.length - 1] || `img_${i}`;
    const ext = extname(rawName) || ".webp";
    const stem = basename(rawName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    const filename = join(outputDir, `${stem}${ext}`);

    if (existsSync(filename)) {
      console.log(`  [skip] ${stem}${ext}`);
      skipped++;
      continue;
    }

    const res = await fetchUrl(url);
    if (res.statusCode !== 200) {
      console.log(`  [${res.statusCode}] ${url}`);
      continue;
    }

    await pipeline(res, createWriteStream(filename));
    console.log(`  [${i + 1}/${toDownload.length}] ${stem}${ext}`);
    downloaded++;
  } catch (err) {
    console.error(`  [error] ${url} — ${err.message}`);
  }
}

console.log(`\nDone. ${downloaded} downloaded, ${skipped} skipped.`);
console.log(`Files saved to: ${outputDir}`);
