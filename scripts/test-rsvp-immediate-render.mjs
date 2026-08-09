import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto("http://localhost:4173/?to=Test", { waitUntil: "networkidle" });
  await page.locator("#btn-open").click();
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window.sb = {
      from() {
        return {
          insert(payload) {
            return {
              select() {
                return {
                  single: async () => ({
                    data: { ...payload, id: "test-wish", created_at: new Date().toISOString() },
                    error: null
                  })
                };
              }
            };
          }
        };
      }
    };
  });

  await page.locator('.rsvp-pill[data-value="hadir"]').click();
  await page.locator("#rsvp-message").fill("Semoga bahagia selalu.");
  await page.locator("#rsvp-form").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(
    () => document.querySelector(".wish-card__message")?.textContent === "Semoga bahagia selalu."
  );

  console.log("PASS: ucapan baru langsung dirender tanpa refresh.");
} finally {
  await browser.close();
}
