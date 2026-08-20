/**
 * Ditemukan gagal (timeout) saat menjalankan seluruh scripts/test-*.mjs untuk
 * docs/rencana-admin-v2-revisi.md R4 — TIDAK terkait admin panel sama sekali
 * (assets/js/rsvp.js halaman tamu, tidak disentuh rewrite mana pun). Sebabnya
 * mock window.sb di bawah ini basi: rsvp.js sudah dipindah ke RPC submit_wish
 * (anti-spam device_token) di commit lain, tapi mock test ini belum diikutkan
 * .rpc(), jadi submit selalu TypeError tak tertangani sebelum sempat merender
 * kartu apa pun. Diperbaiki di mock (bukan rsvp.js) — perilaku asli produk
 * tidak berubah, cuma test lamanya yang basi.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const rsvpSource = await fs.readFile("assets/js/rsvp.js", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.setContent(`
    <form id="rsvp-form"><input id="rsvp-name"><div id="rsvp-attendance"><button type="button" class="rsvp-pill" data-value="hadir">Hadir</button></div><textarea id="rsvp-message"></textarea><button id="rsvp-submit">Kirim</button></form>
    <p id="rsvp-status"></p><div class="is-revealed" data-reveal-group><div id="wishes-list"></div></div>
  `);
  await page.evaluate((source) => {
    // page.setContent() memberi dokumen origin "opaque" — Chromium menolak
    // AKSES ke window.localStorage sama sekali di situ (bukan cuma nilainya
    // kosong, membacanya melempar SecurityError). deviceToken() di rsvp.js
    // membaca localStorage sebelum sempat memanggil sb.rpc(), jadi tanpa ini
    // submit gagal diam-diam sebelum sempat merender apa pun. Ini keterbatasan
    // harness page.setContent(), bukan bug rsvp.js (yang jalan normal di
    // origin http/https sungguhan).
    Object.defineProperty(window, "localStorage", {
      value: { getItem: () => null, setItem: () => {} },
      configurable: true, writable: true
    });
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
          range() { return new Promise((resolve) => { resolveInitialRead = resolve; }); },
          insert(payload) {
            return { select() { return { single: async () => ({ data: { ...payload, id: "new" }, error: null }) }; } };
          }
        };
      },
      // rsvp.js sekarang selalu mengirim lewat RPC submit_wish (device_token
      // anti-spam) ketika crypto.randomUUID tersedia — secure context di
      // Playwright selalu punya itu, jadi jalur .from().insert() di atas
      // tidak pernah dipakai lagi di test ini. Tanpa .rpc() di mock, submit
      // melempar TypeError yang tak tertangani dan test macet menunggu kartu
      // yang tidak pernah dirender (bukan bug rsvp.js — mock test yang basi).
      rpc(name, params) {
        if (name !== "submit_wish") return Promise.resolve({ data: null, error: new Error(`RPC tak dikenal di mock: ${name}`) });
        return Promise.resolve({
          data: {
            id: "new", invitation_id: params.p_invitation_id, name: params.p_name,
            attendance: params.p_attendance, guest_count: params.p_guest_count, message: params.p_message
          },
          error: null
        });
      }
    };
    window.__resolveInitialRead = () => resolveInitialRead({ data: [{ id: "old", name: "Tamu Lama", attendance: "hadir", message: "Doa lama" }], error: null, count: 1 });
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
