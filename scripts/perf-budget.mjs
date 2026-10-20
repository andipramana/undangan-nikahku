/**
 * Penjaga anggaran performa per template (§3.1 RENCANA-TEMPLATE-V5-ARGON.md).
 * Membaca templates/index.json dan memverifikasi:
 *  - templates/<id>/style.css <= 60 KB (61.440 bytes)
 *  - Total JS per template (manifest.assets.js + render.js) <= 120 KB (122.880 bytes)
 *  - Tidak ada URL CDN eksternal (http/https) di manifest.assets.{fonts,css,js}
 *  - Total modul motion (assets/js/motion/*) per template <= 25 KB (25.600 bytes)
 *  - Font self-hosted di manifest.assets.fonts <= 4 file .woff2 & total <= 180 KB (184.320 bytes)
 *  - Thumbnail katalog templates/<id>/cover.jpg <= 60 KB (61.440 bytes)
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LIMITS = {
  CSS_BYTES: 60 * 1024,
  JS_TOTAL_BYTES: 120 * 1024,
  MOTION_TOTAL_BYTES: 25 * 1024,
  FONT_MAX_FILES: 4,
  FONT_TOTAL_BYTES: 180 * 1024,
  COVER_BYTES: 60 * 1024
};

let failed = 0;
function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failed += 1;
  }
}

async function fileSize(relPath) {
  const full = path.join(ROOT, relPath);
  const st = await fs.stat(full);
  return st.size;
}

const catalogRaw = await fs.readFile(path.join(ROOT, "templates/index.json"), "utf8");
const catalog = JSON.parse(catalogRaw).templates || [];

console.log(`Memeriksa anggaran performa untuk ${catalog.length} template...`);

for (const entry of catalog) {
  const id = entry.id;
  console.log(`\n=== Template: ${id} (${entry.name}) ===`);
  const baseDir = `templates/${id}`;
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, baseDir, "template.json"), "utf8"));
  const assets = manifest.assets || {};

  // 1. CSS <= 60 KB
  const cssSize = await fileSize(`${baseDir}/style.css`);
  check(
    `${id}: style.css <= 60 KB`,
    cssSize <= LIMITS.CSS_BYTES,
    `${(cssSize / 1024).toFixed(1)} KB (${cssSize} B)`
  );

  // 2. Tidak ada URL CDN eksternal di assets.{fonts,css,js}
  const allAssetUrls = [
    ...(assets.fonts || []),
    ...(assets.css || []),
    ...(assets.js || [])
  ];
  const externalUrls = allAssetUrls.filter((u) => /^https?:\/\//i.test(u));
  check(
    `${id}: bebas dependensi CDN eksternal di manifest.assets`,
    externalUrls.length === 0,
    externalUrls.length ? `ditemukan: ${externalUrls.join(", ")}` : "0 URL eksternal"
  );

  // 3. Total JS <= 120 KB & Motion JS <= 25 KB
  const jsFiles = [...(assets.js || []), `${baseDir}/render.js`];
  let totalJsBytes = 0;
  let motionJsBytes = 0;
  for (const jsRel of jsFiles) {
    if (/^https?:\/\//i.test(jsRel)) continue;
    const sz = await fileSize(jsRel);
    totalJsBytes += sz;
    if (jsRel.startsWith("assets/js/motion/")) {
      motionJsBytes += sz;
    }
  }
  check(
    `${id}: total JS <= 120 KB`,
    totalJsBytes <= LIMITS.JS_TOTAL_BYTES,
    `${(totalJsBytes / 1024).toFixed(1)} KB (${totalJsBytes} B)`
  );
  check(
    `${id}: total modul motion <= 25 KB`,
    motionJsBytes <= LIMITS.MOTION_TOTAL_BYTES,
    `${(motionJsBytes / 1024).toFixed(1)} KB (${motionJsBytes} B)`
  );

  // 4. Font self-host <= 4 woff2 & total <= 180 KB
  const fontFiles = assets.fonts || [];
  let totalFontBytes = 0;
  for (const fRel of fontFiles) {
    if (/^https?:\/\//i.test(fRel)) continue;
    totalFontBytes += await fileSize(fRel);
  }
  check(
    `${id}: jumlah font preload <= ${LIMITS.FONT_MAX_FILES} & ukuran <= 180 KB`,
    fontFiles.length <= LIMITS.FONT_MAX_FILES && totalFontBytes <= LIMITS.FONT_TOTAL_BYTES,
    `${fontFiles.length} file, ${(totalFontBytes / 1024).toFixed(1)} KB (${totalFontBytes} B)`
  );

  // 5. Thumbnail katalog cover.jpg <= 60 KB
  const coverSize = await fileSize(`${baseDir}/cover.jpg`);
  check(
    `${id}: cover.jpg <= 60 KB`,
    coverSize <= LIMITS.COVER_BYTES,
    `${(coverSize / 1024).toFixed(1)} KB (${coverSize} B)`
  );
}

if (failed > 0) {
  console.error(`\nPERF BUDGET GAGAL: ${failed} pemeriksaan melewati batas.`);
  process.exit(1);
}
console.log("\nSemua pemeriksaan anggaran performa LULUS (PASS).");
