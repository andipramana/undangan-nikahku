/** Picker foto + crop KHUSUS TEMPLATE AKTIF (assets/js/panel/photo-template-
 * picker.js) — pasangan dari test-panel-photo-editor.mjs (yang menguji mode
 * DASAR, pool bersama, simpan seketika ke DB). Di sini modenya beda total:
 * draft di memori, ditunda sampai commit() dipanggil pages/section.js saat
 * bar Simpan ditekan — jadi yang paling penting dibuktikan adalah TIDAK ADA
 * satu pun panggilan jaringan sampai commit() dipanggil eksplisit.
 *
 * Pola sama seperti test lain di repo: page.setContent mandiri (tanpa
 * server), AdminAPI/PanelStore/GalleryLayout distub, panel.css asli dimuat
 * supaya --photo-ratio & kelas .p-photo-card--excluded benar-benar berlaku.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

let failed = false;
function check(label, pass, detail) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}${detail ? ' — ' + detail : ''}`); failed = true; }
}

const [css, uiSrc, photosSrc, pickerSrc] = await Promise.all([
  fs.readFile('assets/css/panel.css', 'utf8'),
  fs.readFile('assets/js/panel/ui.js', 'utf8'),
  fs.readFile('assets/js/panel/photos.js', 'utf8'),
  fs.readFile('assets/js/panel/photo-template-picker.js', 'utf8')
]);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.setContent(`<!doctype html><style>${css}</style>
    <div id="p-editor" class="p-editor" hidden><div class="p-editor__panel"><div class="p-editor__header"><h2>Atur</h2><button id="p-editor-close">Tutup</button></div><div class="p-editor__preview-wrap"><div class="p-editor__preview" id="p-editor-preview"><img id="p-editor-img"></div><p class="p-editor__hint"></p></div><label class="p-editor__zoom">Zoom<input id="p-editor-zoom" type="range" min="1" max="3" step=".01"><span id="p-editor-zoom-value"></span></label><div class="p-editor__footer"><button id="p-editor-reset">Reset</button><button id="p-editor-save">Simpan</button></div></div></div>
    <div id="outlet"></div>`);

  // Pool 3 foto untuk slot "bride". __networkCalls menghitung SETIAP panggilan
  // ke sb.from("photos") — kalau ini naik SELAIN saat query awal (load pool),
  // berarti picker menulis ke DB langsung, bukan menunda ke memori.
  await page.addScriptTag({ content: `
    window.__networkCalls = 0;
    window.__tplSet = null;
    const POOL = [
      { id: 1, storage_path: 'a.webp', alt: 'Foto A', focal_x: 50, focal_y: 50, zoom: 1, sort_order: 0 },
      { id: 2, storage_path: 'b.webp', alt: 'Foto B', focal_x: 50, focal_y: 50, zoom: 1, sort_order: 1 },
      { id: 3, storage_path: 'c.webp', alt: 'Foto C', focal_x: 50, focal_y: 50, zoom: 1, sort_order: 2 }
    ];
    window.AdminAPI = {
      photoUrl: (p) => p, tenant: { invitationId: 'test', slug: 'test' }, toast: () => {},
      query: async (q) => q,
      sb: { from: (table) => {
        window.__networkCalls++;
        return {
          select() { return this; }, eq() { return this; }, order() { return this; },
          update() { window.__networkCalls++; return this; },
          then(resolve) { resolve({ data: table === 'photos' ? POOL : [], error: null }); }
        };
      } }
    };
    window.GalleryLayout = { ratioAt: () => 1, labelAt: () => '', rowAt: () => 1, shapeAt: () => 'full', choices: [] };
    window.PanelStore = {
      __overrides: {},
      tplGet(path, fallback) { return window.PanelStore.__overrides[path] ?? fallback; },
      tplSet(path, value) { window.__tplSet = { path, value }; window.PanelStore.__overrides[path] = value; },
      activeManifest: async () => ({ id: 'nocturne', name: 'Nocturne' })
    };
  ` });
  await page.addScriptTag({ content: uiSrc });
  await page.addScriptTag({ content: photosSrc });
  await page.addScriptTag({ content: pickerSrc });

  const spec = { slot: 'bride', label: 'Foto mempelai wanita', ratio: '3/4', max: 1 };
  await page.evaluate((s) => {
    window.__dirty = 0;
    window.__handle = window.PanelTemplatePhotos.mount(document.getElementById('outlet'), s, () => { window.__dirty++; });
  }, spec);
  await page.locator('.p-photo-card').first().waitFor({ state: 'visible' });

  check('picker: pool 3 foto tampil sebagai kartu', await page.locator('.p-photo-card').count() === 3);
  check('picker: belum ada yang tercentang → semua kartu meredup',
    await page.locator('.p-photo-card--excluded').count() === 3);

  // Centang kartu pertama.
  await page.locator('.p-photo-card [data-include]').first().click();
  check('picker: mencentang menandai kotor (markDirty)', await page.evaluate(() => window.__dirty) === 1);
  check('picker: kartu tercentang tidak lagi meredup',
    await page.locator('.p-photo-card--excluded').count() === 2);

  // max:1 — centang kartu KEDUA harus otomatis melepas yang pertama, bukan
  // menolak atau membiarkan dua-duanya tercentang.
  const secondCheckbox = page.locator('.p-photo-card [data-include]').nth(1);
  await secondCheckbox.click();
  const checkedCount = await page.locator('.p-photo-card input[data-include]:checked').count();
  check('picker: max:1 melepas pilihan lama saat memilih baru (bukan dua-duanya)', checkedCount === 1);

  // Buka editor crop pada kartu yang tercentang, ubah zoom, simpan — HARUS
  // TIDAK memicu network update, hanya mengubah draft di memori.
  const callsBefore = await page.evaluate(() => window.__networkCalls);
  await page.locator('.p-photo-card:not(.p-photo-card--excluded) [data-edit]').click();
  await page.locator('#p-editor-img').waitFor({ state: 'visible' });
  await page.locator('#p-editor-zoom').evaluate((input) => { input.value = '1.8'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#p-editor-save').click();
  await page.locator('#p-editor').evaluate((el) => el.hidden === true || Promise.resolve()); // tunggu modal tertutup
  const callsAfter = await page.evaluate(() => window.__networkCalls);
  check('picker: menyimpan crop TIDAK memanggil jaringan (ditunda ke commit)', callsAfter === callsBefore,
    `sebelum=${callsBefore} sesudah=${callsAfter}`);

  // commit() — sekarang barulah ditulis ke PanelStore.
  await page.evaluate(() => window.__handle.commit());
  const written = await page.evaluate(() => window.__tplSet);
  check('picker: commit() menulis lewat PanelStore.tplSet ke path yang benar',
    written && written.path === 'photos.bride');
  check('picker: array yang ditulis berisi satu foto dengan zoom yang baru diatur',
    written && written.value.length === 1 && Math.abs(written.value[0].zoom - 1.8) < 0.01,
    JSON.stringify(written));

  // Reset ke bawaan mengosongkan array override.
  await page.locator('[data-reset]').click();
  check('picker: reset ke bawaan mengosongkan pilihan',
    await page.locator('.p-photo-card--excluded').count() === 3);
  await page.evaluate(() => window.__handle.commit());
  const afterReset = await page.evaluate(() => window.__tplSet);
  check('picker: commit() setelah reset menulis array kosong',
    afterReset && Array.isArray(afterReset.value) && afterReset.value.length === 0);

  console.log('\nPASS: picker foto per-template — centang/urutan/crop tertunda di memori, max ditegakkan, commit() menulis lewat PanelStore.');
} finally {
  await browser.close();
}

if (failed) { console.error('\nFAIL: picker foto per-template tidak memenuhi kontrak.'); process.exit(1); }
