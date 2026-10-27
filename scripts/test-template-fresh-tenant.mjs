/** Tiap template harus merender untuk client yang BARU dibuat.
 *
 * provision-invitation menyalin snapshot lalu mengosongkan data pribadi
 * (sanitizeContent): tanggal, jam, venue, rekening, cerita, livestream. Client
 * baru pun membuka undangannya SEBELUM sempat mengisi apa pun. Satu
 * `new Date("").toISOString()` yang tak dijaga melempar RangeError, render()
 * batal, dan tamu melihat layar rusak — itu yang terjadi di /julia-dan-kevin/.
 * test-template-render.mjs tidak menangkapnya karena memakai config.js yang
 * lengkap.
 *
 * Datanya di sini sengaja meniru sanitizeContent baris demi baris. Kalau
 * fungsi itu berubah, ubah juga bagian EMPTY_EVENT di bawah.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [configJs, contextJs, tplPhotosJs, behaviorsJs, photosJs, galleryLayoutJs, countdownJs] = await Promise.all([
  fs.readFile("assets/js/config.js", "utf8"),
  fs.readFile("assets/js/core/context.js", "utf8"),
  fs.readFile("assets/js/core/template-photos.js", "utf8"),
  fs.readFile("assets/js/core/behaviors.js", "utf8"),
  fs.readFile("assets/js/photos.js", "utf8"),
  fs.readFile("assets/js/gallery-layout.js", "utf8"),
  fs.readFile("assets/js/countdown.js", "utf8")
]);

const PHOTO_PAYLOAD = {};
for (const slot of ["cover", "subcover", "opening", "std2", "bride", "groom",
                    "event", "story", "gallery", "quote", "closing", "gift_item"]) {
  PHOTO_PAYLOAD[slot] = [1, 2, 3].map((n) => ({
    id: `${slot}-${n}`, path: `${slot}/${n}.webp`, alt: `${slot} ${n}`,
    focalX: 50, focalY: 45, zoom: 1
  }));
}

const STUBS = `
window.photoUrl = (p) => "https://example.test/" + p;
window.audioUrl = window.photoUrl;
window.__PHOTO_PAYLOAD = ${JSON.stringify(PHOTO_PAYLOAD)};
window.initRsvp = () => {};
window.initGift = () => {};
window.initQrCheckin = () => {};
window.applyVisualEditorOverrides = () => {};
window.WeddingTemplates = {};
`;

/** Salinan bentuk data client baru (lihat sanitizeContent di Edge Function). */
const FRESH_TENANT = `
(() => {
  const cfg = window.WEDDING_CONFIG;
  const blank = (nick) => ({ name: nick, nickname: nick, instagram: "", father: "", mother: "", photo: "" });
  cfg.couple = { ...cfg.couple, bride: blank("Mempelai Wanita"), groom: blank("Mempelai Pria") };
  cfg.gift = { accounts: [], contactCPP: "", contactCPW: "", address: { recipient: "", phone: "", detail: "" }, note: "" };
  const emptyEvent = (label) => ({ label, start: "", end: "", venue: { name: "", address: "", mapsUrl: "" } });
  cfg.event = { ...cfg.event, dateISO: "", dateLabel: "", dayLabel: "", countdownTarget: "",
    akad: emptyEvent("Akad Nikah"), resepsi: emptyEvent("Resepsi") };
  cfg.loveStory = [];
  cfg.guestGreetings = [];
  cfg.livestream = { youtube: "", instagram: "", tiktok: "" };
})();
`;

const folders = (await fs.readdir("templates", { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name);

const browser = await chromium.launch();

for (const id of folders) {
  const dir = path.join("templates", id);
  const [markup, renderJs, manifestRaw] = await Promise.all([
    fs.readFile(path.join(dir, "markup.html"), "utf8"),
    fs.readFile(path.join(dir, "render.js"), "utf8"),
    fs.readFile(path.join(dir, "template.json"), "utf8")
  ]);
  const manifest = JSON.parse(manifestRaw);

  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  try {
    await page.setContent(`<div id="inv-root">${markup}</div>`);
    for (const src of [configJs, STUBS, photosJs, galleryLayoutJs, contextJs, tplPhotosJs, behaviorsJs, FRESH_TENANT, countdownJs]) {
      await page.addScriptTag({ content: src });
    }
    await page.evaluate((theme) => {
      Object.entries(theme || {}).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    }, manifest.theme);
    await page.addScriptTag({ content: renderJs });

    const result = await page.evaluate(async (tplId) => {
      const core = window.WeddingCore;
      const cfg = window.WEDDING_CONFIG;
      const tpl = window.WeddingTemplates[tplId];
      if (!tpl) return { error: "template tidak mendaftar" };
      const root = document.getElementById("inv-root");
      try {
        await tpl.render({
          mount: root, id: tplId, manifest: {}, data: cfg, tpl: {},
          guest: core.buildGuest(cfg),
          photos: (slot) => window.WeddingPhotos.forSlot(slot, {}),
          panStyle: window.WeddingPhotos.panStyle,
          esc: core.esc, fmt: core.fmt, services: {}
        });
      } catch (err) {
        return { error: String((err && err.stack) || err) };
      }
      try { tpl.destroy(); } catch (err) { return { error: "destroy(): " + String(err) }; }
      return { error: null, text: root.innerText };
    }, id);

    check(`${id}: client baru (data kosong) merender tanpa exception`, !result.error, result.error);
    check(`${id}: client baru: tidak ada teks "NaN" / "Invalid Date" di layar`,
      !result.error && !/NaN|Invalid Date/.test(result.text || ""),
      (result.text || "").match(/.{0,30}(NaN|Invalid Date).{0,30}/)?.[0]);
    check(`${id}: client baru: tidak ada pageerror`, pageErrors.length === 0, pageErrors.join(" | "));
  } catch (err) {
    check(`${id}: harness client baru berjalan`, false, String(err));
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
