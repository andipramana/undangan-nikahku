import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto("http://localhost:4173/?to=Test", { waitUntil: "networkidle" });
  await page.locator("#btn-open").click();
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    // rsvp.js kirim lewat RPC submit_wish (anti-spam device_token) di secure
    // context — Playwright localhost selalu punya crypto.randomUUID, jadi
    // jalur .from().insert() di bawah tidak pernah dipakai lagi, cuma
    // cadangan. Mock TANPA .rpc() bikin submit throw TypeError tak
    // tertangani dan test macet menunggu kartu yang tidak pernah dirender
    // (pola sama dengan test-rsvp-stale-load.mjs).
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
      },
      rpc(name, params) {
        if (name !== "submit_wish") return Promise.resolve({ data: null, error: new Error(`RPC tak dikenal di mock: ${name}`) });
        return Promise.resolve({
          data: {
            id: "test-wish", invitation_id: params.p_invitation_id, name: params.p_name,
            attendance: params.p_attendance, guest_count: params.p_guest_count, message: params.p_message,
            created_at: new Date().toISOString()
          },
          error: null
        });
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
