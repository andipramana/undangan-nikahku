/**
 * Kontrak halaman panel Kado & Amplop (#/kado): pencatat kado/amplop
 * konsep-persis Kontak — daftar bernama bebas + entri (nama pemberi,
 * barang default 'Amplop Uang', jumlah & kuantiti boleh kosong,
 * keterangan dropdown PERSIS H-/H/H+), export Excel, tabel DB
 * gift_lists/gift_list_entries (migration 0025).
 *
 * Poin paling rawan rusak diam-diam (dites eksplisit):
 * - DUA tombol × yang beda tempat & beda fungsi: (1) × clearable KECIL
 *   DI DALAM input "Barang" (mengosongkan default sekali klik), dan
 *   (2) tombol hapus SATU BARIS di kolom terakhir tabel. Geometri
 *   keduanya diverifikasi dari markup ASLI halaman.
 * - Dropdown keterangan tidak boleh dapat opsi selain h-/h/h+.
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
// 2) Skema DB — pola 0022_contact_lists persis (RLS admin-only)
// ---------------------------------------------------------------------
for (const token of [
  'create table if not exists public.gift_lists',
  'create table if not exists public.gift_list_entries',
  "item text not null default 'Amplop Uang'",
  'amount numeric,',
  'quantity integer,',
  "timing text check (timing in ('h-','h','h+'))",
  'enable row level security',
  "public.can_access_invitation(invitation_id, array['admin'])",
  'grant all on public.gift_lists, public.gift_list_entries to authenticated'
]) {
  check(`migration 0025: ${token}`, migrationSrc.includes(token));
}

// ---------------------------------------------------------------------
// 3) Perilaku entri: field opsional, timing 3 opsi, scope tenant
// ---------------------------------------------------------------------
// Jumlah/kuantiti/keterangan BOLEH KOSONG → null (bukan 0 / bukan '').
check('parseNumber: kosong → null, NaN ditolak, kuantiti wajib bulat', kadoSrc.includes('if (!s) return { value: null };') && kadoSrc.includes('!Number.isFinite(n)') && kadoSrc.includes('integer && !Number.isInteger(n)'));
check('insert entri memakai amount.value/quantity.value/timing (null-able)', /amount:\s*amount\.value,\s*quantity:\s*quantity\.value,\s*timing/.test(kadoSrc));
// Dropdown PERSIS 3 opsi: sumber opsi tunggal TIMING_OPTIONS h-/h/h+.
const timingMatch = kadoSrc.match(/const TIMING_OPTIONS = \[([\s\S]*?)\];/);
check('TIMING_OPTIONS tepat 3 entri h-/h/h+', !!timingMatch && (timingMatch[1].match(/\{ v:/g) || []).length === 3 && timingMatch[1].includes('"h-"') && timingMatch[1].includes('"h"') && timingMatch[1].includes('"h+"'));
check('modal & tabel merender select timing dari TIMING_OPTIONS (satu sumber)', (kadoSrc.match(/TIMING_OPTIONS\.map/g) || []).length >= 2);
check('semua query DB tenant-scoped invitation_id', (kadoSrc.match(/eq\("invitation_id", tenant\.invitationId\)/g) || []).length >= 6);
check('hapus semua kado: konfirmasi ganda', /Hapus SEMUA \$\{rows\.length\} catatan kado/.test(kadoSrc) && kadoSrc.includes('Konfirmasi terakhir'));

// ---------------------------------------------------------------------
// 4) DUA tombol ×: clearable-in-field vs hapus baris — markup ASLI
// ---------------------------------------------------------------------
check('input Barang dibungkus .kd-itemwrap dengan tombol .kd-clear data-clear di DALAMnya', /kd-itemwrap">\s*\n\s*<input[^>]*kd-item-input[\s\S]*?<button type="button" class="kd-clear" data-clear=/.test(kadoSrc));
check('tombol hapus baris terpisah (data-del-entry di td sendiri)', /data-del-entry="\$\{e\.id\}"[^>]*>&times;<\/button><\/td>\s*<\/tr>/.test(kadoSrc));
check('clearItem menyimpan item="" lalu fokuskan input', /async function clearItem\(id\)/.test(kadoSrc) && /saveEntryField\(id, \{ item: "" \}, input\)/.test(kadoSrc) && /input\.focus\(\)/.test(kadoSrc));
check('CSS .kd-clear absolut di kanan dalam wrap', /\.kd-itemwrap\s*\{\s*position:\s*relative/.test(panelCss) && /\.kd-clear\s*\{\s*position:\s*absolute/.test(panelCss));

// ---------------------------------------------------------------------
// 5) Export Excel via XLSX (SheetJS sudah CDN di admin.html)
// ---------------------------------------------------------------------
check('exportExcel: aoa_to_sheet header lengkap + writeFile nama daftar', kadoSrc.includes('window.XLSX.utils.aoa_to_sheet') && kadoSrc.includes('"Nama Pemberi", "Barang", "Jumlah", "Kuantiti", "Keterangan"') && kadoSrc.includes('window.XLSX.utils.book_append_sheet(wb, ws, "Kado")') && /writeFile\(wb, `\$\{list\.name\}\.xlsx`\)/.test(kadoSrc));

// ---------------------------------------------------------------------
// 6) Geometri nyata: × clear DI DALAM input Barang; hapus baris di luar
//    (diekstrak dari sumber, bukan disalin manual — pola test-panel-wishes).
// ---------------------------------------------------------------------
const rowMatch = kadoSrc.match(/<tr data-entry-id="\$\{e\.id\}">[\s\S]*?<\/tr>/);
check('markup baris entri ditemukan untuk diuji geometrinya', !!rowMatch);

if (!failed && rowMatch) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  try {
    await page.setContent(`<!doctype html><style>${panelCss}</style><table class="p-table"><tbody>${rowMatch[0]}</tbody></table>`);
    const geo = await page.evaluate(() => {
      const r = (el) => el.getBoundingClientRect();
      const itemInput = r(document.querySelector('.kd-item-input'));
      const clearBtn = r(document.querySelector('.kd-clear'));
      const delBtn = r(document.querySelector('[data-del-entry]'));
      const nameInput = r(document.querySelector('.kd-name-input'));
      const cx = clearBtn.left + clearBtn.width / 2;
      const cy = clearBtn.top + clearBtn.height / 2;
      const inside = (rect, x, y) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      const centerY = (rect) => rect.top + rect.height / 2;
      return {
        clearInsideInput: inside(itemInput, cx, cy),
        delOutsideItemInput: !inside(itemInput, delBtn.left + delBtn.width / 2, delBtn.top + delBtn.height / 2),
        // Tombol tiny lebih pendek dari input & center-vertikal di sel —
        // bandingkan garis tengah, bukan tepi atas.
        sameRowAsInput: Math.abs(centerY(nameInput) - centerY(delBtn)) < 3
      };
    });
    check('tombol × clear berada DI DALAM kotak input Barang (clearable in-field)', geo.clearInsideInput);
    check('tombol hapus baris berada DI LUAR input Barang (kolom terpisah, beda fungsi)', geo.delOutsideItemInput);
    check('tombol hapus baris satu baris dengan input (bukan elemen lepas)', geo.sameRowAsInput);
  } finally {
    await browser.close();
  }
}

if (failed) { console.error('\nFAIL: kontrak kado & amplop panel belum terpenuhi.'); process.exit(1); }
console.log('\nPASS: kontrak kado & amplop — daftar/entri null-able, timing 3 opsi, × clearable vs hapus baris, export Excel.');
