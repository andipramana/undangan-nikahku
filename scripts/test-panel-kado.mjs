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
 * - Layout baris entri: jumlah nominal di BARIS TERPISAH; badge qty ungu
 *   (ANGKA SAJA — tanpa ×) sebaris barang dan HANYA saat qty terisi —
 *   kosong cukup tombol samar "+ qty" (geometri diuji dua varian).
 * - × clearable "Barang" HANYA di modal tambah kado; baris daftar polos
 *   (× dobel dekat badge membingungkan) — hapus baris (.kd-del) tetap di
 *   kanan atas tiap baris.
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
check('jumlah selalu terformat: DB → fmtRibuan, TANPA konversi mentah saat fokus (live format)', /escAttr\(fmtRibuan\(e\.amount\)\)/.test(kadoSrc) && !kadoSrc.includes('input.value = String(e.amount)'));
check('modal & baris daftar: wireLiveFormat terpasang untuk format langsung', kadoSrc.includes('wireLiveFormat(outlet.querySelector("#kd-entry-amount"))') && /kd-amount-input"\)\.forEach\(\(input\) => \{\s*wireLiveFormat\(input\);/.test(kadoSrc));
check('helper formatAmountTyped: grouping ribuan + pemetaan ulang caret', kadoSrc.includes("\\B(?=(\\d{3})+(?!\\d))") && /\.replace\(\/\\D\/g, ""\)\.length/.test(kadoSrc));
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
check('error-path simpan amount memulihkan tampilan TERFORMAT (bukan angka mentah)', /else if \("amount" in patch\) input\.value = e\.amount !== null && e\.amount !== undefined \? fmtRibuan\(e\.amount\) : "";/.test(kadoSrc));
// Layout permintaan eksplisit pemilik produk: jumlah = BARIS TERPISAH di
// bawah barang; badge qty "×N" ungu SEBARIS barang dan HANYA saat qty
// terisi — kosong cukup tombol samar "+ qty" (tanpa × sama sekali).
const flatCss = panelCss.replace(/\n/g, ' ').replace(/\s+/g, ' ');
check('qty: badge hanya saat terisi, kosong → tombol "+ qty" (tanpa badge)', /function qtyControlHtml/.test(kadoSrc) && /e\.quantity !== null && e\.quantity !== undefined && e\.quantity !== ""/.test(kadoSrc) && kadoSrc.includes('class="kd-qty-add" data-add-qty=') && kadoSrc.includes('+ qty'));
check('jumlah baris terpisah: div.kd-entry__amount sesudah kontrol qty', kadoSrc.includes('${qtyControlHtml(e)}') && kadoSrc.indexOf('${qtyControlHtml(e)}') < kadoSrc.indexOf('<div class="kd-entry__amount">'));
check('kosongkan qty → kembali jadi "+ qty"; blur kosong juga revert', /value === null \|\| value === undefined\) && input\.isConnected/.test(kadoSrc) && /input\.addEventListener\("blur", \(\) => \{\s*\n\s*if \(input\.isConnected && input\.value\.trim\(\) === ""\)/.test(kadoSrc));
check('"+ qty" diklik → swap jadi input angka lalu fokus', /function wireAddQtyButton/.test(kadoSrc) && /btn\.replaceWith\(input\)/.test(kadoSrc) && /wireQuantityInput\(input\);\s*\n\s*input\.focus\(\)/.test(kadoSrc));
check('badge qty ungu pill mono via token violet (tanpa hex di luar :root), tanpa .kd-qty-x', panelCss.includes('--p-violet: #6d28d9;') && panelCss.includes('background: var(--p-violet-wash); color: var(--p-violet);') && /\.kd-qty:focus-within[^}]*border-color:\s*var\(--p-violet-line\)/.test(panelCss) && !panelCss.includes('.kd-qty-x'));
check('tombol "+ qty" samar bergaris putus (bukan badge)', /\.kd-qty-add\s*\{[^}]*border:\s*1px dashed var\(--p-line\)/.test(flatCss));
check('nominal baris sendiri: .kd-entry__amount flex + padding kiri .4rem (Rp sejajar teks field) + angka rata kanan mono', /\.kd-entry__amount\s*\{[^}]*display:\s*flex/.test(flatCss) && /\.kd-entry__amount\s*\{[^}]*padding-left:\s*\.4rem/.test(flatCss) && /\.kd-entry__amount \.kd-amount-input\s*\{[^}]*text-align:\s*right/.test(flatCss));
check('nama borderless transparan (hover/focus berdandan)', /\.kd-name-input\s*\{[^}]*border:\s*1px solid transparent/.test(panelCss.replace(/\n/g, ' ').replace(/\s+/g, ' ')));

// ---------------------------------------------------------------------
// 8) × clear "Barang" HANYA di modal tambah; baris daftar polos
// ---------------------------------------------------------------------
check('× clear Barang hanya di modal: kd-itemwrap + #kd-entry-item-clear', /<span class="kd-itemwrap"><input class="p-input" id="kd-entry-item"[^>]*><button type="button" class="kd-clear" id="kd-entry-item-clear"/.test(kadoSrc));
check('baris daftar polos: tak ada data-clear & kd-itemwrap cuma di modal', !kadoSrc.includes('data-clear=') && (kadoSrc.match(/kd-itemwrap/g) || []).length === 1);
check('clear modal: kosongkan + fokus, murni UI tanpa tulis DB (clearItem DB lama tiada)', kadoSrc.includes('#kd-entry-item-clear")') && /itemInput\.value = "";/.test(kadoSrc) && /itemInput\.focus\(\)/.test(kadoSrc) && !kadoSrc.includes('async function clearItem'));
check('tombol hapus baris .kd-del data-del-entry tetap di kd-entry__top', /kd-name-input[\s\S]*?<\/div>\s*\n?\s*(?:<!--[\s\S]*?-->\s*)?<\/div>|data-del-entry="\$\{e\.id\}"[^>]*class="kd-del"|class="kd-del" data-del-entry="\$\{e\.id\}"/.test(kadoSrc) && kadoSrc.includes('class="kd-del" data-del-entry="${e.id}"'));
check('CSS .kd-clear absolut di kanan dalam wrap (dipakai modal)', /\.kd-itemwrap\s*\{\s*position:\s*relative/.test(panelCss) && /\.kd-clear\s*\{\s*position:\s*absolute/.test(panelCss));
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
  // ${qtyControlHtml(e)} diekspansi manual jadi DUA varian: qty terisi
  // (badge angka polos) dan qty kosong (tombol "+ qty" — tanpa badge sama
  // sekali).
  const BADGE = '<span class="kd-qty"><input type="text" inputmode="numeric" class="kd-qty-num kd-quantity-input" data-id="1" value="2" aria-label="Kuantiti"></span>';
  const GHOST = '<button type="button" class="kd-qty-add" data-add-qty="1" aria-label="Isi kuantiti">+ qty</button>';
  const expand = (ctl) => rowMatch[0].replace('${qtyControlHtml(e)}', ctl);
  const browser = await chromium.launch();
  try {
    for (const [label, html] of [['qty terisi', expand(BADGE)], ['qty kosong', expand(GHOST)]]) {
      const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
      await page.setContent(`<!doctype html><style>${panelCss}</style><div style="width:360px"><div class="kd-list">${html}</div></div>`);
      const geo = await page.evaluate(() => {
        const q = (sel) => document.querySelector(sel);
        const r = (el) => el.getBoundingClientRect();
        const itemInput = r(q('.kd-item-input'));
        const delBtn = r(q('[data-del-entry]'));
        const nameInput = r(q('.kd-name-input'));
        const meta = q('.kd-entry__meta');
        const amountInput = q('.kd-amount-input');
        const qtyNum = q('.kd-qty-num');
        const qtyAdd = q('.kd-qty-add');
        const centerY = (rect) => rect.top + rect.height / 2;
        const inputs = [...document.querySelectorAll('input')].map(r);
        return {
          plainItemField: !q('.kd-itemwrap') && !q('[data-clear]'),
          delRightOfItem: delBtn.left >= itemInput.right - 2,
          sameRowAsName: Math.abs(centerY(nameInput) - centerY(delBtn)) < 4,
          amountOutOfMeta: !!amountInput && !!meta && !meta.contains(amountInput),
          qtyInMeta: !!qtyNum && !!meta && meta.contains(qtyNum),
          badgePlainNumber: !!qtyNum && qtyNum.value === '2' && !q('.kd-qty-x'),
          noBadgeWhenEmpty: !qtyNum,
          ghostVisibleWhenEmpty: !!qtyAdd && r(qtyAdd).width > 0 && r(qtyAdd).height > 0,
          noHorizontalOverflow: document.documentElement.scrollWidth <= 362,
          allInputsVisible: inputs.every((rect) => rect.left >= -1 && rect.right <= 362)
        };
      });
      check(`[${label}] field Barang polos — tanpa × clear di baris daftar`, geo.plainItemField);
      check(`[${label}] hapus baris di kanan & sebaris nama pemberi`, geo.delRightOfItem && geo.sameRowAsName);
      check(`[${label}] di HP 360px: tanpa overflow horizontal`, geo.noHorizontalOverflow);
      check(`[${label}] di HP 360px: SEMUA input terlihat utuh`, geo.allInputsVisible);
      if (label === 'qty terisi') {
        check('[qty terisi] nominal Rp DI LUAR baris meta (baris terpisah)', geo.amountOutOfMeta);
        check('[qty terisi] badge ungu sebaris barang — angka polos tanpa ×', geo.qtyInMeta && geo.badgePlainNumber);
      } else {
        check('[qty kosong] TIDAK ada badge/input qty sama sekali', geo.noBadgeWhenEmpty);
        check('[qty kosong] tombol "+ qty" tampil dan bisa disentuh', geo.ghostVisibleWhenEmpty);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------
// 11) Format ribuan LANGSUNG saat diketik — fungsi ASLI diekstrak dari
//     kado.js lalu diuji: kasus murni formatAmountTyped + ketikan nyata
//     lewat event "input" pada elemen sungguhan.
// ---------------------------------------------------------------------
const fmtBlok = kadoSrc.match(/\/\* ==== Format jumlah: langsung terformat saat diketik ==== \*\/([\s\S]*?)\/\* ==== Akhir format jumlah ==== \*\//);
check('blok helper format-langsung ditemukan di kado.js', !!fmtBlok);

if (!failed && fmtBlok) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<input id="amt">');
    const hasil = await page.evaluate((src) => {
      const { formatAmountTyped, wireLiveFormat } = new Function(src + '\nreturn { formatAmountTyped, wireLiveFormat };')();
      const kasus = [
        // [isi field, posisi caret, teks diharapkan, caret diharapkan]
        ['1500000', 7, '1.500.000', 9],
        ['15000000', 8, '15.000.000', 10],
        ['1200', 4, '1.200', 5],
        ['', 0, '', 0],
        ['abc', 3, '', 0],
        ['250,5', 5, '250,5', 5],
        ['1.500.000', 5, '1.500.000', 5],
        ['12,.', 4, '12,', 3],
      ].map(([raw, caret, expText, expCaret]) => {
        const got = formatAmountTyped(raw, caret);
        return `${got.text === expText && got.caret === expCaret ? 'OK' : `GAGAL(${JSON.stringify(got)})`} ← "${raw}"`;
      });
      const input = document.getElementById('amt');
      wireLiveFormat(input);
      input.value = '7654321';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const setelah = input.value;
      // Hapus satu karakter di tengah: "1.500.000" backspace di ujung →
      // nilai turun jadi 150000 tetap terformat rapi.
      input.value = '1.500.000';
      input.setSelectionRange(9, 9);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { kasus, wired: setelah, backspace: input.value };
    }, fmtBlok[1]);
    for (const k of hasil.kasus) check(`formatAmountTyped ${k}`, k.startsWith('OK'));
    check('wireLiveFormat: isi "7654321" langsung jadi "7.654.321"', hasil.wired === '7.654.321');
    check('wireLiveFormat: nilai sudah terformat tidak berubah-ubah', hasil.backspace === '1.500.000');
  } finally {
    await browser.close();
  }
}

if (failed) { console.error('\nFAIL: kontrak kado & amplop panel belum terpenuhi.'); process.exit(1); }
console.log('\nPASS: kontrak kado & amplop — jumlah baris terpisah & live-format, badge qty kondisional, × clear hanya di modal, summary, export Excel.');
