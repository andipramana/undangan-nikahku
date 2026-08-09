import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto("http://localhost:4173/?to=Test", { waitUntil: "networkidle" });
  await page.locator("#btn-open").click();
  await page.locator("#we-found-love").scrollIntoViewIfNeeded();

  // Tunggu autoplay mulai, lalu ambil dua posisi setelah satu putaran slide
  // seharusnya telah selesai. Bila pita berhenti setelah foto pertama, kedua
  // nilai transform ini akan identik.
  await page.waitForTimeout(5_500);
  const firstPosition = await page.locator(".wfl-slider .swiper-wrapper").evaluate(
    (wrapper) => getComputedStyle(wrapper).transform
  );
  await page.waitForTimeout(1_000);
  const secondPosition = await page.locator(".wfl-slider .swiper-wrapper").evaluate(
    (wrapper) => getComputedStyle(wrapper).transform
  );

  if (firstPosition === secondPosition) {
    throw new Error(
      `We Found Love berhenti setelah berpindah slide: transform tetap ${firstPosition}`
    );
  }

  console.log("PASS: We Found Love terus bergerak setelah transisi pertama.");
} finally {
  await browser.close();
}
