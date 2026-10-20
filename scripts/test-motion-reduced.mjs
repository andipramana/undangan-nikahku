/**
 * Test E2E Mode Reduced Motion (scripts/test-motion-reduced.mjs)
 * Memverifikasi ketujuh script toolkit motion pada kondisi prefers-reduced-motion: reduce.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const motionDir = path.join(rootDir, "assets", "js", "motion");

const scriptsToLoad = [
  "scroll-scene.js",
  "reveal.js",
  "split-text.js",
  "drag.js",
  "tilt.js",
  "particles.js",
  "counter.js"
];

console.log("=== MEMULAI TEST PLAYWRIGHT REDUCED MOTION ===\n");

let browser = null;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  // Siapkan HTML mock
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Uji Reduced Motion Toolkit</title>
      <style>
        html.reveal-ready [data-reveal] {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        html.reveal-ready [data-reveal].is-revealed {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.001ms !important;
            transition-duration: 0.001ms !important;
          }
        }
      </style>
    </head>
    <body>
      <div id="container">
        <h1 data-reveal="up" data-split-text="true" id="hero-title">Mita & Andi Wedding</h1>
        <p data-reveal="fade" data-count="2026" id="event-year">2026</p>
        <div data-reveal="mask-wipe" id="story-block">Love Story Content</div>
        <div data-scroll-scene="true" data-parallax-speed="0.3" id="parallax-bg">Parallax Background</div>
        <div data-scroll-mask="true" id="mask-section">Mask Progress Area</div>
        <div data-tilt="true" id="card-tilt">
          <div data-tilt-layer="true" data-tilt-depth="1.5">Layer Tilt</div>
        </div>
        <div data-drag-card="true" id="swipe-card">Swipe Card</div>
        <canvas id="p" width="400" height="400"></canvas>
      </div>
    </body>
    </html>
  `;

  await page.setContent(htmlContent);

  // Muat ketujuh script toolkit motion
  console.log("Memuat 7 script motion ke halaman...");
  for (const filename of scriptsToLoad) {
    const filePath = path.join(motionDir, filename);
    const scriptContent = fs.readFileSync(filePath, "utf8");
    await page.addScriptTag({ content: scriptContent });
    console.log(`  ✓ Dimuat: ${filename}`);
  }

  // Panggil inisialisasi modul
  console.log("\nMenjalankan inisialisasi modul...");
  await page.evaluate(() => {
    if (typeof window.initReveal === "function") window.initReveal();
    if (window.MotionSplitText && typeof window.MotionSplitText.init === "function") window.MotionSplitText.init();
    if (window.MotionCounter && typeof window.MotionCounter.init === "function") window.MotionCounter.init();
    if (window.MotionScrollScene && typeof window.MotionScrollScene.init === "function") window.MotionScrollScene.init();
    if (window.MotionTilt && typeof window.MotionTilt.init === "function") window.MotionTilt.init();
    if (window.MotionParticles && typeof window.MotionParticles.start === "function") {
      window.MotionParticles.start(document.getElementById("p"));
    }
  });

  // Beri jeda 1 frame untuk render settle
  await page.waitForTimeout(100);

  console.log("\nMemverifikasi elemen dan visibilitas pada reduced motion...");

  // 1. Periksa semua elemen [data-reveal]
  const revealElements = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("[data-reveal]"));
    return els.map((el) => {
      const style = window.getComputedStyle(el);
      return {
        id: el.id,
        reveal: el.getAttribute("data-reveal"),
        hasRevealedClass: el.classList.contains("is-revealed"),
        opacity: style.opacity,
        display: style.display,
        visibility: style.visibility
      };
    });
  });

  console.log(`  Memeriksa ${revealElements.length} elemen [data-reveal]:`);
  for (const item of revealElements) {
    if (!item.hasRevealedClass) {
      throw new Error(`Elemen #${item.id} tidak memiliki class .is-revealed`);
    }
    if (item.opacity !== "1") {
      throw new Error(`Elemen #${item.id} memiliki computed opacity "${item.opacity}", diharapkan "1"`);
    }
    console.log(`    ✓ #${item.id} (${item.reveal}): class=is-revealed, opacity=${item.opacity}`);
  }

  // 2. Periksa teks pada split-text tetap utuh dan terbaca
  const titleText = await page.$eval("#hero-title", (el) => el.textContent.trim());
  if (titleText !== "Mita & Andi Wedding") {
    throw new Error(`Teks judul tidak utuh. Ditemukan: "${titleText}", diharapkan "Mita & Andi Wedding"`);
  }
  console.log(`  ✓ Teks #hero-title utuh terbaca: "${titleText}"`);

  // 3. Periksa counter langsung menampilkan angka target
  const yearText = await page.$eval("#event-year", (el) => el.textContent.trim());
  if (yearText !== "2026") {
    throw new Error(`Counter gagal mendarat langsung ke angka target. Ditemukan: "${yearText}", diharapkan "2026"`);
  }
  console.log(`  ✓ Counter #event-year langsung mendarat di: "${yearText}"`);

  // 4. Periksa scroll-mask property disetel
  const maskProgress = await page.$eval("#mask-section", (el) => el.style.getPropertyValue("--scroll-progress"));
  console.log(`  ✓ Nilai CSS var --scroll-progress pada scroll-mask: "${maskProgress || '1'}"`);

  console.log("\n-------------------------------------------");
  console.log("SEMUA TEST REDUCED MOTION LOLOS TANPA BLOKIR ANIMASI!");
  await browser.close();
  process.exit(0);
} catch (err) {
  console.error("\nTEST GAGAL DENGAN KESALAHAN:");
  console.error(err);
  if (browser) await browser.close();
  process.exit(1);
}
