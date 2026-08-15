/**
 * Menggantikan test-visual-editor-core.mjs (dihapus, membaca
 * assets/js/admin/visual-editor.js + assets/css/admin.css + markup tab
 * admin.html yang sudah tidak ada) — sekarang menargetkan
 * assets/js/panel/pages/editor-visual.js + assets/js/visual-editor/registry.js
 * (tidak berubah) + assets/css/panel.css.
 *
 * Satu perbedaan desain nyata (bukan sekadar rename) dicatat di sini: versi
 * lama punya mockup "ponsel" terpisah (.ve-phone, lebar tetap 430px) di
 * samping panel inspector permanen (.ve-inspector). Versi v2 memakai satu
 * iframe penuh lebar kartu (.p-ve-frame-wrap) + inspector sebagai MODAL
 * (menumpang pola .p-modal + PanelUI.openModal yang dipakai modal lain,
 * termasuk fokus terperangkap — lihat R yang menambah aksesibilitas modal).
 * Jadi cek geometri di sini menguji lebar iframe mengikuti kontainer, BUKAN
 * lebar mockup ponsel tetap yang sudah tidak ada.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const registry = await fs.readFile("assets/js/visual-editor/registry.js", "utf8");
const panel = await fs.readFile("assets/js/panel/pages/editor-visual.js", "utf8");
const adminHtml = await fs.readFile("admin.html", "utf8");
const panelCss = await fs.readFile("assets/css/panel.css", "utf8");

check("registry.js menghasilkan target milik-kode untuk tiap item teks (autoTargets/data-ve-auto)",
  registry.includes("autoTargets") && registry.includes("data-ve-auto"));
check('editor-visual.js: preview satu halaman scrollable ("Semua halaman — scroll")',
  panel.includes("Semua halaman — scroll"));
check("editor-visual.js: kontrol reset global ada (resetScope + \"Reset global\")",
  panel.includes("resetScope") && panel.includes("Reset global"));
check("editor-visual.js: UI kado tersembunyi disurface untuk diedit statis (data-ve-static-surface + gift-confirm-modal)",
  panel.includes("data-ve-static-surface") && panel.includes("gift-confirm-modal"));
check('admin.html: halaman Editor Visual terdaftar tanpa markup tab lama (pages/editor-visual.js dimuat, bukan data-tab="editor-visual")',
  adminHtml.includes("pages/editor-visual.js") && !adminHtml.includes('data-tab="editor-visual"') && !adminHtml.includes('id="tab-editor-visual"'));
check('editor-visual.js: inspector elemen dibuka sebagai modal beraksesibilitas (id="ve-edit-modal" lewat PanelUI.openModal, bukan .hidden=false polos)',
  panel.includes('id="ve-edit-modal"') && /openModal\(outlet\.querySelector\("#ve-edit-modal"\)/.test(panel));
check("editor-visual.js: dropdown font terkurasi (FONT_OPTIONS) dengan preview mandiri per opsi, bukan input bebas",
  panel.includes("FONT_OPTIONS") && panel.includes('<select class="p-select" id="ve-family">') && panel.includes("style=\"font-family:'${esc(font)}',sans-serif\""));
check("editor-visual.js: parameter visualEditorPreview lama (tidak didukung) sudah tidak ada", !panel.includes("visualEditorPreview=1"));

if (!failed) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.setContent(`<style>${panelCss}</style><div class="p-card" style="width:390px"><div class="p-ve-frame-wrap"><iframe></iframe></div></div>`);
    const width = await page.locator('.p-ve-frame-wrap').evaluate((el) => el.getBoundingClientRect().width);
    check("kanvas iframe Editor Visual mengikuti lebar kartu (bukan mockup lebar tetap)", Math.abs(width - (390 - 32)) < 4); // 390 - 2*var(--p-4) padding kartu
  } finally {
    await browser.close();
  }
}

if (failed) { console.error("\nFAIL: kontrak Editor Visual panel v2 belum terpenuhi."); process.exit(1); }
console.log("\nPASS: Editor Visual panel v2 punya target per-item, scope reset, modal beraksesibilitas, dan kanvas responsif.");
