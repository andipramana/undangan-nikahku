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
  // Galeri diisi banyak supaya bagiannya benar-benar jauh lebih tinggi dari
  // layar, seperti undangan sungguhan — itulah kondisi yang membuat pemicu
  // gerak masuk berbasis rasio gagal.
  const count = slot === "gallery" ? 16 : 3;
  PHOTO_PAYLOAD[slot] = Array.from({ length: count }, (_, i) => i + 1).map((n) => ({
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

    /* 4. Tidak meluber ke samping. Di HP gejalanya halus tapi merusak: halaman
          bisa digeser horizontal, teks ikut bergeser, dan tata letak terasa
          "goyang" — biasanya karena satu elemen lebar tetap atau margin negatif. */
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const over = doc.scrollWidth - doc.clientWidth;
      if (over <= 1) return { over, culprits: [] };
      const culprits = [...document.querySelectorAll("#inv-root *")]
        .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1)
        .slice(0, 4)
        .map((el) => el.id || el.className || el.tagName);
      return { over, culprits };
    });
    check(`${id}: halaman tidak meluber ke samping`, overflow.over <= 1,
      `lebih ${overflow.over}px — ${overflow.culprits.join(", ")}`);

    /* 5. Lightbox galeri: satu-satunya jalan tamu melihat foto ukuran penuh.
          Kalau tidak mau menutup, tamu terkunci di layar hitam dan harus
          memuat ulang undangan — persis kegagalan yang tadi terjadi. */
    const lightbox = await page.evaluate(async () => {
      const box = document.querySelector(".nc-lightbox, .kt-lightbox, .sj-lightbox, #lightbox");
      if (!box) return { skip: true };
      const thumb = document.querySelector("[data-full], .gallery-item, #gallery img");
      if (!thumb) return { skip: true };
      thumb.click();
      await new Promise((r) => setTimeout(r, 80));
      const opened = box.getClientRects().length > 0;
      const closer = box.querySelector("[data-close], #lightbox-close");
      if (closer) closer.click();
      await new Promise((r) => setTimeout(r, 80));
      return { skip: false, opened, closed: box.getClientRects().length === 0 };
    });
    if (!lightbox.skip) {
      check(`${id}: lightbox galeri terbuka saat foto diketuk`, lightbox.opened);
      check(`${id}: lightbox galeri bisa ditutup lagi`, lightbox.closed);
    }

    /* 6. Tiap selector di skema tipografi harus benar-benar mengenai elemen.
          Selector yang salah ketik tidak pernah melempar error — gejalanya
          cuma "setelan font tidak ngefek", yang sulit dilacak client maupun
          kita. Kelas yang DIHASILKAN modul bersama (ucapan & rekening baru ada
          setelah data Supabase masuk) dikecualikan karena memang belum ada di
          test ini. */
    const typo = await page.evaluate((groups) => {
      const SKIP = /wish-card|gift-account|gift-rec-card|wishes-/;
      const miss = [];
      (groups || []).forEach((g) => (g.elements || []).forEach((e) => {
        if (!e.selector || SKIP.test(e.selector)) return;
        const anyHit = e.selector.split(",").some((sel) => {
          try { return document.querySelector(sel.trim()); } catch (_) { return false; }
        });
        if (!anyHit) miss.push(`${e.key} (${e.selector})`);
      }));
      return miss;
    }, (manifest.editor || {}).typography || []);
    check(`${id}: semua selector skema font mengenai elemen nyata`,
      typo.length === 0, typo.join("; "));

    /* 7. Hampiri tiap bagian seperti tamu menggulir, lalu pastikan isinya
          benar-benar terlihat. Gerak masuk menyembunyikan isi (opacity 0)
          sampai IntersectionObserver menandainya; kalau pemicunya memakai
          ambang RASIO (mis. 0.45), bagian yang lebih tinggi dari layar tidak
          akan pernah mencapainya — rasio maksimum yang bisa terlihat hanya
          setinggi layar dibagi tinggi bagian itu. Gejalanya: ruang kosong
          sangat panjang di galeri atau halaman ucapan. */
    const blank = await page.evaluate(async () => {
      // Animasi gulir dimatikan dulu, kalau tidak posisi akhir tidak pernah
      // benar-benar tercapai dalam satu langkah dan hasilnya bohong.
      const style = document.createElement("style");
      style.textContent = "*, *::before, *::after { scroll-behavior: auto !important; }";
      document.head.appendChild(style);

      const sections = [...document.querySelectorAll(".nc-scene, .kt-sheet, .sj-part")]
        .filter((el) => el.getClientRects().length > 0);
      const kosong = [];

      for (const sec of sections) {
        sec.scrollIntoView({ block: "center", behavior: "auto" });
        await new Promise((r) => setTimeout(r, 220));
        const kids = [...sec.querySelectorAll("h1,h2,h3,h4,p,form,img,button,a")]
          .filter((el) => el.getClientRects().length > 0);
        if (!kids.length) continue;

        // HARUS memakai opacity EFEKTIF (ikut leluhur). getComputedStyle(el)
        // .opacity hanya melaporkan nilai elemen itu sendiri: saat pembungkus
        // bagian masih opacity 0, tiap anaknya tetap melaporkan 1 — dan cek
        // yang begitu pernah meloloskan bug galeri kosong ini.
        const terlihat = (el) => el.checkVisibility
          ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
          : (() => {
              for (let n = el; n && n !== document.body; n = n.parentElement) {
                if (Number(getComputedStyle(n).opacity) < 0.05) return false;
              }
              return true;
            })();

        if (!kids.some(terlihat)) kosong.push(sec.id || sec.className);
      }
      style.remove();
      return kosong;
    });
    check(`${id}: tiap bagian menampilkan isinya saat dihampiri`,
      blank.length === 0, `masih kosong: ${blank.join(", ")}`);

    /* 8. Target sentuh. Dua bentuk yang benar-benar sulit dikenai jari:
          kontrol yang kecil di KEDUA sisi (titik navigasi, tombol bundar) dan
          kontrol yang terlalu TIPIS (tautan sebaris dengan padding minim).
          Tombol lebar setinggi ~36px tidak termasuk — lebarnya membuat
          sasarannya mudah dikenai. */
    // Klasik sengaja dikecualikan dari aturan ini. Template itu sudah dipakai
    // di acara sungguhan dan komposisinya disetujui apa adanya; menambah
    // padding pada tautan & tombolnya akan menggeser tata letak yang sudah
    // pas demi angka di test. Tiga template baru dibuat memenuhi aturan ini
    // sejak awal, karena di sanalah ukurannya masih bisa ditentukan bebas.
    const kecil = id === "klasik" ? [] : await page.evaluate(() => {
      return [...document.querySelectorAll("#inv-root button, #inv-root a[href]")]
        .filter((el) => el.getClientRects().length > 0 && !el.closest("[hidden]"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.id || el.className || el.tagName, w: Math.round(r.width), h: Math.round(r.height) };
        })
        .filter((x) => x.w && x.h && ((x.w < 40 && x.h < 40) || x.h < 30))
        .slice(0, 8);
    });
    check(`${id}: kontrol tidak terlalu kecil/tipis untuk jari`, kecil.length === 0,
      kecil.map((x) => `${x.id} ${x.w}×${x.h}`).join(", "));

    check(`${id}: tidak ada error sepanjang alur`, errors.length === 0, errors[0]);
  } finally {
    await page.close();
  }
}

await browser.close();

if (failed) { console.error("\nFAIL: ada template yang tidak bisa dipakai tamu."); process.exit(1); }
console.log("\nPASS: semua template bisa dibuka dan digulir tamu.");
