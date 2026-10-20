# Laporan Eksekusi v5 — FASE 3 (Gelombang A: Template `senja`), FASE 4 & FASE 5

## 1. Apa yang Dikerjakan & Berkas yang Berubah

Membangun template pertama Gelombang A (`senja` — *Senja Golden Hour*), melengkapi dokumentasi aset & lisensi (`docs/aset-template.md`), serta memperluas test suite panel admin agar membuktikan panel admin skema-driven bekerja untuk seluruh template di `templates/index.json`.

### Berkas baru yang dibuat:
- `templates/senja/template.json` — Manifest lengkap (skema 9 bab `editor.sections` + field khas `extras.senjaSubtitle`, 7 warna `editor.colors` + `theme`, 4 `overlays`, 3 preset siap-pakai: *Golden Hour*, *Biru Senja*, *Mawar Debu*, serta target `editor.typography`).
- `templates/senja/markup.html` — Struktur HTML mobile-first (`#inv-root` → `.app-frame.senja-frame` → `.app-frame__scroll` → `main#invitation`) dengan ilustrasi SVG senja 3 lapis (langit senja & matahari garis, siluet perbukitan & pepohonan, bingkai lengkung foto mempelai), filter SVG `<feTurbulence id="senja-grain">`, serta seluruh kait DOM modul bersama (`rsvp.js`, `gift.js`, `qr-checkin.js`, `countdown.js`, `audio-player.js`, `livestream.js`, `nav-menu.js`).
- `templates/senja/style.css` — Stylesheet 27,9 KB (batas ≤ 60 KB) dengan `@font-face` lokal `Fraunces` dan `Inter`, variabel tema `--color-*`, animasi `transform`/`opacity`/`clip-path` (`mask-wipe`), `content-visibility: auto`, kontras nomor rekening tinggi, dan blok `@media (prefers-reduced-motion: reduce)`.
- `templates/senja/render.js` — Siklus hidup `window.WeddingTemplates["senja"] = { render(ctx), destroy() }`, pengisian seluruh 9 bab data inti, penyembunyian rapi section kosong (`.hidden = true`), integrasi `MotionScrollScene`, `MotionTilt`, `MotionSplitText`, `MotionCounter`, `initReveal`, serta pembukaan undangan.
- `templates/senja/cover.jpg` & `templates/senja/cover.webp` — Thumbnail katalog (33,7 KB, batas ≤ 60 KB).
- `assets/img/social/og-senja.jpg` & `assets/img/social/og-senja.webp` — Gambar Open Graph 1200×630 (34,5 KB).
- `docs/aset-template.md` — Dokumentasi aset, ukuran font `.woff2`, dan lisensi SIL OFL 1.1.
- `scripts/test-panel-all-templates.mjs` — Test Playwright skema-driven untuk menguji seluruh bab `editor.sections`, perubahan field (termasuk `extras.*`), slot foto, warna, dan preset di setiap template.

### Berkas yang diperbarui:
- `templates/index.json` — Mendaftarkan `senja` berdampingan dengan `klasik`.
- `assets/js/panel/pages/home.js` — Checklist peluncuran Ringkasan kini membaca daftar bab dari `manifest.editor.sections` template aktif.
- `assets/js/panel/pages/template.js` — Menampilkan thumbnail `cover.jpg`, 3 bulatan swatch warna, pita gradien, badge "Aktif", pesan pemisahan setelan tampilan antar-template, dan me-reload manifest bab saat berganti template.
- `scripts/test-panel-section-renderer.mjs` — Diperluas untuk menguji seluruh template di `templates/index.json`.
- `scripts/build-pages-dist.mjs`, `scripts/build-pages-dist-safe.mjs`, `scripts/test-pages-dist.mjs` — Memastikan `templates/`, `assets/fonts/`, `assets/js/motion/`, dan `assets/js/vendor/` ikut tersalin dan terverifikasi di `dist/`.

## 2. Hasil Anggaran Performa (`node scripts/perf-budget.mjs`)

| Template | `style.css` (≤ 60 KB) | Total JS (≤ 120 KB) | Motion JS (≤ 25 KB) | Font Preload (≤ 180 KB) | `cover.jpg` (≤ 60 KB) | CDN Eksternal |
|---|---:|---:|---:|---:|---:|---|
| `klasik` | 54,1 KB | 102,5 KB | 0,0 KB | 31,0 KB (2 file) | 23,9 KB | 0 |
| `senja` | 27,9 KB | 82,9 KB | 15,4 KB | 112,9 KB (2 file) | 33,7 KB | 0 |

## 3. Daftar Test yang Dijalankan & Hasilnya

Seluruh test non-4173 telah dijalankan dan **100% HIJAU (PASS)**:
- `node scripts/perf-budget.mjs` — **PASS**
- `node scripts/test-motion-contract.mjs` — **PASS**
- `node scripts/test-motion-reduced.mjs` — **PASS**
- `node scripts/test-template-contract.mjs` — **PASS**
- `node scripts/test-template-render.mjs` — **PASS**
- `node scripts/test-template-interaction.mjs` — **PASS**
- `node scripts/test-template-shared-modules.mjs` — **PASS**
- `node scripts/test-admin-v2-contract.mjs` — **PASS**
- `node scripts/test-panel-section-renderer.mjs` — **PASS**
- `node scripts/test-panel-all-templates.mjs` — **PASS**
- `node scripts/test-panel-smoke.mjs` — **PASS**
- `node scripts/test-panel-font-page.mjs` — **PASS**
- `node scripts/test-panel-kado.mjs` — **PASS**
- `node scripts/test-panel-list-pin.mjs` — **PASS**
- `node scripts/test-panel-photo-editor.mjs` — **PASS**
- `node scripts/test-panel-photo-layout.mjs` — **PASS**
- `node scripts/test-panel-template-photos.mjs` — **PASS**
- `node scripts/test-panel-visual-editor.mjs` — **PASS**
- `node scripts/test-panel-wishes.mjs` — **PASS**
- `node scripts/test-visual-editor-all-templates.mjs` — **PASS**
- `node scripts/test-visual-editor-bottom-safe-space.mjs` — **PASS**
- `node scripts/test-typography-apply.mjs` — **PASS**
- `node scripts/test-typography-contract.mjs` — **PASS**
- `node scripts/test-snap-rail-contract.mjs` — **PASS**
- `node scripts/test-event-capsule-contract.mjs` — **PASS**
- `node scripts/test-gallery-reveal-motion.mjs` — **PASS**
- `node scripts/test-gallery-video-first.mjs` — **PASS**
- `node scripts/test-audio-path-fallback.mjs` — **PASS**
- `node scripts/test-client-management-contract.mjs` — **PASS**
- `node scripts/test-client-delete-storage-api.mjs` — **PASS**
- `node scripts/test-demo-template-contract.mjs` — **PASS**
- `node scripts/test-wa-contact-pagination.mjs` — **PASS**
- `node scripts/test-wa-workspace-contract.mjs` — **PASS**
- `node scripts/test-admin-panels-browser.mjs` — **PASS**
- `node scripts/build-pages-dist-safe.mjs` & `node scripts/test-pages-dist.mjs` — **PASS**
- `node test/tenant-routing.test.mjs` — **PASS**

## 4. Keputusan Desain & Teknis

- **Gimmick Interaktif `senja`:** Menggunakan kombinasi 3 lapis kedalaman parallax (`[data-parallax-speed]` pada langit SVG, siluet perbukitan SVG, dan bingkai lengkung foto mempelai) yang terikat scroll via `motion/scroll-scene.js`, dipadukan dengan respons kemiringan lembut (`motion/tilt.js`) pada cover dan bukaan judul `data-reveal="mask-wipe"`.
- **Ketahanan Data Kosong:** Bila bagian opsional (`subcover`, `livestream`, `loveStory`, `dresscode`, atau `gallery`) dikosongkan client, `templates/senja/render.js` menyembunyikan section/elemen terkait dengan `hidden = true` sehingga tidak pernah ada judul menggantung atau kartu kosong.

## 5. Apa yang Masih Bermasalah atau Sengaja Dilewati

- Sesuai instruksi eksplisit §5.4 dan prompt tugas: pengerjaan **BERHENTI setelah template pertama Gelombang A (`senja`) selesai dan terverifikasi**, untuk meminta persetujuan pemilik produk sebelum melanjutkan ke template Gelombang A berikutnya (`kartu-pos`, `taman-mungil`) dan Gelombang B/C.
- Aksi `capture_default_template` ke Supabase sengaja tidak dijalankan karena menyentuh database produksi dan memerlukan izin eksplisit pemilik produk (§8.3 poin 3).

## 6. Yang Perlu Diuji Pemilik Produk di HP

Silakan buka URL berikut di HP (setelah `npm run serve:dist` atau deploy lokal):
1. **Pratinjau Template `senja`:** `/?template=senja` atau `/demo/?template=senja&to=Bapak+Andi`
   - Uji respon kemiringan/sentuhan di layar Cover, lalu ketuk **"Buka Undangan"**.
   - Gulir perlahan ke bawah untuk melihat efek parallax 3 lapis (langit senja, siluet bukit, foto mempelai) dan *mask-wipe* pada judul.
   - Uji tombol **"Kirim Hadiah"** di section Tanda Kasih (pastikan nomor rekening terbaca jelas dan tombol **Salin** berfungsi).
   - Uji form RSVP dan tombol QR Check-in di kanan bawah.
2. **Regresi Template `klasik`:** `/?template=klasik`
   - Pastikan tampilan visual `klasik` tetap identik seperti semula dengan waktu muat awal yang lebih cepat.
3. **Panel Admin (`senja`):** `/admin/#/template`
   - Pilih template **Senja Golden Hour**, lalu cek tab **Warna** (coba 3 preset: *Golden Hour*, *Biru Senja*, *Mawar Debu*), tab **Font**, dan **Editor Visual**.
