import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const rsvpSource = await fs.readFile("assets/js/rsvp.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.setContent(`
    <form id="rsvp-form"><input id="rsvp-name"><div id="rsvp-attendance"><button type="button" class="rsvp-pill" data-value="hadir">Hadir</button></div><label><select id="rsvp-guests"><option value="1">1</option></select></label><textarea id="rsvp-message"></textarea><button id="rsvp-submit">Kirim</button></form>
    <p id="rsvp-status"></p><div class="is-revealed" data-reveal-group><div id="wishes-list"></div></div>
  `);
  await page.evaluate((source) => {
    let resolveInitialRead;
    window.WEDDING_CONFIG = { guestParam: "to", supabase: { wishesTable: "wishes" } };
    window.TenantContext = { invitationId: "tenant-a" };
    window.revealNow = () => {};
    window.sb = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return new Promise((resolve) => { resolveInitialRead = resolve; }); },
          insert(payload) {
            return { select() { return { single: async () => ({ data: { ...payload, id: "new" }, error: null }) }; } };
          }
        };
      }
    };
    window.__resolveInitialRead = () => resolveInitialRead({ data: [{ id: "old", name: "Tamu Lama", attendance: "hadir", message: "Doa lama" }], error: null });
    // eslint-disable-next-line no-eval
    eval(source);
    window.initRsvp();
  }, rsvpSource);

  await page.locator('.rsvp-pill[data-value="hadir"]').click();
  await page.locator("#rsvp-message").fill("Doa baru");
  await page.locator("#rsvp-form").evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => document.querySelector(".wish-card__message")?.textContent === "Doa baru");
  await page.evaluate(() => window.__resolveInitialRead());
  await page.waitForTimeout(100);

  const messages = await page.locator(".wish-card__message").allTextContents();
  const earlyReveal = await page.locator(".wish-card").evaluateAll((cards) => cards.every((card) => card.hasAttribute("data-reveal-early")));
  if (!messages.includes("Doa baru")) throw new Error(`Ucapan baru tertimpa respons lama: ${messages.join(", ")}`);
  if (!earlyReveal) throw new Error("Kartu ucapan baru tidak didaftarkan ke pemicu reveal bawah viewport.");
  console.log("PASS: respons lama tidak menghapus ucapan baru; kartu menunggu reveal saat masuk viewport.");
} finally {
  await browser.close();
}
