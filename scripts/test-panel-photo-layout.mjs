/**
 * Menggantikan test-photo-layout-contract.mjs + test-gallery-admin-widths.mjs
 * (dihapus, keduanya membaca assets/js/admin/{photos,editor}.js dan
 * assets/css/admin.css yang sudah dihapus — lihat docs/rencana-admin-v2-revisi.md
 * R2+R3). Menguji bahwa lebar & baris kartu galeri di panel admin (panel.css +
 * panel/photos.js) TIDAK menduplikasi logika assets/js/gallery-layout.js
 * (dipakai bersama halaman tamu, CLAUDE.md: "jangan duplikasi logikanya"),
 * dan bahwa lebar SPAN di JS itu konsisten dengan grid-column di CSS —
 * risiko nyata: seseorang mengubah satu sisi tanpa sisi lain.
 */
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

// ---------------------------------------------------------------------
// 1) photos.js mendelegasikan shape/rasio/baris ke GalleryLayout, tidak
//    menghitung ulang polanya sendiri.
// ---------------------------------------------------------------------
const photosSrc = await fs.readFile('assets/js/panel/photos.js', 'utf8');
check('photos.js memakai GalleryLayout.shapeAt (bukan menghitung ulang)', photosSrc.includes('GalleryLayout.shapeAt'));
check('photos.js memakai GalleryLayout.ratioAt', photosSrc.includes('GalleryLayout.ratioAt'));
check('photos.js memakai GalleryLayout.rowAt', photosSrc.includes('GalleryLayout.rowAt'));
check('photos.js TIDAK membaca kolom gallery_row lama (baris dihitung otomatis, lihat gallery-layout.js)', !photosSrc.includes('gallery_row'));

// ---------------------------------------------------------------------
// 2) SPAN di gallery-layout.js (satu sumber kebenaran, dipakai tamu & admin)
//    konsisten dengan grid-column di panel.css — kalau salah satu diubah
//    tanpa yang lain, admin akan menampilkan lebar yang salah.
// ---------------------------------------------------------------------
const galleryLayoutSrc = await fs.readFile('assets/js/gallery-layout.js', 'utf8');
const spanMatch = galleryLayoutSrc.match(/SPAN\s*=\s*\{([^}]+)\}/);
check('gallery-layout.js punya SPAN', !!spanMatch);
const jsSpan = {};
if (spanMatch) {
  for (const m of spanMatch[1].matchAll(/(\w+):\s*(\d+)/g)) jsSpan[m[1]] = Number(m[2]);
}

const panelCss = await fs.readFile('assets/css/panel.css', 'utf8');
const cssSpan = {};
for (const shape of ['full', 'half', 'third', 'twothirds']) {
  const m = panelCss.match(new RegExp(`\\.p-photo-grid--gallery \\.p-photo-card--${shape}\\s*\\{[^}]*grid-column:\\s*span\\s*(\\d+)`));
  if (m) cssSpan[shape] = Number(m[1]);
}
for (const shape of ['full', 'half', 'third', 'twothirds']) {
  check(`SPAN.${shape} sama antara gallery-layout.js (${jsSpan[shape]}) dan panel.css (${cssSpan[shape]})`, jsSpan[shape] != null && jsSpan[shape] === cssSpan[shape]);
}

// ---------------------------------------------------------------------
// 3) Geometri nyata — page.setContent mandiri (tanpa server), sama seperti
//    pola test lain di repo. Verifikasi lebar piksel benar-benar 100% / 50%
//    / 33.33% / 66.67% dari grid, bukan cuma nilai grid-column yang benar
//    di atas kertas (mis. grid-template-columns yang salah tetap bisa lolos
//    cek statis tapi merender lebar yang salah).
// ---------------------------------------------------------------------
if (!failed) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  try {
    await page.setContent(`<!doctype html><style>${panelCss}</style><main style="width:390px"><div class="p-photo-grid p-photo-grid--gallery"><article class="p-photo-card p-photo-card--full"><div class="p-photo-card__thumb"></div></article><article class="p-photo-card p-photo-card--half"><div class="p-photo-card__thumb"></div></article><article class="p-photo-card p-photo-card--half"><div class="p-photo-card__thumb"></div></article><article class="p-photo-card p-photo-card--third"><div class="p-photo-card__thumb"></div></article><article class="p-photo-card p-photo-card--twothirds"><div class="p-photo-card__thumb"></div></article></div></main>`);
    const actual = await page.evaluate(() => {
      const grid = document.querySelector('.p-photo-grid--gallery').getBoundingClientRect();
      const rect = cls => document.querySelector(cls).getBoundingClientRect();
      return {
        grid: grid.width,
        full: rect('.p-photo-card--full').width,
        half: rect('.p-photo-card--half').width,
        third: rect('.p-photo-card--third').width,
        two: rect('.p-photo-card--twothirds').width
      };
    });
    const gap = 12; // var(--p-3), dipakai `gap` grid .p-photo-grid
    const expected = { full: actual.grid, half: (actual.grid - gap) / 2, third: (actual.grid - gap * 2) / 3, two: (actual.grid - gap * 2) * 2 / 3 + gap };
    for (const key of Object.keys(expected)) {
      check(`lebar kartu galeri "${key}" sesuai grid (got ${actual[key].toFixed(1)}, want ${expected[key].toFixed(1)})`, Math.abs(actual[key] - expected[key]) <= 1);
    }
  } finally {
    await browser.close();
  }
} else {
  console.error('SKIP: geometri nyata dilewati karena cek statis sudah gagal.');
}

if (failed) { console.error('\nFAIL: tata letak foto panel v2 tidak konsisten dengan gallery-layout.js.'); process.exit(1); }
console.log('\nPASS: tata letak foto panel v2 konsisten dengan gallery-layout.js (satu sumber kebenaran, tamu & admin).');
