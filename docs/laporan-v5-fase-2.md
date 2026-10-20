# Laporan Eksekusi v5 — FASE 2: Toolkit Motion Bersama

## 1. Apa yang Dikerjakan & Berkas yang Dibuat

Pada Fase 2 ini dibangun toolkit motion bersama berbasis vanilla JavaScript (plain ES5/ES6 IIFE terlampir ke objek `window`, tanpa bundler/compiler) di dalam direktori `assets/js/motion/`. Toolkit ini menyediakan fondasi animasi performan tinggi, hemat memori, dan aksesibel untuk seluruh template undangan pernikahan digital.

### Berkas yang dibuat:
1. `assets/js/motion/scroll-scene.js` (4.623 bytes / batas <= 6.000 bytes)
   - Plain IIFE mengekspos `window.MotionScrollScene` dan `window.initScrollScenes`.
   - Menggunakan satu loop `requestAnimationFrame` global dengan listener `scroll` berkategori `{ passive: true }` pada `.app-frame__scroll` dan `window`.
   - Menghitung progres posisi `0 -> 1` terhadap viewport/scroller, mengontrol atribut deklaratif `[data-scroll-scene]`, `[data-parallax-speed]` (`transform: translate3d(0, ..., 0)`), dan `[data-scroll-mask]` (`--scroll-progress`).
   - Mengaktifkan `will-change: transform` hanya saat elemen terlihat/aktif di layar dan mematikan kembali (`will-change: auto`) saat elemen selesai atau berada di luar viewport.

2. `assets/js/motion/reveal.js` (4.968 bytes / batas <= 8.000 bytes)
   - Pewaris kompatibel penuh terhadap `assets/js/reveal.js`. Mempertahankan API publik `window.initReveal`, `window.revealScan`, `window.revealNow`, `window.refreshReveal`, class `html.reveal-ready`, serta atribut `data-reveal`, `data-reveal-group`, `data-reveal-early`, `data-count`, dan class `.is-revealed`.
   - Menambahkan dukungan varian baru: `mask-wipe`, `clip-up`, `clip-left`, dan `char-stagger` (terintegrasi dengan `window.MotionSplitText`).
   - Mengaktifkan `will-change: transform, opacity` sesaat sebelum elemen direveal dan membersihkannya (`willChange = ""`) saat event `transitionend` ditembakkan.

3. `assets/js/motion/split-text.js` (1.476 bytes / batas <= 3.000 bytes)
   - Plain IIFE mengekspos `window.MotionSplitText = { split(el, mode), init(root) }`.
   - Memecah teks elemen `[data-split-text]` menjadi deretan `<span class="char" aria-hidden="true" style="--char-i:...">` menggunakan `document.createElement` murni (tanpa `.innerHTML`).
   - Aksesibilitas terjamin: memasang `aria-label="teks-asli"` pada elemen induk sebelum teks dipecah, dan menandai pecahan karakter dengan `aria-hidden="true"`.

4. `assets/js/motion/drag.js` (5.666 bytes / batas <= 7.000 bytes)
   - Plain IIFE mengekspos `window.MotionDrag = { bind(el, opts), initDeck(container, opts) }`.
   - Gestur seret / lempeng (swipe/fling) berbasis Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) dengan inersia halus berbasis `transform: translate3d(...) rotate(...)`.
   - Memasang `el.style.touchAction = "pan-y"` untuk menjamin halaman tidak pernah mengalami scroll-jacking vertikal.
   - Mengaktifkan `will-change: transform` saat gestur seret dimulai dan menghapusnya saat inersia/snap selesai.

5. `assets/js/motion/tilt.js` (2.899 bytes / batas <= 3.000 bytes)
   - Plain IIFE mengekspos `window.MotionTilt = { bind(el, opts), init(root), requestGyroPermission() }`.
   - Merespons interaksi kursor mouse (`pointermove`) serta sensor giroskop (`deviceorientation`) untuk memperbarui CSS variables `--tilt-x`, `--tilt-y` atau translasi layer `[data-tilt-layer]`.
   - Memiliki pengecekan aman `DeviceOrientationEvent.requestPermission` khusus perangkat iOS / WebKit yang hanya dipanggil atas izin gestur pengguna dan diam-diam nonaktif (`catch`) bila ditolak.

6. `assets/js/motion/particles.js` (5.851 bytes / batas <= 6.000 bytes)
   - Plain IIFE mengekspos `window.MotionParticles = { start(canvasOrContainer, opts), burst(x, y, opts) }`.
   - Menggambar partikel ringan (kelopak bunga, debu cahaya, confetti emas) menggunakan HTML5 `<canvas>`.
   - Batas jumlah partikel adaptif perangkat: memeriksa `navigator.hardwareConcurrency` dan media query mobile `max-width: 480px` (maksimal 18 partikel pada mobile / low-core, maksimal 35 partikel pada desktop).
   - Penghematan baterai dan resource: berhenti total saat tab di latar belakang (`visibilitychange`) serta saat elemen berada di luar layar (`IntersectionObserver`).

7. `assets/js/motion/counter.js` (1.829 bytes / batas <= 2.000 bytes)
   - Plain IIFE mengekspos `window.MotionCounter = { animate(el, opts), init(root) }`.
   - Menghitung naik angka pada elemen `[data-count]` atau `[data-counter]` menggunakan kurva easing cubic lewat `requestAnimationFrame`.

8. `scripts/test-motion-contract.mjs`
   - Test suite Node statis untuk memvalidasi batas ukuran berkas, ketiadaan `.innerHTML =`, guard reduced-motion, passive scroll listeners, gyroscope permission guard, guard lifecycle partikel, dan atribut aksesibilitas split-text.

9. `scripts/test-motion-reduced.mjs`
   - Test suite E2E Playwright berbasis konteks reduced motion (`reducedMotion: 'reduce'`) untuk memastikan seluruh elemen langsung tampil utuh (`opacity: 1`, teks dan angka target utuh) tanpa tertahan animasi.

---

## 2. Kepatuhan Anggaran Ukuran Berkas

| Berkas Motion | Ukuran Riil | Batas Maksimal | Status |
| :--- | :--- | :--- | :--- |
| `assets/js/motion/scroll-scene.js` | 4.623 bytes | 6.000 bytes | **MEMENUHI** |
| `assets/js/motion/reveal.js` | 4.968 bytes | 8.000 bytes | **MEMENUHI** |
| `assets/js/motion/split-text.js` | 1.476 bytes | 3.000 bytes | **MEMENUHI** |
| `assets/js/motion/drag.js` | 5.666 bytes | 7.000 bytes | **MEMENUHI** |
| `assets/js/motion/tilt.js` | 2.899 bytes | 3.000 bytes | **MEMENUHI** |
| `assets/js/motion/particles.js` | 5.851 bytes | 6.000 bytes | **MEMENUHI** |
| `assets/js/motion/counter.js` | 1.829 bytes | 2.000 bytes | **MEMENUHI** |
| **Total Seluruh Toolkit** | **27.312 bytes** | **35.000 bytes** | **HEMAT (~22% di bawah batas gabungan)** |

---

## 3. Kepatuhan 7 Aturan Rekayasa Motion

1. **Batas Ukuran Bytes**: Ketujuh berkas berada di bawah batas ketat masing-masing tanpa kompresi minifier tambahan.
2. **Ketiadaan `.innerHTML =`**: Seluruh modul memanipulasi DOM menggunakan `document.createElement`, `appendChild`, `classList`, atau `style.setProperty` — tidak ada celah XSS dan tidak ada parsing HTML berulang.
3. **Guard `prefers-reduced-motion: reduce`**: Ketujuh berkas mengecek kriteria preferensi gerak pengguna. Jika reduced-motion aktif, animasi dinonaktifkan seketika, elemen langsung direveal, teks tidak dimutasi terpotong, dan loop rAF tidak dijalankan.
4. **Listener Scroll Pasif (`{ passive: true }`)**: Seluruh listener event scroll dipasang dengan opsi `{ passive: true }` untuk mencegah pemblokiran scroll pada thread utama browser.
5. **Guard Izin Sensor Giroskop**: `tilt.js` memverifikasi `DeviceOrientationEvent.requestPermission` secara selektif sebelum mengakses sensor perangkat.
6. **Guard Siklus Hidup Partikel**: `particles.js` mematikan loop canvas saat `document.hidden` dan memantau visibilitas kanvas lewat `IntersectionObserver`, serta membatasi partikel berdasarkan `hardwareConcurrency`.
7. **Aksesibilitas Tipografi**: `split-text.js` menyematkan `aria-label` berisi kalimat asli pada kontainer induk dan menandai span karakter dengan `aria-hidden="true"` sehingga pembaca layar (screen reader) membaca kata dengan lancar.

---

## 4. Hasil Verifikasi Test Suite

### A. Test Kontrak Motion (`scripts/test-motion-contract.mjs`)
```
=== MEMULAI TEST KONTRAK TOOLKIT MOTION ===

1. Memeriksa keberadaan file dan batas ukuran bytes...
  ✓ scroll-scene.js: 4623 bytes (batas <= 6000 bytes)
  ✓ reveal.js: 4968 bytes (batas <= 8000 bytes)
  ✓ split-text.js: 1476 bytes (batas <= 3000 bytes)
  ✓ drag.js: 5666 bytes (batas <= 7000 bytes)
  ✓ tilt.js: 2899 bytes (batas <= 3000 bytes)
  ✓ particles.js: 5851 bytes (batas <= 6000 bytes)
  ✓ counter.js: 1829 bytes (batas <= 2000 bytes)

2. Memeriksa ketiadaan innerHTML = ...
  ✓ Ketiadaan .innerHTML = lolos pada seluruh file

3. Memeriksa guard prefers-reduced-motion...
  ✓ scroll-scene.js memiliki guard prefers-reduced-motion
  ✓ reveal.js memiliki guard prefers-reduced-motion
  ✓ split-text.js memiliki guard prefers-reduced-motion
  ✓ drag.js memiliki guard prefers-reduced-motion
  ✓ tilt.js memiliki guard prefers-reduced-motion
  ✓ particles.js memiliki guard prefers-reduced-motion
  ✓ counter.js memiliki guard prefers-reduced-motion

4. Memeriksa listener scroll passive: true...
  ✓ Semua listener scroll terverifikasi memakai { passive: true }

5. Memeriksa guard DeviceOrientationEvent.requestPermission pada tilt.js...
  ✓ tilt.js memiliki guard DeviceOrientationEvent.requestPermission

6. Memeriksa guard resource pada particles.js...
  ✓ particles.js memiliki guard visibilitychange, IntersectionObserver, dan hardwareConcurrency

7. Memeriksa aksesibilitas split-text.js...
  ✓ split-text.js memasang atribut aria-label dan aria-hidden

-------------------------------------------
SEMUA TEST KONTRAK LOLOS! (13 checks passed)
```

### B. Test Reduced Motion Playwright (`scripts/test-motion-reduced.mjs`)
```
=== MEMULAI TEST PLAYWRIGHT REDUCED MOTION ===

Memuat 7 script motion ke halaman...
  ✓ Dimuat: scroll-scene.js
  ✓ Dimuat: reveal.js
  ✓ Dimuat: split-text.js
  ✓ Dimuat: drag.js
  ✓ Dimuat: tilt.js
  ✓ Dimuat: particles.js
  ✓ Dimuat: counter.js

Menjalankan inisialisasi modul...

Memverifikasi elemen dan visibilitas pada reduced motion...
  Memeriksa 3 elemen [data-reveal]:
    ✓ #hero-title (up): class=is-revealed, opacity=1
    ✓ #event-year (fade): class=is-revealed, opacity=1
    ✓ #story-block (mask-wipe): class=is-revealed, opacity=1
  ✓ Teks #hero-title utuh terbaca: "Mita & Andi Wedding"
  ✓ Counter #event-year langsung mendarat di: "2026"
  ✓ Nilai CSS var --scroll-progress pada scroll-mask: "1"

-------------------------------------------
SEMUA TEST REDUCED MOTION LOLOS TANPA BLOKIR ANIMASI!
```

Kedua pengujian lulus 100% dengan kode keluar `0`.
