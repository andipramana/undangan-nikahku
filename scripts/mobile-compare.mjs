import { chromium } from "@playwright/test";
import path from "node:path";
const OUT = path.resolve("verification-output");

const browser = await chromium.launch();

async function walkThrough(label, url, openSelectors) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, `mc-${label}-00-cover.png`) });

  for (const sel of openSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click({ timeout: 3000 });
        break;
      }
    } catch {}
  }
  await page.waitForTimeout(1200);

  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewport = 844;
  const steps = Math.ceil(totalHeight / viewport);
  for (let i = 1; i <= Math.min(steps, 10); i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * viewport);
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `mc-${label}-${String(i).padStart(2, "0")}.png`) });
  }

  await context.close();
}

await walkThrough("ref", "https://lovelisse.unweb.id/luxury-02/?to=Nama+Tamu", ["#tombol-buka", "text=/buka undangan/i"]);
await walkThrough("local", "http://localhost:8080/?to=Tamu+Undangan", ["#btn-open"]);

await browser.close();
console.log("done");
