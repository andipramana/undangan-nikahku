/**
 * Kontrak halaman panel Kado & Amplop (#/kado): pencatat kado/amplop
 * konsep-persis Kontak — daftar bernama bebas + entri (nama pemberi,
 * barang default 'Amplop Uang', jumlah & kuantiti boleh kosong), export
 * Excel, tabel DB gift_lists/gift_list_entries (migration 0025).
 *
 * Revisi atas umpan balik pemilik produk (dites eksplisit supaya tak rusak
 * diam-diam):
 * - Keterangan = TEKS BEBAS (0026 melepas constraint check 3 opsi) —
 *   dropdown H-/H/H+ tidak boleh kembali.
 * - Jumlah memakai pemisah ribuan saat tampil ("1.500.000") dan tetap
 *   menerima titik/koma saat diketik; Excel menulis angka mentah.
 * - Detail daftar punya ringkasan total pemberi & total jumlah.
 * - Daftar entri compact ala kontak /wa (article per baris) — TANPA tabel
 *   yang harus scroll horizontal di HP.
 * - DUA tombol × beda tempat & beda fungsi: × clearable DI DALAM input
 *   "Barang" vs tombol hapus baris (.kd-del) — geometrinya diverifikasi
 *   dari markup ASLI halaman.
 */
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const kadoSrc = await fs.readFile('assets/js/panel/pages/kado.js', 'utf8');
const adminHtml = await fs.readFile('admin.html', 'utf8');
const routerSrc = await fs.readFile('assets/js/panel/router.js', 'utf8');
const migrationSrc = await fs.readFile('supabase/migrations/0025_gift_lists.sql', 'utf8');
const migration26Src = await fs.readFile('supabase/migrations/0026_gift_timing_free_text.sql', 'utf8');
const panelCss = await fs.readFile('assets/css/panel.css', 'utf8');

// ---------------------------------------------------------------------
// 1) Registrasi halaman + navigasi + script tag
// ---------------------------------------------------------------------
check('terdaftar PanelPages["kado"] grup Tamu ikon gift', /PanelPages\["kado"\] = \{/.test(kadoSrc) && kadoSrc.includes('title: "Kado & Amplop"') && kadoSrc.includes('group: "Tamu"') && kadoSrc.includes('icon("gift")'));
check('router TOOL_GUEST membawa key "kado"', /\{ key: "kado" \}/.test(routerSrc));
check('admin.html memuat pages/kado.js setelah xlsx CDN & kontak.js', adminHtml.indexOf('xlsx.full.min.js') < adminHtml.indexOf('pages/kontak.js') && adminHtml.indexOf('pages/kontak.js') < adminHtml.indexOf('pages/kado.js'));
// Murni internal admin — halaman tamu tidak boleh ikut menyentuh tabel ini.
const mainSrc = await fs.readFile('assets/js/main.js', 'utf8');
check('halaman tamu (main.js) tidak menyentuh gift_lists', !mainSrc.includes('gift_list'));

// ---------------------------------------------------------------------
// 2) Skema DB — pola 0022 persis + keterangan teks bebas (0026)
// ---------------------------------------------------------------------
for (const token of [
  'create table if not exists public.gift_lists',
  'create table if not exists public.gift_list_entries',
  "item text not null default 'Amplop Uang'",
  'amount numeric,',
  'quantity integer,',
  'enable row level security',
  "public.can_access_invitation(invitation_id, array['admin'])",
  'grant all on public.gift_lists, public.gift_list_entries to authenticated'
]) {
  check(`migration 0025: ${token}`, migrationSrc.includes(token));
}
check('migration 0026: constraint check timing dilepas (teks bebas)', migration26Src.includes('drop constraint if exists gift_list_entries_timing_check'));

// ---------------------------------------------------------------------
// 3) Perilaku entri: field opsional, scope tenant, hapus-semua
// ---------------------------------------------------------------------
// Kuantiti BOLEH KOSONG → null; jumlah juga null-able lewat parseAmountInput.
check('parseNumber (kuantiti): kosong → null, NaN ditolak, wajib bulat', kadoSrc.includes('if (!s) return { value: null };') && kadoSrc.includes('!Number.isFinite(n)') && kadoSrc.includes('!Number.isInteger(n)'));
check('insert entri memakai amount.value/quantity.value/timing (null-able)', /amount:\s*amount\.value,\s*quantity:\s*quantity\.value,\s*timing/.test(kadoSrc));
check('semua query DB tenant-scoped invitation_id', (kadoSrc.match(/eq\("invitation_id", tenant\.invitationId\)/g) || []).length >= 6);
check('hapus semua kado: konfirmasi ganda', /Hapus SEMUA \$\{rows\.length\} catatan kado/.test(kadoSrc) && kadoSrc.includes('Konfirmasi terakhir'));

// ---------------------------------------------------------------------
// 4) Keterangan TEKS BEBAS — dropdown H-/H/H+ tidak boleh kembali
// ---------------------------------------------------------------------
check('keterangan: input teks bebas di daftar & modal (bukan select)', kadoSrc.includes('kd-timing-input') && !/TIMING_OPTIONS/.test(kadoSrc) && !kadoSrc.includes('<select class="p-input" id="kd-entry-timing"'));
check('simpan timing: trim, kosong → null', /\{ timing: input\.value\.trim\(\) \|\| null \}/.test(kadoSrc) && /#kd-entry-timing"\)\.value\.trim\(\) \|\| null/.test(kadoSrc));

// ---------------------------------------------------------------------
// 5) Jumlah: pemisah ribuan saat tampil, toleran saat diketik
// ---------------------------------------------------------------------
check('parseAmountInput: titik ribuan dibuang, koma = desimal, kosong → null', kadoSrc.includes('replaceAll(".", "")') && kadoSrc.includes('.replace(",", ".")') && /if \(!s\) return \{ value: null \};/.test(kadoSrc));
check('fmtRibuan pakai Intl.NumberFormat("id-ID")', kadoSrc.includes('Intl.NumberFormat("id-ID")'));
check('input jumlah type=text inputmode=numeric (bukan number) di daftar & modal', /<input type="text" inputmode="numeric" class="p-input kd-plain kd-amount-input"/.test(kadoSrc) && /<input[^>]*id="kd-entry-amount"[^>]*type="text"|<input type="text" inputmode="numeric"[^>]*id="kd-entry-amount"/.test(kadoSrc));
check('jumlah tampil terformat dari DB; fokus kembali ke angka mentah', /escAttr\(fmtRibuan\(e\.amount\)\)/.test(kadoSrc) && /input\.value = String\(e\.amount\)/.test(kadoSrc));
check('modal jumlah terformat on blur', /modalAmountInput\.addEventListener\("blur"/.test(kadoSrc) && /modalAmountInput\.value = fmtRibuan\(value\)/.test(kadoSrc));
check('saveEntryField sukses → tampilan diformat ulang; return bool dipakai', /input\.value = patch\.amount === null \? "" : fmtRibuan\(patch\.amount\)/.test(kadoSrc));

// ---------------------------------------------------------------------
// 6) Ringkasan total pemberi & total jumlah di detail daftar
// ---------------------------------------------------------------------
check('summary: chip total pemberi + total jumlah (amount null dilewati)', kadoSrc.includes('kd-summary__item') && kadoSrc.includes('<span>pemberi</span>') && kadoSrc.includes('<span>total jumlah</span>') && kadoSrc.includes('sum += Number(r.amount);') && kadoSrc.includes('adaAmount'));

// ---------------------------------------------------------------------
// 7) Daftar compact ala /wa — tanpa tabel scroll-horizontal
// ---------------------------------------------------------------------
check('entri dirender sebagai article.kd-entry, BUKAN <table>/<td>', /<article class="kd-entry" data-entry-id=/.test(kadoSrc) && !/<table|<tbody|overflow-x:auto">[\s\S]*?<table/.test(kadoSrc.split('renderDetail')[1] || ''));
check('CSS entri BERKARTU (latar row + border penuh + radius) — bukan garis bawah menyatu', /\.kd-list\s*\{\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:/.test(panelCss) && /\.kd-entry\s*\{[^}]*background:\s*var\(--p-row\);/.test(panelCss.replace(/\n/g, ' ').replace(/\s+/g, ' ')) && /\.kd-entry\s*\{[^}]*border-radius:/.test(panelCss) && !/\.kd-entry\s*\{[^}]*border-bottom/.test(panelCss));
check('jumlah: blur TANPA edit memulihkan tampilan terformat (bug klik-lalu-lepas)', kadoSrc.includes('parseAmountInput(input.value).value === e.amount') && /addEventListener\("blur"[\s\S]{0,400}?fmtRibuan\(e\.amount\)/.test(kadoSrc));
check('nama borderless transparan (hover/focus berdandan)', /\.kd-name-input\s*\{[^}]*border:\s*1px solid transparent/.test(panelCss.replace(/\n/g, ' ').replace(/\s+/g, ' ')));

// ---------------------------------------------------------------------
// 8) DUA tombol ×: clearable-in-field vs hapus baris — markup ASLI
// ---------------------------------------------------------------------
check('input Barang dibungkus .kd-itemwrap dengan tombol .kd-clear data-clear di DALAMnya', /kd-itemwrap">\s*\n\s*<input[^>]*kd-item-input[\s\S]*?<button type="button" class="kd-clear" data-clear=/.test(kadoSrc));
check('tombol hapus baris .kd-del data-del-entry terpisah di kd-entry__top', /kd-name-input[\s\S]*?<\/div>\s*\n?\s*(?:<!--[\s\S]*?-->\s*)?<\/div>|data-del-entry="\$\{e\.id\}"[^>]*class="kd-del"|class="kd-del" data-del-entry="\$\{e\.id\}"/.test(kadoSrc) && kadoSrc.includes('class="kd-del" data-del-entry="${e.id}"'));
check('clearItem menyimpan item="" lalu fokuskan input', /async function clearItem\(id\)/.test(kadoSrc) && /saveEntryField\(id, \{ item: "" \}, input\)/.test(kadoSrc) && /input\.focus\(\)/.test(kadoSrc));
check('CSS .kd-clear absolut di kanan dalam wrap', /\.kd-itemwrap\s*\{\s*position:\s*relative/.test(panelCss) && /\.kd-clear\s*\{\s*position:\s*absolute/.test(panelCss));
check('modal kado beri grid+gap antar field & tombol Simpan', /#kd-list-modal \.p-modal__panel,\s*\n#kd-entry-modal \.p-modal__panel \{ display: grid; gap: var\(--p-3\); \}/.test(panelCss));

// ---------------------------------------------------------------------
// 9) Export Excel via XLSX (SheetJS sudah CDN di admin.html)
// ---------------------------------------------------------------------
check('exportExcel: header lengkap + angka mentah (bisa di-sum) + writeFile', kadoSrc.includes('window.XLSX.utils.aoa_to_sheet') && kadoSrc.includes('"Nama Pemberi", "Barang", "Jumlah", "Kuantiti", "Keterangan"') && kadoSrc.includes('window.XLSX.utils.book_append_sheet(wb, ws, "Kado")') && /writeFile\(wb, `\$\{list\.name\}\.xlsx`\)/.test(kadoSrc));

// ---------------------------------------------------------------------
// 10) Geometri nyata: × clear DI DALAM input Barang; hapus baris di luar;
//     semuanya muat dalam lebar HP 360px TANPA scroll horizontal.
//     (markup diekstrak dari sumber, pola test-panel-wishes)
// ---------------------------------------------------------------------
const rowMatch = kadoSrc.match(/<article class="kd-entry" data-entry-id="\$\{e\.id\}">[\s\S]*?<\/article>/);
check('markup baris entri ditemukan untuk diuji geometrinya', !!rowMatch);

if (!failed && rowMatch) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  try {
    await page.setContent(`<!doctype html><style>${panelCss}</style><div style="width:360px"><div class="kd-list">${rowMatch[0]}</div></div>`);
    const geo = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const itemInput = r(document.querySelector('.kd-item-input'));
      const clearBtn = r(document.querySelector('.kd-clear'));
      const delBtn = r(document.querySelector('[data-del-entry]'));
      const nameInput = r(document.querySelector('.kd-name-input'));
      const entry = r(document.querySelector('.kd-entry'));
      const cx = clearBtn.left + clearBtn.width / 2;
      const cy = clearBtn.top + clearBtn.height / 2;
      const inside = (rect, x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const centerY = (rect) => rect.top + rect.height / 2;
      const inputs = [...document.querySelectorAll('input')].map(r);
      return {
        clearInsideInput: inside(itemInput, cx, cy),
        delOutsideItemInput: !inside(itemInput, delBtn.left + delBtn.width / 2, delBtn.top + delBtn.height / 2),
        sameRowAsName: Math.abs(centerY(nameInput) - centerY(delBtn)) < 4,
        noHorizontalOverflow: document.documentElement.scrollWidth <= 362,
        allInputsVisible: inputs.every((rect) => rect.left >= -1 && rect.right <= 362)
      };
    });
    check('tombol × clear berada DI DALAM kotak input Barang (clearable in-field)', geo.clearInsideInput);
    check('tombol hapus baris berada DI LUAR input Barang (beda tempat & fungsi)', geo.delOutsideItemInput);
    check('tombol hapus satu baris dengan nama pemberi', geo.sameRowAsName);
    check('di HP 360px: tanpa overflow horizontal', geo.noHorizontalOverflow);
    check('di HP 360px: SEMUA input terlihat utuh tanpa scroll ke kanan', geo.allInputsVisible);
  } finally {
    await browser.close();
  }
}

if (failed) { console.error('\nFAIL: kontrak kado & amplop panel belum terpenuhi.'); process.exit(1); }
console.log('\nPASS: kontrak kado & amplop — teks bebas, ribuan, summary, list compact, × clearable vs hapus baris, export Excel.');
