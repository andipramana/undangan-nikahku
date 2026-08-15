/**
 * Menggantikan test-photo-editor-zoom-pan.mjs (dihapus commit f9977cc, dibuat
 * ulang sesuai docs/rencana-admin-v2-revisi.md R3) — sekarang menargetkan
 * editor pan/zoom di assets/js/panel/photos.js (window.PanelPhotos.openEditor),
 * bukan assets/js/admin/editor.js yang sudah dihapus. Matematika pan (object-
 * position digeser mengikuti arah seret, kedua sumbu, dengan zoom) tidak bisa
 * diverifikasi tanpa geometri nyata (bounding box, drag mouse) — page.setContent
 * mandiri, tanpa server, sama seperti pola test lain di repo.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
try {
  const css = await fs.readFile('assets/css/panel.css', 'utf8');
  await page.setContent(`<!doctype html><style>${css}</style>
    <div id="p-editor" class="p-editor" hidden><div class="p-editor__panel"><div class="p-editor__header"><h2>Atur</h2><button id="p-editor-close">Tutup</button></div><div class="p-editor__preview-wrap"><div class="p-editor__preview" id="p-editor-preview"><img id="p-editor-img"></div><p class="p-editor__hint"></p></div><label class="p-editor__zoom">Zoom<input id="p-editor-zoom" type="range" min="1" max="3" step=".01"><span id="p-editor-zoom-value"></span></label><div class="p-editor__footer"><button id="p-editor-reset">Reset</button><button id="p-editor-save">Simpan</button></div></div></div>`);
  await page.addScriptTag({ content: `
    window.AdminAPI = { photoUrl: p => p, tenant: { invitationId: 'test', slug: 'test' },
      sb: { from: () => ({ update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }) },
      toast: () => {}, query: async x => x };
    window.GalleryLayout = { ratioAt: () => 1, labelAt: () => '', rowAt: () => 1, shapeAt: () => 'full', choices: [] };
  ` });
  await page.addScriptTag({ path: 'assets/js/panel/ui.js' });
  await page.addScriptTag({ path: 'assets/js/panel/photos.js' });

  const photo = { id: 1, storage_path: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="800"%3E%3Crect width="800" height="800" fill="orange"/%3E%3C/svg%3E', focal_x: 50, focal_y: 50, zoom: 1 };
  await page.evaluate(p => window.PanelPhotos.openEditor(p, 'quote', 0), photo);
  await page.locator('#p-editor-img').waitFor({ state: 'visible' });
  await page.locator('#p-editor-img').evaluate(img => new Promise(r => img.complete ? r() : img.addEventListener('load', r, { once: true })));
  await page.locator('#p-editor-zoom').evaluate(input => { input.value = '2'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const preview = page.locator('#p-editor-preview');
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 - 30);
  await page.mouse.up();
  const result = await page.locator('#p-editor-img').evaluate(img => ({ fx: Number(img.dataset.fx), fy: Number(img.dataset.fy), origin: img.style.transformOrigin, zoom: img.style.transform }));
  if (!(result.fx > 50 && result.fy > 50) || !result.origin || result.zoom !== 'scale(2)') throw new Error(`Zoomed square photo must pan both axes: ${JSON.stringify(result)}`);

  // Rasio bingkai per folder (FOLDER_RATIO di photos.js) harus sesuai
  // pemakaian nyata di undangan — cover/opening/std2/subcover/closing full-
  // screen 9/19.5, bride/groom potret 2/3, event 1.2, quote 1:1, story 16/10.
  const ratios = await page.evaluate(async () => {
    const out = {};
    const folders = { cover: 9 / 19.5, bride: 2 / 3, event: 1.2, quote: 1, story: 16 / 10 };
    for (const folder of Object.keys(folders)) {
      window.PanelPhotos.openEditor({ id: 1, storage_path: '', focal_x: 50, focal_y: 50, zoom: 1 }, folder, 0);
      const preview = document.getElementById('p-editor-preview');
      out[folder] = { got: preview.style.width && preview.style.height ? (parseFloat(preview.style.width) / parseFloat(preview.style.height)) : null, want: folders[folder] };
    }
    return out;
  });
  for (const [folder, { got, want }] of Object.entries(ratios)) {
    if (got == null || Math.abs(got - want) > 0.02) throw new Error(`Editor preview ratio salah untuk folder ${folder}: got ${got}, want ${want}`);
  }

  console.log('PASS: editor pan/zoom panel v2 (photos.js) menggeser kedua sumbu saat zoom, dan rasio bingkai per folder sesuai tampilan tamu.');
} finally { await browser.close(); }
