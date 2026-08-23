/**
 * Kontrak fitur PIN per daftar (PanelListPin) untuk halaman Kontak &
 * Kado/Amplop — rencana quiet-folding-lynx:
 * - Migration 0027 menambah kolom pin_hash di contact_lists & gift_lists
 *   (nullable; hash SHA-256 hex dari browser, BUKAN plaintext).
 * - SATU modul bersama assets/js/panel/list-pin.js — kedua halaman
 *   memanggilnya, TIDAK menduplikasi logika gerbang/hash/localStorage.
 * - Status "sudah pernah unlock" di LOCALSTORAGE per tenant+jenis+daftar,
 *   nilainya selalu "1" (penanda lokal, bukan sumber kebenaran).
 * - Gerbang di handler [data-open] SEBELUM selectedListId diisi; daftar
 *   tanpa PIN tetap langsung terbuka (tanpa regresi).
 * - Ganti/Pasang/Hapus PIN dari dalam detail lewat changeDialog; PIN baru
 *   wajib 4–8 digit angka; edit daftar dengan field kosong JANGAN mengubah
 *   pin_hash lama.
 *
 * Fungsional: sumber modul ASLI dimuat ke browser tanpa kepala — alur
 * salah-PIN→benar→localStorage→buka-ulang-tanpa-PIN, ganti PIN (hash baru
 * tertulis), dan hapus PIN diverifikasi end-to-end.
 */
import fs from 'node:fs/promises';
import http from 'node:http';
import { chromium } from '@playwright/test';

let failed = false;
function check(label, pass) {
  if (pass) console.log(`PASS: ${label}`);
  else { console.error(`FAIL: ${label}`); failed = true; }
}

const pinSrc = await fs.readFile('assets/js/panel/list-pin.js', 'utf8');
const kontakSrc = await fs.readFile('assets/js/panel/pages/kontak.js', 'utf8');
const kadoSrc = await fs.readFile('assets/js/panel/pages/kado.js', 'utf8');
const adminHtml = await fs.readFile('admin.html', 'utf8');
const migrationSrc = await fs.readFile('supabase/migrations/0027_list_pin_hash.sql', 'utf8');
const panelCss = await fs.readFile('assets/css/panel.css', 'utf8');

// ---------------------------------------------------------------------
// 1) Migration 0027
// ---------------------------------------------------------------------
check('migration 0027: pin_hash text di contact_lists', migrationSrc.includes('alter table public.contact_lists add column if not exists pin_hash text;'));
check('migration 0027: pin_hash text di gift_lists', migrationSrc.includes('alter table public.gift_lists add column if not exists pin_hash text;'));

// ---------------------------------------------------------------------
// 2) Satu modul bersama — API lengkap, hash bukan plaintext
// ---------------------------------------------------------------------
check('admin.html memuat list-pin.js SEBELUM kontak.js & kado.js', adminHtml.indexOf('panel/list-pin.js') > -1 && adminHtml.indexOf('panel/list-pin.js') < adminHtml.indexOf('pages/kontak.js') && adminHtml.indexOf('panel/list-pin.js') < adminHtml.indexOf('pages/kado.js'));
for (const fn of ['gate', 'changeDialog', 'fieldHtml', 'readFieldHash', 'hashPin', 'parseNewPin']) {
  check(`modul mengekspor ${fn}`, new RegExp(`return \\{[^}]*\\b${fn}\\b`).test(pinSrc));
}
check('hash = SHA-256 via crypto.subtle.digest (bukan plaintext)', /crypto\.subtle\.digest\(\s*"SHA-256"/.test(pinSrc));
check('PIN baru validasi 4–8 digit angka', pinSrc.includes('new RegExp(`^\\\\d{${MIN_DIGIT},${MAX_DIGIT}}$`)') && pinSrc.includes('MIN_DIGIT = 4') && pinSrc.includes('MAX_DIGIT = 8'));
check('localStorage hanya penanda "1", kunci per slug+kind+listId', /wedding_listpin_\$\{slug\}_\$\{kind\}_\$\{listId\}/.test(pinSrc) && pinSrc.includes('setItem(key, "1")'));
check('ganti/hapus PIN membersihkan penanda unlock device', /removeItem\(lsKey\(kind, list\.id\)\)/.test(pinSrc));

// ---------------------------------------------------------------------
// 3) Integrasi kontak.js & kado.js — pola identik, tanpa duplikasi logika
// ---------------------------------------------------------------------
function cekIntegrasi(nama, src, prefix, kind, table) {
  check(`[${nama}] field PIN opsional disuntik ke modal daftar (${prefix}-list-pin)`, src.includes(`window.PanelListPin.fieldHtml("${prefix}-list-pin")`) && src.includes(`${prefix}-list-pin").value = "";`));
  check(`[${nama}] Simpan daftar lewat readFieldHash; kosong = JANGAN ubah pin_hash`, src.includes(`window.PanelListPin.readFieldHash("${prefix}-list-pin")`) && src.includes('if (pinRes.hash) patch.pin_hash = pinRes.hash;'));
  check(`[${nama}] insert daftar menyimpan HASH (pinRes.hash || null), bukan teks`, src.includes(`pin_hash: pinRes.hash || null`));
  const gateIdx = src.indexOf('window.PanelListPin.gate({ kind:');
  const setIdIdx = src.indexOf('st.selectedListId = list.id;');
  check(`[${nama}] gerbang gate() di [data-open] SEBELUM selectedListId diisi`, gateIdx > -1 && setIdIdx > gateIdx && src.includes(`gate({ kind: "${kind}", list })`));
  check(`[${nama}] tombol Ganti/Pasang PIN dinamis di detail`, src.includes('${list.pin_hash ? "Ganti PIN" : "Pasang PIN"}') || src.includes('${list.pin_hash ? \'Ganti PIN\' : \'Pasang PIN\'}'));
  check(`[${nama}] changeDialog terhubung ke tabel ${table} lalu render ulang`, src.includes(`window.PanelListPin.changeDialog({ kind: "${kind}", table: "${table}", list, api: window.AdminAPI })`));
}
cekIntegrasi('kontak', kontakSrc, 'kt', 'kontak', 'contact_lists');
cekIntegrasi('kado', kadoSrc, 'kd', 'kado', 'gift_lists');
check('tidak ada logika gerbang PIN yang ditulis ulang di halaman (hanya lewat modul)', !kontakSrc.includes('crypto.subtle') && !kadoSrc.includes('crypto.subtle') && !kontakSrc.includes('wedding_listpin_') && !kadoSrc.includes('wedding_listpin_'));

// ---------------------------------------------------------------------
// 4) CSS util overlay PIN pakai token panel (kontrak: tanpa hex liar)
// ---------------------------------------------------------------------
check('CSS .lp-error & .lp-actions tersedia untuk overlay modul', /\.lp-error\s*\{[^}]*color:\s*var\(--p-danger\)/.test(panelCss.replace(/\n/g, ' ').replace(/\s+/g, ' ')) && /\.lp-actions\s*\{[^}]*display:\s*flex/.test(panelCss.replace(/\n/g, ' ').replace(/\s+/g, ' ')));

// ---------------------------------------------------------------------
// 5) Fungsional end-to-end modul ASLI di browser tanpa kepala
// ---------------------------------------------------------------------
if (!failed) {
  // Vektor dikenal: SHA-256("1234")
  const SHA1234 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  // crypto.subtle hanya ada di secure context — about:blank (setContent)
  // tidak termasuk, jadi modul disajikan via http://127.0.0.1 (trustworthy)
  // dengan server mini port-acak milik test ini sendiri.
  const server = http.createServer((req, res) => {
    if (req.url === '/list-pin.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end(pinSrc);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>lp</title><script src="/list-pin.js"></script>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const hasil = await page.evaluate(async ({ SHA1234 }) => {
      const LP = window.PanelListPin;
      const out = {};

      out.hashVektorDikenal = (await LP.hashPin('1234')) === SHA1234;

      const kasus = [['', null], ['12', false], ['123456789', false], ['abcd', false], ['1234', '1234'], ['0042', '0042']]
        .map(([raw, want]) => {
          const got = LP.parseNewPin(raw);
          if (want === false) return !got.error ? `GAGAL(diterima:"${raw}")` : 'OK';
          return got.value === want ? 'OK' : `GAGAL(${JSON.stringify(got)})`;
        });
      out.parseNewPin = kasus.every((k) => k.startsWith('OK')) ? 'OK' : kasus.join('; ');

      // Daftar tanpa PIN: langsung terbuka, tanpa overlay.
      const sebelumOverlay = document.querySelectorAll('.p-modal').length;
      const tanpaPin = await LP.gate({ kind: 'kado', list: { id: 1, name: 'Bebas' } });
      out.tanpaPinLangsungBuka = tanpaPin === true && document.querySelectorAll('.p-modal').length === sebelumOverlay;

      // Daftar ber-PIN: salah → tetap terkunci; benar → resolve + localStorage.
      const rahasia = { id: 9, name: 'Amplop Pria', pin_hash: SHA1234 };
      let gatePertama = null;
      const p1 = LP.gate({ kind: 'kado', list: rahasia }).then((v) => { gatePertama = v; });
      await new Promise((r) => setTimeout(r, 50)); // tunggu overlay terpasang
      const overlayAda = !!document.querySelector('.p-modal .lp-pin-input');
      const input = document.querySelector('.lp-pin-input');
      input.value = '9999';
      document.querySelector('[data-lp-ok]').click();
      await new Promise((r) => setTimeout(r, 50));
      const masihTerkunci = gatePertama === null && !!document.querySelector('.lp-error:not([hidden])');
      input.value = '1234';
      document.querySelector('[data-lp-ok]').click();
      await p1;
      const key9 = localStorage.getItem('wedding_listpin_root_kado_9');
      out.alurSalahBenar = overlayAda && masihTerkunci && gatePertama === true && key9 === '1' && !document.querySelector('.p-modal');

      // Buka lagi di device yang sama: tidak diminta PIN (tak ada overlay).
      let gateKedua = null;
      const p2 = LP.gate({ kind: 'kado', list: rahasia }).then((v) => { gateKedua = v; });
      await p2;
      out.bukaUlangTanpaPin = gateKedua === true && !document.querySelector('.p-modal');

      // Ganti PIN: verifikasi PIN lama → hash BARU tertulis ke DB (patch),
      // list.termutasi, penanda unlock dibersihkan.
      const cap = {};
      const apiFake = {
        tenant: { invitationId: 7 },
        toast: () => {},
        query: async () => ({ error: null }),
        sb: { from: () => ({
          update(patch) { cap.patch = patch; return this; },
          eq() { return this; },
          then(res) { return res({ error: null }); }
        }) }
      };
      localStorage.setItem('wedding_listpin_root_kado_10', '1');
      const daftar10 = { id: 10, name: 'Amplop Wanita', pin_hash: SHA1234 };
      const p3 = LP.changeDialog({ kind: 'kado', table: 'gift_lists', list: daftar10, api: apiFake });
      await new Promise((r) => setTimeout(r, 50));
      document.querySelector('[data-lp-old]').value = 'WRONG';
      document.querySelector('[data-lp-new]').value = '5678';
      document.querySelector('[data-lp-save]').click();
      await new Promise((r) => setTimeout(r, 50));
      const tolakPinLama = cap.patch === undefined && !!document.querySelector('[data-lp-error]:not([hidden])');
      document.querySelector('[data-lp-old]').value = '1234';
      document.querySelector('[data-lp-save]').click();
      const berubah = await p3;
      const sha5678 = await LP.hashPin('5678');
      out.gantiPin = tolakPinLama && berubah === true
        && cap.patch && cap.patch.pin_hash === sha5678
        && daftar10.pin_hash === sha5678
        && localStorage.getItem('wedding_listpin_root_kado_10') === null;

      // Hapus PIN: konfirmasi OK → pin_hash null di DB & di objek.
      window.confirm = () => true;
      const daftar11 = { id: 11, name: 'Kontak Keluarga', pin_hash: SHA1234 };
      const p4 = LP.changeDialog({ kind: 'kontak', table: 'contact_lists', list: daftar11, api: apiFake });
      await new Promise((r) => setTimeout(r, 50));
      document.querySelector('[data-lp-old]').value = '1234';
      document.querySelector('[data-lp-remove]').click();
      const hilang = await p4;
      out.hapusPin = hilang === true && cap.patch.pin_hash === null && daftar11.pin_hash === null;

      return out;
    }, { SHA1234 });

    check('hashPin: SHA-256("1234") cocok vektor dikenal', hasil.hashVektorDikenal);
    check('parseNewPin: kosong→null, <4/>8/non-digit ditolak', hasil.parseNewPin === 'OK');
    check('gate: daftar tanpa PIN langsung terbuka tanpa overlay', hasil.tanpaPinLangsungBuka);
    check('gate: salah → tetap terkunci + pesan; benar → masuk + localStorage "1"', hasil.alurSalahBenar);
    check('gate: buka ulang di device sama TIDAK minta PIN lagi', hasil.bukaUlangTanpaPin);
    check('changeDialog: PIN lama salah ditolak; benar → hash baru tersimpan & flag dibersihkan', hasil.gantiPin);
    check('changeDialog: Hapus PIN → pin_hash null di DB & objek', hasil.hapusPin);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

if (failed) { console.error('\nFAIL: kontrak PIN per daftar belum terpenuhi.'); process.exit(1); }
console.log('\nPASS: PIN per daftar — modul bersama Kontak & Kado/Amplop, hash SHA-256 di DB, unlock di localStorage, ganti/hapus PIN.');
