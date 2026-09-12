/** Tiap template benar-benar BISA DIPAKAI tamu, bukan cuma merender.
 *
 * test-template-render.mjs membuktikan render() tidak melempar. Itu tidak
 * cukup: undangan bisa saja "sukses dirender" tapi tetap mati di tangan tamu —
 * persis yang terjadi pada Kertas & Sekar Jagat, di mana modal ber-`hidden`
 * tetap tampil karena `display: grid` di kelasnya mengalahkan aturan bawaan
 * browser `[hidden] { display: none }`, sehingga selembar modal transparan
 * menutupi layar dan MENELAN setiap klik, termasuk "Buka Undangan".
 *
 * Jadi di sini CSS template ikut dimuat, viewport disetel seukuran HP, dan
 * alurnya ditirukan sungguhan: pastikan tombol buka benar-benar yang tersentuh
 * jari, klik, lalu pastikan isi undangan muncul dan halaman bisa digulir.
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
  fs.readFile("assets/js/photos.js", "utf8"),
  fs.readFile("assets/js/gallery-layout.js", "utf8")
]);

// Foto tiruan 1×1 transparan sebagai data URI: tidak ada request jaringan,
// tapi <img> tetap punya ukuran dan background-image tetap terpasang.
const PX = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PHOTO_PAYLOAD = {};
for (const slot of ["cover", "subcover", "opening", "std2", "bride", "groom",
                    "event", "story", "gallery", "quote", "closing", "gift_item"]) {
  PHOTO_PAYLOAD[slot] = [1, 2, 3].map((n) => ({
    id: `${slot}-${n}`, path: `${slot}/${n}.webp`, alt: `${slot} ${n}`,
    focalX: 50, focalY: 45, zoom: 1
  }));
}

const STUBS = `
window.photoUrl = () => ${JSON.stringify(PX)};
window.audioUrl = window.photoUrl;
window.__PHOTO_PAYLOAD = ${JSON.stringify(PHOTO_PAYLOAD)};
window.__called = [];
window.initRsvp = () => window.__called.push("rsvp");
window.initGift = () => window.__called.push("gift");
window.initQrCheckin = () => window.__called.push("qr");
window.applyVisualEditorOverrides = () => {};
window.WeddingTemplates = {};
`;

const folders = (await fs.readdir("templates", { withFileTypes: true }))
  .filter((e) => e.isDirectory()).map((e) => e.name);

const browser = await chromium.launch();

for (const id of folders) {
  const dir = path.join("templates", id);
  const [markup, css, renderJs, manifestRaw] = await Promise.all([
    fs.readFile(path.join(dir, "markup.html"), "utf8"),
    fs.readFile(path.join(dir, "style.css"), "utf8"),
    fs.readFile(path.join(dir, "render.js"), "utf8"),
    fs.readFile(path.join(dir, "template.json"), "utf8")
  ]);
  const manifest = JSON.parse(manifestRaw);

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  try {
    await page.setContent(`<div id="inv-root">${markup}</div>`);
    await page.addStyleTag({ content: css });
    for (const src of [configJs, STUBS, photosJs, galleryLayoutJs, contextJs, tplPhotosJs, behaviorsJs]) {
      await page.addScriptTag({ content: src });
    }
    await page.evaluate((theme) => {
      // Mesin memasang: warna bawaan manifest + kunci gulir sebelum dibuka.
      Object.entries(theme || {}).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
      document.documentElement.classList.add("no-scroll");
    }, manifest.theme);
    await page.addScriptTag({ content: renderJs });

    await page.evaluate(async (tplId) => {
      const core = window.WeddingCore, cfg = window.WEDDING_CONFIG;
      await window.WeddingTemplates[tplId].render({
        mount: document.getElementById("inv-root"), id: tplId, manifest: {}, data: cfg, tpl: {},
        guest: core.buildGuest(cfg),
        photos: (slot) => window.WeddingPhotos.forSlot(slot, {}),
        panStyle: window.WeddingPhotos.panStyle,
        esc: core.esc, fmt: core.fmt, services: {}
      });
    }, id);
    await page.waitForTimeout(120);

    /* 1. Tidak ada elemen ber-`hidden` yang nyatanya masih tampil. Inilah yang
          menciptakan lapisan tak terlihat penelan klik. */
    const visibleHidden = await page.evaluate(() =>
      [...document.querySelectorAll("[hidden]")]
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => el.id || el.className || el.tagName));
    check(`${id}: tidak ada elemen [hidden] yang tetap tampil`,
      visibleHidden.length === 0, visibleHidden.join(", "));

    /* 2. Yang benar-benar tersentuh jari di posisi tombol memang tombolnya. */
    const hit = await page.evaluate(() => {
      const btn = document.getElementById("btn-open");
      if (!btn) return { ok: false, what: "tombol buka tidak ada" };
      const r = btn.getBoundingClientRect();
      if (!r.width || !r.height) return { ok: false, what: "tombol buka tidak punya ukuran" };
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        ok: !!top && (top === btn || btn.contains(top)),
        what: top ? (top.id || top.className || top.tagName) : "tidak ada elemen"
      };
    });
    check(`${id}: tombol "Buka Undangan" benar-benar yang tersentuh di posisinya`,
      hit.ok, `yang tertekan justru: ${hit.what}`);

    /* 3. Klik sungguhan, lalu isi undangan harus muncul. */
    await page.locator("#btn-open").click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(350);

    const after = await page.evaluate(() => {
      const ids = ["opening", "event", "gift", "closing"];
      const shown = ids.filter((i) => {
        const el = document.getElementById(i);
        return el && el.getClientRects().length > 0;
      });
      // Elemen mana yang benar-benar menggulir: dokumen, atau wadah ber-overflow
      // milik template (Nocturne memakai <main> ber-scroll-snap).
      const scrollers = [document.scrollingElement, ...document.querySelectorAll("#inv-root *")]
        .filter((el) => el && el.scrollHeight - el.clientHeight > 40);
      return {
        shown,
        total: ids.length,
        scrollable: scrollers.length > 0,
        locked: document.documentElement.classList.contains("no-scroll")
      };
    });

    check(`${id}: setelah klik, bagian utama undangan tampil (${after.shown.length}/${after.total})`,
      after.shown.length === after.total,
      `yang tampil cuma: ${after.shown.join(", ") || "tidak ada"}`);
    check(`${id}: setelah klik, halaman bisa digulir`, after.scrollable);
    check(`${id}: setelah klik, kunci gulir dilepas`, !after.locked);

    check(`${id}: tidak ada error sepanjang alur`, errors.length === 0, errors[0]);
  } finally {
    await page.close();
  }
}

await browser.close();

if (failed) { console.error("\nFAIL: ada template yang tidak bisa dipakai tamu."); process.exit(1); }
console.log("\nPASS: semua template bisa dibuka dan digulir tamu.");
