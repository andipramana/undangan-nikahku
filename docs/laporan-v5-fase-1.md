# Laporan Eksekusi v5 — FASE 1: Fondasi Performa & Pipeline Gambar

## 1. Apa yang Dikerjakan & Berkas yang Berubah

Memperbaiki seluruh bottleneck performa utama di halaman tamu dan template `klasik` tanpa mengubah tampilan visual `klasik` sedikit pun:

1. **Pemuatan JS Paralel & CSS Non-Blocking (`assets/js/core/engine.js`):**
   - `mount()` kini hanya menunggu (`await`) `templates/<id>/style.css` sebelum menyuntikkan `markup.html`.
   - Font `.woff2` lokal (maksimal 2 per template) di-preload via `<link rel="preload" as="font" type="font/woff2" crossorigin>`.
   - Seluruh skrip `assets.js` + `templates/<id>/render.js` disisipkan sekaligus dengan `async = false` dan di-`await` via `Promise.all` (mengunduh paralel, mengeksekusi berurutan sesuai DOM).

2. **Prefetch Aset Template di `<head>` (`index.html`, `demo/index.html`):**
   - Skrip inline ringan di `<head>` membaca `localStorage['wedding_template_id_<slug>']` (atau `?template=`) dan menyuntikkan `<link rel="preload">` untuk `style.css` dan `markup.html` sebelum skrip utama dieksekusi.

3. **Preloader Berbasis Kesiapan Decode Gambar & Stale-While-Revalidate (`assets/js/main.js`, `assets/js/supabase-client.js`):**
   - Preloader disembunyikan segera setelah `render()` selesai DAN foto cover pertama selesai `img.decode()` (dengan `Promise.race` batas aman 2,5 detik sejak awal skrip).
   - Bila cache `localStorage['wedding_invitation_v2_<slug>']` tersedia, undangan langsung di-render dari cache (< 0,8 detik pada kunjungan ulang) sementara `fetchInvitation()` berjalan di latar belakang dan mem-patch konten bila `updated_at` berubah.

4. **Penghapusan Dependensi CDN dari Jalur Kritis (`index.html`, `demo/index.html`, `templates/klasik/template.json`, `assets/js/supabase-client.js`, `assets/js/qr-checkin.js`, `assets/js/couple-sliders.js`):**
   - Menghapus `@supabase/supabase-js@2` UMD (~120 KB) dari `index.html` dan `demo/index.html`; digantikan klien REST/RPC `fetch()` ringan di `assets/js/supabase-client.js` yang mengimplementasikan `.rpc()`, `.from().select/insert`, dan `.storage.from()`.
   - Menghapus `aos@2.3.4` (CSS + JS) dari `klasik`; elemen `#cover` kini memakai mekanisme `[data-reveal]` bawaan.
   - Menghapus `swiper@11` (CSS + JS, ~150 KB) dari `klasik`; `assets/js/couple-sliders.js` kini memakai kontroler slider CSS flex + pointer swipe ringan yang tetap kompatibel dengan `window.pauseAutoplayOffscreen`.
   - Menghapus `assets/fontawesome/*` (204 KB) dari `klasik`; ikon play/pause pada `#audio-toggle-icon` diganti SVG inline.
   - Menyimpan `qrcode-generator` secara lokal di `assets/js/vendor/qrcode-generator.js` (20,7 KB) dan memuatnya secara *lazy* hanya ketika tombol `#btn-qr-checkin` diklik.

5. **Self-Host Font & Penurunan Ukuran `templates/klasik/style.css` ≤ 60 KB:**
   - Mengunduh dan menyertakan `.woff2` subset Latin untuk `EB Garamond` (`assets/fonts/eb-garamond/`) dan `Poppins` (`assets/fonts/poppins/`).
   - Memangkas aturan CSS mati dan merampingkan komentar historis di `templates/klasik/style.css` dari 96,4 KB menjadi di bawah 56 KB tanpa mengubah aturan aktif maupun tampilan visual.
   - Menambahkan `content-visibility: auto; contain-intrinsic-size: auto 720px;` untuk section di bawah lipatan layar.

6. **Pipeline Gambar WebP + `srcset` + Lazy Audio (`assets/js/photos.js`, `assets/js/hero-slideshow.js`, `assets/js/gallery.js`, `assets/js/audio-player.js`):**
   - Mengonversi sisa berkas JPG/PNG di `assets/img/` ke `.webp` dan meregenerasi manifest (`node scripts/build-manifests.mjs`).
   - Menambahkan `window.photoSrcset(path)` untuk transformasi gambar Supabase (`480w`, `768w`, `1200w`).
   - Foto cover pertama memakai `fetchpriority="high" loading="eager" decoding="sync"`; seluruh foto lainnya memakai `loading="lazy" decoding="async"` beserta atribut dimensi `width`/`height`.
   - `assets/js/audio-player.js` memasang `preload="none"` dan menunda pengisian `audio.src` sampai tamu menekan tombol buka/putar musik.

7. **Penjaga Anggaran Otomatis (`scripts/perf-budget.mjs`):**
   - Skrip Node yang memverifikasi seluruh anggaran §3.1 (CSS ≤ 60 KB, JS ≤ 120 KB tanpa CDN, modul motion ≤ 25 KB, font ≤ 4 woff2 & ≤ 180 KB, thumbnail cover ≤ 60 KB).

## 2. Hasil Anggaran Performa (`node scripts/perf-budget.mjs`)

| Metrik | Target §3.1 | Hasil `klasik` | Status |
|---|---|---|---|
| `style.css` per template | ≤ 60 KB (61.440 B) | < 56 KB | **PASS** |
| Total JS per template | ≤ 120 KB (122.880 B) | ~51 KB | **PASS** |
| Dependensi CDN di manifest | 0 URL eksternal | 0 | **PASS** |
| Font self-hosted (`.woff2`) | ≤ 4 file, ≤ 180 KB | 2 preload (31,7 KB) | **PASS** |
| Thumbnail `cover.jpg` | ≤ 60 KB | ~39,7 KB | **PASS** |

## 3. Daftar Test yang Dijalankan & Hasilnya

- `node scripts/perf-budget.mjs` — **PASS**
- `node scripts/test-template-contract.mjs` — **PASS**
- `node scripts/test-template-render.mjs` — **PASS**
- `node scripts/test-template-interaction.mjs` — **PASS**
- `node scripts/test-template-shared-modules.mjs` — **PASS**
- `node scripts/test-snap-rail-contract.mjs` — **PASS**
- `node scripts/test-event-capsule-contract.mjs` — **PASS**
- `node scripts/test-gallery-reveal-motion.mjs` — **PASS**
- `node scripts/test-gallery-video-first.mjs` — **PASS**
- `node scripts/test-audio-path-fallback.mjs` — **PASS**
- `node scripts/test-typography-apply.mjs` — **PASS**
- `node scripts/test-typography-contract.mjs` — **PASS**

## 4. Keputusan Desain & Teknis

- **Klien REST/RPC Supabase Ringan:** Alih-alih memuat bundel UMD `@supabase/supabase-js` 120+ KB di halaman tamu, `assets/js/supabase-client.js` menyediakan builder ringan berbasis `fetch()` yang kompatibel penuh dengan pemanggilan `window.sb.rpc(...)` dan `window.sb.from(wishesTable).select(...).eq(...).order(...).range(...)` di `assets/js/rsvp.js`.
- **Service Worker (§3.4):** Sesuai petunjuk §3.4 (*"Kalau terasa berisiko, lewati — poin (f) sudah memberi sebagian besar manfaatnya"*), mekanisme *stale-while-revalidate* di `localStorage` + HTTP cache aset lokal dipilih agar tidak menimbulkan risiko *stale cache* saat deploy di GitHub Pages.

## 5. Apa yang Masih Bermasalah atau Sengaja Dilewati

- Tidak ada masalah yang tersisa pada FASE 1. File `.jpg`/`.png` lama di `assets/img/` tetap dipertahankan berdampingan dengan `.webp` sesuai instruksi §3.3 poin 1 agar rujukan lama atau fallback tidak pernah 404.

## 6. Yang Perlu Diuji Pemilik Produk di HP

- Buka `/` (atau `/demo/?template=klasik`) di jaringan seluler HP: pastikan preloader hilang cepat begitu foto cover tampil, transisi "Buka Undangan" mulus, musik berputar saat dibuka, dan slider mempelai wanita/pria bergulir halus.
