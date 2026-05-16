/**
 * upload-to-r2.mjs
 * Uploads game card images from scraped folders to Cloudflare R2.
 * Renames <uuid>_vertical.png@avif  →  games/<category>/<n>.avif
 *
 * Usage:
 *   node scripts/upload-to-r2.mjs
 */

import { readdirSync, existsSync } from "fs";
import { join, extname } from "path";
import { execSync } from "child_process";

const BUCKET = "nezeem-assets";
const CDN = "https://pub-5677b2f8e2e544688a1b6e1d1071f970.r2.dev";

const categories = [
  { name: "nezeem", dir: "E:\\AaPom\\Neemiz\\scraped\\nezeem" },
  { name: "crash",  dir: "E:\\AaPom\\Neemiz\\scraped\\crash"  },
  { name: "mines",  dir: "E:\\AaPom\\Neemiz\\scraped\\mines"  },
  { name: "plinko", dir: "E:\\AaPom\\Neemiz\\scraped\\plinko" },
];

const manifest = {};  // category → [cdnUrl, ...]

for (const cat of categories) {
  console.log(`\n── ${cat.name.toUpperCase()} ─────────────────────────`);

  const files = readdirSync(cat.dir)
    .filter((f) => f.includes("_vertical"))
    .sort();

  manifest[cat.name] = [];
  let n = 1;

  for (const file of files) {
    const localPath = join(cat.dir, file);
    // Determine content-type: treat everything as avif (they're avif regardless of @ext suffix)
    const isWebp = file.endsWith("@webp");
    const contentType = isWebp ? "image/webp" : "image/avif";
    const ext = isWebp ? ".webp" : ".avif";
    const r2Key = `games/${cat.name}/${n}${ext}`;
    const cdnUrl = `${CDN}/${r2Key}`;

    try {
      execSync(
        `wrangler r2 object put "${BUCKET}/${r2Key}" --file "${localPath}" --content-type "${contentType}" --remote`,
        { stdio: "pipe" }
      );
      console.log(`  [${n}] ${file}  →  ${r2Key}`);
      manifest[cat.name].push(cdnUrl);
      n++;
    } catch (err) {
      console.error(`  [error] ${file}: ${err.message.slice(0, 120)}`);
    }
  }

  console.log(`  Total uploaded: ${manifest[cat.name].length}`);
}

// Print the manifest as a JS object for pasting into the dashboard
console.log("\n\n══ MANIFEST (copy into dashboard) ══════════════════════\n");
console.log("const GAME_IMAGES = " + JSON.stringify(manifest, null, 2) + ";");
console.log("\nDone.");
