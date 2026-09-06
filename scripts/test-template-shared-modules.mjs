/** Kait DOM yang dituntut modul perilaku bersama.
 *
 * Template bebas menentukan markup-nya (docs/kontrak-template.md), TAPI begitu
 * ia mencantumkan assets/js/<modul>.js di template.json, ia terikat kontrak
 * DOM modul itu: id semantik tertentu harus ada, dan sebagian harus ada di
 * dalam induk tertentu.
 *
 * Kenapa perlu dijaga: modul-modul ini memanggil `el.querySelector(...)
 * .addEventListener(...)` tanpa penjagaan null. Satu kait yang hilang bukan
 * berarti fiturnya mati diam-diam — initGift/initQrCheckin melempar
 * TypeError dan SEMUA yang dipanggil sesudahnya di render() ikut batal.
 * Persis jebakan yang menimpa Nocturne saat pertama ditulis (memakai <select>
 * untuk kehadiran dan tombol tutup tanpa .modal__close).
 *
 * Diperiksa lewat DOM sungguhan (page.setContent), bukan regex, supaya
 * pemeriksaan "harus berada di DALAM modal ini" benar-benar sahih.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

/** Selector wajib per modul. Kunci = nama file di assets/js/. */
const CONTRACTS = {
  "rsvp.js": [
    "#rsvp-form", "#rsvp-status", "#rsvp-name", "#rsvp-message", "#rsvp-submit",
    "#wishes-list", "#rsvp-attendance",
    // rsvp.js hanya mengenal tombol .rsvp-pill (dropdown tidak akan terbaca —
    // attendanceValue tetap kosong dan tamu selalu ditolak saat submit).
    '#rsvp-attendance .rsvp-pill[data-value="hadir"]',
    '#rsvp-attendance .rsvp-pill[data-value="tidak_hadir"]',
    '#rsvp-attendance .rsvp-pill[data-value="ragu"]'
  ],
  "gift.js": [
    "#btn-gift-toggle", "#btn-gift-hide", "#btn-gift-recs", "#btn-gift-confirm",
    "#gift-panel", "#gift-accounts", "#gift-address",
    "#gift-confirm-modal", "#gift-confirm-method", "#gift-confirm-message", "#gift-confirm-send",
    "#gift-recs-modal", "#gift-recs-grid",
    // Tombol tutup dicari dengan kelas ini, di dalam modalnya masing-masing.
    "#gift-confirm-modal .modal__close",
    "#gift-recs-modal .modal__close"
  ],
  "qr-checkin.js": [
    "#btn-qr-checkin", "#qr-checkin-modal", "#qr-checkin-canvas",
    "#qr-checkin-modal .modal__close"
  ],
  "countdown.js": ["#cd-days", "#cd-hours", "#cd-minutes", "#cd-seconds"],
  "audio-player.js": ["#bg-audio", "#audio-toggle", "#audio-toggle-icon"],
  "livestream.js": ["#livestream", "#livestream .livestream-actions"],
  "gallery.js": ["#gallery-wrapper", "#lightbox", "#lightbox-img", "#lightbox-close"],
  "nav-menu.js": [
    "#btn-nav-menu", "#nav-menu-modal", "#nav-menu-list",
    "#nav-menu-modal .modal__close"
  ]
};

const fail = [];
const browser = await chromium.launch();
const page = await browser.newPage();

const folders = (await fs.readdir("templates", { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name);

for (const id of folders) {
  const dir = path.join("templates", id);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "template.json"), "utf8"));
  const markup = await fs.readFile(path.join(dir, "markup.html"), "utf8");
  await page.setContent(`<div id="inv-root">${markup}</div>`);

  const used = (manifest.assets && manifest.assets.js) || [];
  for (const [mod, selectors] of Object.entries(CONTRACTS)) {
    if (!used.some((src) => src.endsWith(`/${mod}`) || src === `assets/js/${mod}`)) continue;

    const missing = [];
    for (const sel of selectors) {
      if (!(await page.$(sel))) missing.push(sel);
    }
    if (missing.length) {
      fail.push(`${id} memuat ${mod} tapi markup-nya tidak punya: ${missing.join(", ")}`);
    } else {
      console.log(`PASS: ${id} × ${mod} — ${selectors.length} kait lengkap`);
    }
  }
}

await browser.close();

if (fail.length) {
  console.error("\nGAGAL:\n- " + fail.join("\n- "));
  process.exit(1);
}
console.log("\nPASS: semua template memenuhi kontrak DOM modul yang dipakainya.");
