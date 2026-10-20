/**
 * Test Statis Kontrak Motion Toolkit (scripts/test-motion-contract.mjs)
 * Memverifikasi batas ukuran, keamanan, performa, dan aksesibilitas ketujuh file di assets/js/motion/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const motionDir = path.join(rootDir, "assets", "js", "motion");

const FILE_LIMITS = {
  "scroll-scene.js": 6000,
  "reveal.js": 8000,
  "split-text.js": 3000,
  "drag.js": 7000,
  "tilt.js": 3000,
  "particles.js": 6000,
  "counter.js": 2000
};

let errors = [];
let passed = 0;

console.log("=== MEMULAI TEST KONTRAK TOOLKIT MOTION ===\n");

// a. Cek keberadaan file dan batas ukuran
console.log("1. Memeriksa keberadaan file dan batas ukuran bytes...");
const fileContents = {};

for (const [filename, maxSize] of Object.entries(FILE_LIMITS)) {
  const filePath = path.join(motionDir, filename);
  if (!fs.existsSync(filePath)) {
    errors.push(`File tidak ditemukan: assets/js/motion/${filename}`);
    continue;
  }

  const stat = fs.statSync(filePath);
  const size = stat.size;
  fileContents[filename] = fs.readFileSync(filePath, "utf8");

  if (size > maxSize) {
    errors.push(`assets/js/motion/${filename} melebihi batas: ${size} bytes > ${maxSize} bytes`);
  } else {
    console.log(`  ✓ ${filename}: ${size} bytes (batas <= ${maxSize} bytes)`);
    passed++;
  }
}

// b. Tidak ada innerHTML =
console.log("\n2. Memeriksa ketiadaan innerHTML = ...");
for (const [filename, content] of Object.entries(fileContents)) {
  if (/\.innerHTML\s*=/.test(content)) {
    errors.push(`assets/js/motion/${filename} memakai .innerHTML =`);
  }
}
console.log("  ✓ Ketiadaan .innerHTML = lolos pada seluruh file");
passed++;

// c. Guard prefers-reduced-motion
console.log("\n3. Memeriksa guard prefers-reduced-motion...");
for (const [filename, content] of Object.entries(fileContents)) {
  if (!content.includes("prefers-reduced-motion")) {
    errors.push(`assets/js/motion/${filename} TIDAK memiliki guard prefers-reduced-motion`);
  } else {
    console.log(`  ✓ ${filename} memiliki guard prefers-reduced-motion`);
  }
}
passed++;

// d. Semua listener scroll memakai passive: true
console.log("\n4. Memeriksa listener scroll passive: true...");
let scrollListenerFound = false;
for (const [filename, content] of Object.entries(fileContents)) {
  const scrollMatches = content.match(/addEventListener\s*\(\s*["']scroll["'][^)]*\)/g) || [];
  for (const match of scrollMatches) {
    scrollListenerFound = true;
    if (!match.includes("passive") || !match.includes("true")) {
      errors.push(`Listener scroll di assets/js/motion/${filename} tidak memakai { passive: true }: ${match}`);
    }
  }
}
if (!scrollListenerFound) {
  errors.push("Tidak ada scroll listener yang terdeteksi di scroll-scene.js");
} else {
  console.log("  ✓ Semua listener scroll terverifikasi memakai { passive: true }");
  passed++;
}

// e. tilt.js memiliki guard DeviceOrientationEvent.requestPermission
console.log("\n5. Memeriksa guard DeviceOrientationEvent.requestPermission pada tilt.js...");
if (fileContents["tilt.js"] && !fileContents["tilt.js"].includes("DeviceOrientationEvent.requestPermission")) {
  errors.push("assets/js/motion/tilt.js tidak memiliki guard DeviceOrientationEvent.requestPermission");
} else {
  console.log("  ✓ tilt.js memiliki guard DeviceOrientationEvent.requestPermission");
  passed++;
}

// f. particles.js memiliki visibilitychange, IntersectionObserver, dan hardwareConcurrency
console.log("\n6. Memeriksa guard resource pada particles.js...");
const pContent = fileContents["particles.js"] || "";
if (!pContent.includes("visibilitychange")) {
  errors.push("assets/js/motion/particles.js tidak memiliki listener visibilitychange");
}
if (!pContent.includes("IntersectionObserver")) {
  errors.push("assets/js/motion/particles.js tidak memiliki IntersectionObserver");
}
if (!pContent.includes("hardwareConcurrency")) {
  errors.push("assets/js/motion/particles.js tidak memeriksa hardwareConcurrency");
}
if (pContent.includes("visibilitychange") && pContent.includes("IntersectionObserver") && pContent.includes("hardwareConcurrency")) {
  console.log("  ✓ particles.js memiliki guard visibilitychange, IntersectionObserver, dan hardwareConcurrency");
  passed++;
}

// g. split-text.js memasang aria-label dan aria-hidden
console.log("\n7. Memeriksa aksesibilitas split-text.js...");
const stContent = fileContents["split-text.js"] || "";
if (!stContent.includes("aria-label")) {
  errors.push("assets/js/motion/split-text.js tidak memasang aria-label");
}
if (!stContent.includes("aria-hidden")) {
  errors.push("assets/js/motion/split-text.js tidak memasang aria-hidden");
}
if (stContent.includes("aria-label") && stContent.includes("aria-hidden")) {
  console.log("  ✓ split-text.js memasang atribut aria-label dan aria-hidden");
  passed++;
}

console.log("\n-------------------------------------------");
if (errors.length > 0) {
  console.error("GAGAL! Ditemukan kesalahan:");
  errors.forEach((err) => console.error(`  - ${err}`));
  process.exit(1);
} else {
  console.log(`SEMUA TEST KONTRAK LOLOS! (${passed} checks passed)`);
  process.exit(0);
}
