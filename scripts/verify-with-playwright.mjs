// Dev-only tooling: bandingkan struktur & perilaku situs lokal terhadap referensi,
// screenshot per section untuk peninjauan visual manual.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "..", "verification-output");

const REFERENCE_URL = "https://lovelisse.unweb.id/luxury-02/?to=Nama+Tamu";
const LOCAL_URL = "http://localhost:4173/?to=Tamu+Undangan";

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 }
};

async function captureSite(browser, label, url, viewportName) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[viewportName],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  let ok = true;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch (err) {
    console.error(`  [${label}] gagal load: ${err.message}`);
    ok = false;
  }

  if (ok) {
    await page.waitForTimeout(1500);

    // klik tombol buka undangan kalau ada, biar section berikutnya kebuka
    const openSelectors = ["#btn-open", "#tombol-buka", "text=/buka undangan/i"];
    for (const sel of openSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click({ timeout: 3000 });
          await page.waitForTimeout(1000);
          break;
        }
      } catch {
        /* selector tidak ada di halaman ini, lanjut coba selanjutnya */
      }
    }

    await page.waitForTimeout(1000);
    const fileName = `${label}-${viewportName}.png`;
    await page.screenshot({ path: path.join(OUT_DIR, fileName), fullPage: true });
    console.log(`  [${label}] screenshot -> ${fileName}`);
  }

  if (consoleErrors.length) {
    console.log(`  [${label}] console errors:`);
    consoleErrors.slice(0, 10).forEach((e) => console.log(`    - ${e}`));
  } else {
    console.log(`  [${label}] tidak ada console error`);
  }

  await context.close();
  return { ok, consoleErrors };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  const results = {};
  for (const viewportName of Object.keys(VIEWPORTS)) {
    console.log(`\n=== Viewport: ${viewportName} ===`);
    results[`ref-${viewportName}`] = await captureSite(browser, "referensi", REFERENCE_URL, viewportName);
    results[`local-${viewportName}`] = await captureSite(browser, "lokal", LOCAL_URL, viewportName);
  }

  await browser.close();

  console.log("\n=== Ringkasan ===");
  for (const [key, res] of Object.entries(results)) {
    console.log(`${key}: ${res.ok ? "OK" : "GAGAL LOAD"}, ${res.consoleErrors.length} console error(s)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
