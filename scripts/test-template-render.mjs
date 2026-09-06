/** Tiap template benar-benar merender.
 *
 * Cek statis tidak bisa menangkap kesalahan yang paling sering terjadi saat
 * menulis template: satu `document.getElementById("...")` yang salah ketik
 * mengembalikan null, baris berikutnya melempar, dan SISA render() batal —
 * tamu melihat undangan setengah kosong tanpa satu pun pesan error yang
 * terlihat. Jadi di sini render() milik tiap template dijalankan sungguhan di
 * browser, dengan data dari assets/js/config.js (fallback resmi repo, bukan
 * data karangan), lalu diperiksa: tidak ada exception, tidak ada console
 * error, dan bagian-bagian pokok benar-benar terisi.
 *
 * Modul perilaku bersama (rsvp/gift/qr) sengaja distub — kontrak DOM-nya
 * sudah dijaga scripts/test-template-shared-modules.mjs, dan menjalankan yang
 * asli di sini berarti menyeret Supabase ke dalam test yang seharusnya cuma
 * menguji template.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`); failed = true; }
}

const [configJs, contextJs, tplPhotosJs, behaviorsJs, photosJs, galleryLayoutJs] = await Promise.all([
  fs.readFile("assets/js/config.js", "utf8"),
  fs.readFile("assets/js/core/context.js", "utf8"),
  fs.readFile("assets/js/core/template-photos.js", "utf8"),
  fs.readFile("assets/js/core/behaviors.js", "utf8"),
  // Dimuat asli, bukan distub: keduanya sudah dipakai cangkang di halaman
  // tamu dan tidak menyentuh jaringan selama __PHOTO_PAYLOAD terisi.
  fs.readFile("assets/js/photos.js", "utf8"),
  fs.readFile("assets/js/gallery-layout.js", "utf8")
]);

// Foto tiruan untuk semua slot yang mungkin diminta template.
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
// Modul bersama: dicatat pemanggilannya, tidak dijalankan sungguhan.
window.__called = [];
window.initRsvp = () => window.__called.push("rsvp");
window.initGift = () => window.__called.push("gift");
window.initQrCheckin = () => window.__called.push("qr");
window.applyVisualEditorOverrides = () => window.__called.push("ve");
window.WeddingTemplates = {};
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
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  try {
    await page.setContent(`<div id="inv-root">${markup}</div>`);
    for (const src of [configJs, STUBS, photosJs, galleryLayoutJs, contextJs, tplPhotosJs, behaviorsJs]) {
      await page.addScriptTag({ content: src });
    }
    // Warna bawaan manifest dipasang seperti yang dilakukan mesin, supaya
    // template yang membaca variabelnya lewat getComputedStyle tetap wajar.
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
        return { error: String(err && err.stack || err) };
      }
      // destroy() harus aman dipanggil — mesin memanggilnya saat ganti template.
      try { tpl.destroy(); } catch (err) { return { error: "destroy(): " + String(err) }; }
      return {
        error: null,
        text: root.innerText,
        images: [...root.querySelectorAll("img[src]")].length,
        called: window.__called
      };
    }, id);

    check(`${id}: render() selesai tanpa exception`, !result.error, result.error);
    if (!result.error) {
      const text = result.text || "";
      check(`${id}: nama mempelai tampil`, /Fitri|Andi/i.test(text), text.slice(0, 120));
      check(`${id}: tanggal acara tampil`, /2026|Agustus/i.test(text));
      check(`${id}: ada foto yang dipasang`, result.images > 0);
      check(`${id}: modul bersama yang dideklarasikan manifest benar-benar dipanggil`,
        ((manifest.assets && manifest.assets.js) || [])
          .filter((s) => /rsvp\.js|gift\.js|qr-checkin\.js/.test(s)).length === 0 ||
        result.called.length > 0);
    }
    check(`${id}: tidak ada console error saat render`, consoleErrors.length === 0, consoleErrors[0]);
    check(`${id}: tidak ada exception tak tertangkap`, pageErrors.length === 0, pageErrors[0]);
  } finally {
    await page.close();
  }
}

await browser.close();

if (failed) { console.error("\nFAIL: ada template yang tidak merender bersih."); process.exit(1); }
console.log("\nPASS: semua template merender bersih dari data config.js.");
