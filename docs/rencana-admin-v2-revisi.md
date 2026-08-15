# Revisi Admin Panel v2 — Putaran 1

> Lanjutan dari `docs/rencana-admin-v2.md`, yang eksekusinya sudah selesai
> (commit `4e4964c` … `cce8d83`). Dokumen ini hanya berisi **sisa pekerjaan**
> hasil review. Kerjakan berurutan; commit terpisah per bagian.

## Status yang sudah diverifikasi BENAR — jangan diutak-atik lagi

- `node scripts/test-admin-v2-contract.mjs` lolos.
- `npm run build:pages` lolos (30 file runtime wajib).
- 15 dari 17 skrip test offline lolos.
- Dua yang gagal (`test-admin-panels-browser.mjs`, `test-photo-layout-browser.mjs`)
  **sudah gagal sejak sebelum rewrite** — diverifikasi dengan menjalankannya di
  worktree pada commit `5b32bb3`. Bukan regresi rewrite, tapi tetap harus
  dibereskan di R4 di bawah.
- Satu pintu simpan terjaga: tidak ada `.upsert("site_content")` di `pages/*.js`.
- Jalur peran `admin_qr` (hanya key `livestream`) masih ada di `core.js`.
- Publish/`content_updated_at`/`get_invitation_draft` ter-wire di `router.js`.
- Target sentuh 44px dan `font-size:16px` pada input sudah dipenuhi.

---

## R1 — `qrCheckin.enabled` kehilangan UI (REGRESI — prioritas tertinggi)

**Masalah.** Di admin lama ada toggle *"Tampilkan tombol QR check-in ke tamu"*
(tab Teks → Lainnya, commit `8a86546`). Di v2, "Check-in QR" jadi tautan biasa
ke `admin-qr.html`, bukan halaman panel — sehingga toggle itu tidak punya rumah.
Sekarang `qrCheckin.enabled` hanya muncul sebagai default di
`assets/js/panel/store.js:65-66`; **tidak ada satu pun UI yang bisa mengubahnya.**
Pemilik jadi kehilangan kendali atas fitur yang dia minta sendiri.

**Perbaikan.**

1. Tambahkan switch `qrCheckin.enabled` ke `assets/js/panel/pages/pengaturan.js`
   dalam kartu tersendiri berjudul **"Check-in QR"**, memakai komponen
   `.p-switch` yang sudah ada. Label: *"Tampilkan tombol QR check-in ke tamu"*.
   Teks bantuan: jelaskan bahwa tombol melayang ini hanya muncul untuk tamu
   perorangan (tautan ber-`?to=`), dan matikan kalau acara tidak memakai
   check-in QR.
2. Simpan lewat `PanelStore` seperti field lain di halaman itu (satu pintu).
3. Di kartu yang sama, beri tautan sekunder ke `admin-qr.html` supaya alurnya
   nyambung.

**Tutup lubangnya juga:** contract test tidak menangkap ini karena `qrCheckin`
tidak ada di daftar field yang diperiksa. Tambahkan `qrCheckin.enabled` ke
daftar field di `scripts/test-admin-v2-contract.mjs`, lalu pastikan test gagal
kalau UI-nya dihapus (uji sendiri dengan mengomentari sementara).

---

## R2 — `assets/css/admin.css` (tema gelap) masih hidup

**Masalah.** Rencana §6.1 meminta `admin.css` dihapus. Nyatanya masih dipakai
`admin-qr.html` dan `register.html`, jadi menghapusnya begitu saja akan merusak
kedua halaman itu — keputusan mempertahankannya sudah benar secara teknis.
Tapi akibatnya: dua halaman itu **tetap gelap sendirian** sementara seluruh
admin sudah terang, dan "tanpa sisa kode admin lama" belum tercapai.

**Perbaikan.**

1. Pindahkan `admin-qr.html` dan `register.html` ke `assets/css/panel.css`
   (pakai token dan komponen `.p-*` yang sudah ada — jangan bikin token baru).
   Keduanya halaman kecil (118 baris dan satu baris `<head>` panjang), jadi ini
   penyesuaian kelas + sedikit markup, bukan tulis ulang.
   - `admin-qr.html`: pertahankan seluruh fungsi pemindai (`jsQR`, kamera,
     daftar check-in). Yang berubah hanya kulitnya.
   - `register.html`: form provisioning root-owner, ikut disamakan.
2. Setelah keduanya terang dan berfungsi, **hapus `assets/css/admin.css`**.
3. Perbarui semua yang merujuknya, kalau tidak build/test akan pecah:
   - `scripts/build-pages-dist.mjs` dan `scripts/build-pages-dist-safe.mjs`
     (daftar `required`)
   - `scripts/test-pages-dist.mjs` (`runtimeAssets`)
   - `scripts/test-client-management-contract.mjs`
   - `scripts/test-gallery-admin-widths.mjs`
   - `scripts/test-visual-editor-bottom-safe-space.mjs`
   - `scripts/test-photo-layout-browser.mjs` (lihat juga R4)
   Untuk skrip test, arahkan ke `assets/css/panel.css` **dan sesuaikan
   selector/assertion-nya ke kelas `.p-*` yang baru** — jangan cuma ganti nama
   file lalu membiarkan assertion lama yang pasti gagal.

---

## R3 — Pulihkan cakupan test yang hilang

**Masalah.** Commit `f9977cc` menghapus **11** skrip test. `CLAUDE.md` hanya
menjelaskan 3 di antaranya (yang visual-editor). Sebagian yang lain menguji
perilaku yang **masih ada** di v2, jadi sekarang perilaku itu tidak terjaga sama
sekali — padahal ini justru bagian yang paling mudah rusak diam-diam.

**Yang memang layak hilang** (jangan dibuat ulang — konsepnya sudah tidak ada):
- `test-section-nav-no-gift-recs.mjs` — FAB lompat-section sudah digantikan
  halaman terpisah.
- `test-admin-completion-contract.mjs` — digantikan `test-admin-v2-contract.mjs`.
- `test-visual-editor-live-frame.mjs`, `test-visual-editor-static-preview.mjs`,
  `test-visual-editor-section-switch.mjs` — sudah stale sebelum rewrite.

**Yang WAJIB dibuat ulang** menargetkan file panel baru. Ikuti pola skrip yang
ada (Node polos, `node scripts/test-<nama>.mjs`, tanpa runner):

| Skrip baru | Menggantikan | Menguji |
|---|---|---|
| `test-panel-photo-editor.mjs` | `test-photo-editor-zoom-pan.mjs` | matematika pan/zoom + rasio bingkai per folder di `assets/js/panel/photos.js` |
| `test-panel-photo-layout.mjs` | `test-photo-layout-contract.mjs`, `test-gallery-admin-widths.mjs` | lebar/baris galeri di panel konsisten dengan `assets/js/gallery-layout.js` yang dipakai halaman tamu |
| `test-panel-font-page.mjs` | `test-font-panel-browser.mjs` | 7 grup elemen tipografi lengkap di `pages/font.js` |
| `test-panel-wishes.mjs` | `test-wish-block-list.mjs`, `test-wish-toolbar-layout.mjs` | daftar blokir + toolbar/ekspor di `pages/ucapan.js` |
| `test-panel-visual-editor.mjs` | `test-visual-editor-core.mjs` | registry/override inti di `pages/editor-visual.js` + `assets/js/visual-editor/registry.js` |

Cek statis sudah cukup kalau perilakunya memang bisa diperiksa dari sumber;
pakai Playwright `page.setContent(...)` mandiri hanya kalau benar-benar perlu
geometri nyata (pola ini sudah dipakai skrip lain di repo — **tidak** butuh
server).

---

## R4 — Dua test yang sudah rusak sejak sebelum rewrite

Keduanya menguji struktur admin **lama**, jadi sekarang menyesatkan.

1. `scripts/test-admin-panels-browser.mjs` — mengharapkan `<details>` konfigurasi
   WA di dalam `admin.html`. Blok itu sekarang milik `wa.html`. Arahkan test ke
   `wa.html`, atau hapus kalau ternyata `test-wa-*` yang sudah ada sudah
   mencakupnya (periksa dulu, jangan langsung hapus).
2. `scripts/test-photo-layout-browser.mjs` — membaca `assets/css/admin.css` dan
   mencocokkan geometri kartu foto admin dengan slot galeri tamu. Rasio `full`
   dan `half` sudah tidak cocok. Tulis ulang menargetkan `panel.css` +
   `panel/photos.js`; ini boleh digabung dengan `test-panel-photo-layout.mjs`
   di R3 daripada dipertahankan terpisah.

Setelah R4 selesai, **seluruh** skrip test offline harus lolos. Itu ukurannya.

---

## R5 — Buktikan kontras WCAG, jangan diasumsikan

DoD menuntut kontras terverifikasi. Sekarang tidak ada yang membuktikannya.

Tambahkan ke `scripts/test-admin-v2-contract.mjs`: parse token warna dari blok
`:root` `panel.css`, hitung rasio kontras (WCAG 2.x relative luminance), lalu
tegaskan minimal:

- `--p-ink`, `--p-ink-2`, `--p-ink-3` di atas `--p-paper` **dan** `--p-canvas`
  ≥ **4.5:1**
- putih di atas `--p-accent`, `--p-ok`, `--p-warn`, `--p-danger`, `--p-info`
  ≥ **4.5:1**
- `--p-line` di atas `--p-paper` ≥ **3:1** (batas komponen UI)

Kalau ada token yang tidak lolos, **perbaiki nilainya**, jangan turunkan ambang
batasnya.

---

## Definition of Done putaran ini

- [ ] Toggle QR check-in bisa diubah dari Pengaturan dan tersimpan; contract test
      menjaganya.
- [ ] `assets/css/admin.css` terhapus; `admin-qr.html` dan `register.html` terang
      dan masih berfungsi penuh; semua rujukan diperbarui.
- [ ] 5 skrip test pengganti di R3 dibuat dan lolos.
- [ ] **Semua** skrip test offline lolos (tidak ada lagi kegagalan yang
      diwariskan) — buktikan dengan menjalankan seluruh `scripts/test-*.mjs`
      kecuali yang butuh `localhost:4173`.
- [ ] Assertion kontras ada dan lolos.
- [ ] `npm run build:pages` lolos.
- [ ] `CLAUDE.md` diperbarui: daftar test yang dihapus vs yang dibuat ulang
      sekarang akurat (sekarang hanya menyebut 3 dari 11).

## Catatan

- Jangan sentuh halaman tamu, migration, atau Edge Function.
- Jangan jalankan Playwright/screenshot/cloudflared sebagai pengganti verifikasi
  pemilik — dia menguji sendiri di ponsel. Skrip test mandiri tetap boleh.
- Commit bertahap per bagian R1…R5.
