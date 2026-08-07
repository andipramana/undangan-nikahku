import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "..", "verification-output");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
await page.setViewportSize({ width: 414, height: 896 });
await page.goto("http://localhost:8080/?to=Tamu+Undangan", { waitUntil: "networkidle" });
await page.waitForTimeout(3500); // tunggu animasi masuk cover (2.8s) selesai total
await page.screenshot({ path: path.join(OUT, "qa-01-cover.png") });

await page.click("#btn-open");
await page.waitForTimeout(1200);

const sections = ["couple", "event", "love-story", "gallery", "gift", "rsvp", "share", "closing"];
for (const id of sections) {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `qa-${id}.png`) });
}

// buka panel amplop digital
await page.locator("#gift").scrollIntoViewIfNeeded();
await page.click("#btn-gift-toggle");
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, "qa-gift-open.png") });

// buka lightbox galeri
await page.locator("#gallery").scrollIntoViewIfNeeded();
await page.locator(".gallery-item").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, "qa-lightbox.png") });

await browser.close();
console.log("done");
