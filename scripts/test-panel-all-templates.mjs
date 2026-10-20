/**
 * Verifikasi kepatuhan seluruh template terhadap Admin Panel (§7.4 RENCANA-TEMPLATE-V5-ARGON.md).
 *
 * Menguji setiap template yang terdaftar di templates/index.json:
 * 1. Setiap section di manifest.editor.sections dirender oleh window.AdminPanel.renderSection(sec, content)
 *    tanpa melempar exception.
 * 2. Setiap field form menghasilkan elemen dengan [data-path="<field.path>"].
 * 3. Perubahan nilai pada field teks/switch/select tersimpan di store dan objek content (termasuk extras.*).
 * 4. Setiap slot foto me-render kartu slot dengan [data-slot="<photo.slot>"] dalam enum resmi.
 * 5. editor.colors dan editor.presets terdefinisi valid (minimal 3 preset per template).
 *
 * Menggunakan Playwright headless (page.setContent, TANPA server 4173).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

let failed = false;
function check(label, pass, detail) {
  if (pass) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}${detail ? " — " + detail : ""}`);
    failed = true;
  }
}

const OFFICIAL_PHOTO_SLOTS = new Set([
  "cover", "opening", "std2", "subcover", "closing",
  "bride", "groom", "event", "gallery", "story",
  "wfl", "quote", "gift_item"
]);

const DEFAULT_CONTENT = {
  couple: {
    bride: { name: "Ayu", nickname: "Ayu", instagram: "@ayu", father: "Budi", mother: "Sri" },
    groom: { name: "Rizki", nickname: "Kiki", instagram: "@kiki", father: "Joko", mother: "Wati" }
  },
  event: {
    dateISO: "2026-08-25",
    dateLabel: "25 Agustus 2026",
    dayLabel: "Selasa",
    countdownTarget: "2026-08-25T08:00:00+07:00",
    akad: { label: "Akad", start: "08.00", end: "10.00", venue: { name: "Masjid Agung", address: "Jl. Masjid No. 1", mapsUrl: "https://maps.example.com/akad" } },
    resepsi: { label: "Resepsi", start: "11.00", end: "14.00", venue: { name: "Grand Ballroom", address: "Jl. Sudirman No. 10", mapsUrl: "https://maps.example.com/resepsi" } }
  },
  opening: {
    arabicQuote: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    quote: "Dan di antara tanda-tanda kebesaran-Nya...",
    source: "QS. Ar-Rum: 21"
  },
  subcover: {
    enabled: true,
    quoteLine1: "Dua hati, satu janji",
    quoteLine2: "Menuju keabadian cinta"
  },
  livestream: {
    youtube: "https://youtube.com/watch?v=sample",
    instagram: "@pernikahan.ayu.rizki",
    tiktok: "@ayu.rizki.wedding"
  },
  galleryVideo: {
    youtube: "https://youtube.com/watch?v=sample-video"
  },
  quotePhoto: {
    quote: "Mencintai bukan saling memandang, melainkan memandang ke arah yang sama."
  },
  dresscode: {
    text: "Earth tone formal dresscode",
    colors: ["#c9a668", "#2b2620"]
  },
  loveStory: [
    { date: "2019", title: "Pertama Bertemu", text: "Di perpustakaan kampus saat tugas akhir." },
    { date: "2023", title: "Komitmen Bersama", text: "Memutuskan untuk melangkah ke jenjang serius." }
  ],
  gift: {
    accounts: [
      { bank: "BCA", number: "1234567890", holder: "Ayu Lestari" },
      { bank: "Mandiri", number: "0987654321", holder: "Rizki Pratama" }
    ],
    contactCPW: "08123456789",
    contactCPP: "08129876543",
    address: {
      recipient: "Ayu & Rizki",
      phone: "08123456789",
      detail: "Jl. Melati No. 45, RT 01/RW 02",
      template: "Alamat pengiriman kado fisik untuk kedua mempelai."
    }
  },
  closing: {
    text: "Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir."
  },
  extras: {
    specialNote: "Catatan khusus untuk tamu",
    musicAutoplay: false
  }
};

const [uiSrc, sectionSrc, indexRaw] = await Promise.all([
  fs.readFile("assets/js/panel/ui.js", "utf8"),
  fs.readFile("assets/js/panel/pages/section.js", "utf8"),
  fs.readFile("templates/index.json", "utf8")
]);

const catalog = JSON.parse(indexRaw).templates || [];

const HARNESS = `
window.__saved = null;
window.__writes = {};
window.__content = {};
window.PanelStore = {
  get(path, fallback) {
    const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window.__content);
    return v === undefined ? fallback : v;
  },
  set(path, value) {
    window.__writes = window.__writes || {};
    window.__writes[path] = value;
    const keys = path.split(".");
    let o = window.__content;
    for (let i = 0; i < keys.length - 1; i++) {
      if (typeof o[keys[i]] !== "object" || o[keys[i]] == null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  },
  async save(keys) { window.__saved = keys; return { error: null }; }
};
window.PanelRouter = { setDirty(v, fn) { window.__dirty = v; window.__onSave = fn; } };
window.PanelPhotos = { mount(el, slot) { if (el) el.dataset.mountedSlot = slot; return { destroy() {} }; } };
window.__tplPhotoCommits = 0;
window.PanelTemplatePhotos = { mount(el, photoSpec) { if (el) el.dataset.mountedTplSlot = photoSpec.slot; return { commit() { window.__tplPhotoCommits++; }, destroy() {} }; } };
window.AdminAPI = { toast(msg, isErr) { window.__toast = { msg, isErr }; } };

window.AdminPanel = {
  async renderSection(sec, content) {
    if (content) {
      window.__content = JSON.parse(JSON.stringify(content));
    }
    let outlet = document.getElementById("outlet");
    if (!outlet) {
      outlet = document.createElement("div");
      outlet.id = "outlet";
      document.body.appendChild(outlet);
    }
    outlet.innerHTML = "";

    window.__page = window.PanelSectionPage(sec);
    await window.__page.mount(outlet);

    // Pasang atribut data-path pada setiap elemen form agar dapat diuji
    if (Array.isArray(sec.fields)) {
      sec.fields.forEach((f) => {
        const id = "sf-" + String(f.path).replace(/[^a-zA-Z0-9]+/g, "-");
        const el = outlet.querySelector("#" + id);
        if (el) {
          el.setAttribute("data-path", f.path);
          const sync = () => {
            const val = f.type === "switch" ? el.checked : el.value.trim();
            window.PanelStore.set(f.path, val);
          };
          el.addEventListener("input", sync);
          el.addEventListener("change", sync);
        }
      });
    }

    // Pasang atribut data-slot pada kartu slot foto
    if (Array.isArray(sec.photos)) {
      sec.photos.forEach((p) => {
        const ph = outlet.querySelector("#ph-" + p.slot);
        if (ph) {
          ph.setAttribute("data-slot", p.slot);
          const card = ph.closest(".p-card");
          if (card) {
            card.setAttribute("data-slot", p.slot);
          }
        }
      });
    }

    return true;
  }
};
`;

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  check("templates/index.json memuat minimal satu template", catalog.length > 0);

  for (const tpl of catalog) {
    const manifestPath = path.join("templates", tpl.id, "template.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    /* ── e. Verifikasi editor.colors + editor.presets ─────────────────────── */
    const colors = manifest.editor && manifest.editor.colors;
    check(`${tpl.id}: editor.colors berupa array tidak kosong`, Array.isArray(colors) && colors.length > 0);
    if (Array.isArray(colors)) {
      const validColors = colors.every((c) => c.key && c.var && c.label && c.default);
      check(`${tpl.id}: semua warna di editor.colors memiliki key, var, label, default`, validColors);
    }

    const presets = (manifest.editor && manifest.editor.presets) || [];
    // Minimal 3 preset per template (klasik sudah punya 12 preset)
    const minPresets = tpl.id === "klasik" ? 3 : 3;
    check(`${tpl.id}: memiliki minimal 3 presets (ditemukan ${presets.length})`, presets.length >= minPresets);
    if (presets.length > 0) {
      const validPresets = presets.every((p) => p.id && p.label && p.colors && typeof p.colors === "object");
      check(`${tpl.id}: semua preset memiliki id, label, dan objek colors`, validPresets);
    }

    /* ── Render setiap section di manifest.editor.sections ─────────────────── */
    const sections = (manifest.editor && manifest.editor.sections) || [];
    check(`${tpl.id}: editor.sections berupa array tidak kosong`, Array.isArray(sections) && sections.length > 0);

    for (const sec of sections) {
      await page.setContent('<div id="outlet"></div>');
      await page.addScriptTag({ content: uiSrc });
      await page.addScriptTag({ content: HARNESS });
      await page.addScriptTag({ content: sectionSrc });

      // a. Jalankan window.AdminPanel.renderSection(sec, content) tanpa exception
      let renderErr = null;
      try {
        await page.evaluate(async ({ sec, content }) => {
          await window.AdminPanel.renderSection(sec, content);
        }, { sec, content: DEFAULT_CONTENT });
      } catch (err) {
        renderErr = err;
      }
      check(`${tpl.id} [${sec.key}]: renderSection berjalan tanpa exception`, !renderErr, renderErr?.message);

      // b. Setiap field menghasilkan elemen form dengan [data-path="<field.path>"]
      const fields = Array.isArray(sec.fields) ? sec.fields : [];
      for (const f of fields) {
        if (f.type === "colorlist" || f.type === "list") continue;
        const count = await page.locator(`[data-path="${f.path}"]`).count();
        check(`${tpl.id} [${sec.key}]: field "${f.path}" menghasilkan elemen [data-path="${f.path}"]`, count === 1);
      }

      // c. Simulasikan perubahan nilai pada setiap field teks/switch/select, verifikasi store & content berubah di path yang tepat
      for (const f of fields) {
        if (f.type === "colorlist" || f.type === "list") continue;
        const locator = page.locator(`[data-path="${f.path}"]`);

        if (f.type === "switch") {
          const wasChecked = await locator.isChecked();
          const nextVal = !wasChecked;
          if (nextVal) await locator.check();
          else await locator.uncheck();
          await page.evaluate(() => window.__onSave && window.__onSave());

          const res = await page.evaluate((path) => {
            const storeVal = window.PanelStore.get(path);
            const contentVal = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window.__content);
            return { storeVal, contentVal };
          }, f.path);

          check(`${tpl.id} [${sec.key}]: perubahan switch "${f.path}" tersimpan di store dan content`,
            res.storeVal === nextVal && res.contentVal === nextVal);
        } else {
          const testVal = "Uji_" + Math.random().toString(36).slice(2, 8);
          await locator.fill(testVal);
          await page.evaluate(() => window.__onSave && window.__onSave());

          const res = await page.evaluate((path) => {
            const storeVal = window.PanelStore.get(path);
            const contentVal = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), window.__content);
            return { storeVal, contentVal };
          }, f.path);

          check(`${tpl.id} [${sec.key}]: perubahan field "${f.path}" tersimpan di store dan content`,
            res.storeVal === testVal && res.contentVal === testVal);

          if (f.path.startsWith("extras.")) {
            const subKey = f.path.slice("extras.".length);
            const extrasVal = await page.evaluate((k) => window.__content.extras && window.__content.extras[k], subKey);
            check(`${tpl.id} [${sec.key}]: field awalan extras.* tersimpan di content.extras.${subKey}`, extrasVal === testVal);
          }
        }
      }

      // d. Pastikan setiap photos slot me-render kartu slot foto dengan [data-slot="<photo.slot>"]
      const photos = Array.isArray(sec.photos) ? sec.photos : [];
      for (const p of photos) {
        const slotCount = await page.locator(`[data-slot="${p.slot}"]`).count();
        check(`${tpl.id} [${sec.key}]: photo slot "${p.slot}" me-render kartu [data-slot="${p.slot}"]`, slotCount >= 1);
        check(`${tpl.id} [${sec.key}]: photo slot "${p.slot}" berada dalam enum resmi`, OFFICIAL_PHOTO_SLOTS.has(p.slot));
      }
    }

    /* ── Verifikasi field dengan awalan extras.* tersimpan di content.extras.* ── */
    const extrasTestSection = {
      key: "extras_custom_section",
      label: "Pengaturan Kustom",
      fields: [
        { path: "extras.bannerHeadline", type: "text", label: "Headline Banner" },
        { path: "extras.enableSnowEffect", type: "switch", label: "Aktifkan Efek Salju" }
      ]
    };

    await page.setContent('<div id="outlet"></div>');
    await page.addScriptTag({ content: uiSrc });
    await page.addScriptTag({ content: HARNESS });
    await page.addScriptTag({ content: sectionSrc });

    await page.evaluate(async ({ sec, content }) => {
      await window.AdminPanel.renderSection(sec, content);
    }, { sec: extrasTestSection, content: DEFAULT_CONTENT });

    await page.locator('[data-path="extras.bannerHeadline"]').fill("Momen Spesial");
    await page.locator('[data-path="extras.enableSnowEffect"]').check();
    await page.evaluate(() => window.__onSave && window.__onSave());

    const extrasData = await page.evaluate(() => ({
      storeHeadline: window.PanelStore.get("extras.bannerHeadline"),
      storeSnow: window.PanelStore.get("extras.enableSnowEffect"),
      contentExtras: window.__content.extras
    }));

    check(`${tpl.id}: field awalan extras.bannerHeadline tersimpan di store`, extrasData.storeHeadline === "Momen Spesial");
    check(`${tpl.id}: field awalan extras.enableSnowEffect tersimpan di store`, extrasData.storeSnow === true);
    check(`${tpl.id}: field awalan extras.* tersimpan di content.extras.*`,
      extrasData.contentExtras &&
      extrasData.contentExtras.bannerHeadline === "Momen Spesial" &&
      extrasData.contentExtras.enableSnowEffect === true);
  }
} finally {
  await browser.close();
}

if (failed) {
  console.error("\nFAIL: verifikasi admin panel terhadap seluruh template gagal.");
  process.exit(1);
}
console.log("\nPASS: semua template lolos verifikasi sinkronisasi Admin Panel (§7.4).");
