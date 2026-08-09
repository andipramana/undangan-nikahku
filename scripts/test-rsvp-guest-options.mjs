import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto("http://localhost:4173/?to=Test", { waitUntil: "networkidle" });
  await page.locator("#btn-open").click();
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await page.locator('.rsvp-pill[data-value="hadir"]').click();

  const guestCount = page.locator("#rsvp-guests");
  const tagName = await guestCount.evaluate((el) => el.tagName);
  const values = await guestCount.locator("option").evaluateAll((options) =>
    options.map((option) => option.value)
  );

  if (tagName !== "SELECT" || JSON.stringify(values) !== JSON.stringify(["1", "2", "3", "4"])) {
    throw new Error(`Jumlah tamu harus dropdown 1–4; didapat ${tagName} dengan opsi ${values.join(", ")}`);
  }

  console.log("PASS: jumlah tamu berupa dropdown dengan pilihan 1–4.");
} finally {
  await browser.close();
}
