/**
 * Menggantikan test-wish-block-list.mjs, test-wish-toolbar-layout.mjs,
 * test-wishes-page-size.mjs, dan test-wishes-actions-export.mjs (semua
 * dihapus, membaca assets/js/admin/wishes.js + assets/css/admin.css yang
 * sudah tidak ada) — sekarang menargetkan assets/js/panel/pages/ucapan.js.
 * Kelas CSS lama (.wish-block-list, .wish-toolbar__primary, dst) tidak
 * dipertahankan by design (halaman ini dibangun ulang dari kartu/token
 * .p-* umum, bukan kelas khusus per halaman) — jadi ini menguji PERILAKU
 * nyata, bukan nama kelas lama: daftar blokir tenant-scoped + bisa
 * di-unblock, dan tombol hapus-semua terpisah secara visual (tidak nempel)
 * dari Refresh/Export supaya tidak gampang ke-tap tanpa sengaja.
 *
 * Juga menyerap test-wishes-page-size.mjs dan test-wishes-actions-export.mjs
 * (dihapus di commit yang sama, TIDAK disebut di tabel R3
 * docs/rencana-admin-v2-revisi.md -- celah di dokumen itu sendiri, tapi
 * perilakunya masih ada persis di ucapan.js jadi tetap wajib dijaga sesuai
 * semangat R3: "menguji perilaku yang masih ada... paling mudah rusak diam-diam").
 */
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const ucapanSrc = await fs.readFile('assets/js/panel/pages/ucapan.js', 'utf8');
const adminHtml = await fs.readFile('admin.html', 'utf8');

// ---------------------------------------------------------------------
// 0) Dropdown ukuran halaman (10/20/50/100) persisten ke localStorage, dan
//    ganti ukuran mereset ke halaman 1 (eks test-wishes-page-size.mjs).
// ---------------------------------------------------------------------
for (const token of ['PAGE_SIZES = [10, 20, 50, 100]', 'id="wi-page-size"', 'localStorage.setItem(PAGE_SIZE_KEY', 'from + pageSize - 1', 'load(1)']) {
  check(`ucapan.js (page size): ${token}`, ucapanSrc.includes(token));
}

// ---------------------------------------------------------------------
// 0b) Refresh, hapus-semua dengan konfirmasi ganda, dan export CSV/PNG
//     seluruh ucapan (bukan cuma halaman aktif) — eks
//     test-wishes-actions-export.mjs.
// ---------------------------------------------------------------------
for (const token of ['id="wi-export-modal"', 'id="wi-refresh"', 'id="wi-delete-all"', 'id="wi-export"', 'async function fetchAllWishes()', 'for (let from = 0;', 'function exportCsv', 'async function exportPng', 'Hapus SEMUA ${st.total} ucapan']) {
  check(`ucapan.js (aksi & export): ${token}`, ucapanSrc.includes(token));
}
check('admin.html memuat html2canvas untuk export PNG', adminHtml.includes('html2canvas@1.4.1'));

// ---------------------------------------------------------------------
// 1) Daftar perangkat diblokir: tenant-scoped, bisa di-unblock.
// ---------------------------------------------------------------------
for (const token of ['sb.from("wish_blocks").select', 'Perangkat diblokir', 'data-unblock', 'async function unblock', '.eq("device_token", deviceToken)', 'tenant.invitationId']) {
  check(`ucapan.js: ${token}`, ucapanSrc.includes(token));
}

// ---------------------------------------------------------------------
// 2) Toolbar: Refresh/Export vs Hapus semua — geometri nyata dari markup
//    ASLI ucapan.js (diekstrak dari sumbernya, bukan disalin manual, supaya
//    test tetap jujur kalau markupnya berubah).
// ---------------------------------------------------------------------
const toolbarMatch = ucapanSrc.match(/<div style="display:grid;gap:\.6rem">[\s\S]*?id="wi-delete-all"[^<]*<\/button>\s*<\/div>/);
check('ucapan.js: blok toolbar (Refresh/Export/Hapus semua) ditemukan untuk diuji geometrinya', !!toolbarMatch);

if (!failed && toolbarMatch) {
  const panelCss = await fs.readFile('assets/css/panel.css', 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  try {
    await page.setContent(`<!doctype html><style>${panelCss}</style><main style="width:360px">${toolbarMatch[0]}</main>`);
    const geo = await page.evaluate(() => {
      const refresh = document.getElementById('wi-refresh').getBoundingClientRect();
      const del = document.getElementById('wi-delete-all').getBoundingClientRect();
      return { refreshBottom: refresh.bottom, delTop: del.top, refreshLeft: refresh.left, delLeft: del.left, delWidth: del.width, containerWidth: document.querySelector('main').getBoundingClientRect().width };
    });
    // Terpisah = baris berbeda (delTop >= refreshBottom), BUKAN cuma
    // di-flex-wrap ke kanan pada baris yang sama.
    check('tombol "Hapus semua ucapan" ada di baris terpisah dari Refresh/Export (tidak menempel)', geo.delTop >= geo.refreshBottom - 1);
    check('tombol "Hapus semua ucapan" selebar penuh (gampang dilihat, bukan kecil menyempil)', geo.delWidth >= geo.containerWidth - 4);
  } finally {
    await browser.close();
  }
}

if (failed) { console.error('\nFAIL: kontrak ucapan panel v2 belum terpenuhi.'); process.exit(1); }
console.log('\nPASS: daftar blokir tenant-scoped + tombol hapus-semua terpisah aman dari aksi rutin.');
