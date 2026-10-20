# Daftar Aset, Font Self-Hosted & Lisensi per Template

Dokumen ini mencatat seluruh aset lokal (font `.woff2`, ilustrasi SVG, tekstur, thumbnail katalog, dan OG image) yang dipakai oleh setiap template sesuai §6 RENCANA-TEMPLATE-V5-ARGON.md.

---

## 1. Font Self-Hosted (`assets/fonts/`)

Seluruh font di-host secara lokal dalam format `.woff2` (subset Latin + tanda baca) dan berlisensi **SIL Open Font License 1.1 (OFL-1.1)** — bebas digunakan secara komersial.

| Keluarga Font | Berkas | Ukuran | Dipakai Oleh | Sumber & Lisensi |
|---|---|---:|---|---|
| **EB Garamond** | `assets/fonts/eb-garamond/eb-garamond-400.woff2` | 23.820 B (23,3 KB) | `klasik` (dan nanti `buku-cerita`) | Georg Duffner & Octavio Pardo — Google Fonts / SIL OFL 1.1 |
| **EB Garamond Italic** | `assets/fonts/eb-garamond/eb-garamond-400i.woff2` | 25.388 B (24,8 KB) | `klasik` | Georg Duffner & Octavio Pardo — Google Fonts / SIL OFL 1.1 |
| **Poppins** | `assets/fonts/poppins/poppins-400.woff2` | 7.884 B (7,7 KB) | `klasik` | Indian Type Foundry — Google Fonts / SIL OFL 1.1 |
| **Poppins Medium** | `assets/fonts/poppins/poppins-500.woff2` | 7.748 B (7,6 KB) | `klasik` | Indian Type Foundry — Google Fonts / SIL OFL 1.1 |
| **Fraunces** | `assets/fonts/fraunces/fraunces-latin.woff2` | 67.304 B (65,7 KB) | `senja` | Undercase Type (Phaedra Charles & Flavia Zimbardi) — SIL OFL 1.1 |
| **Fraunces Italic** | `assets/fonts/fraunces/fraunces-italic-latin.woff2` | 42.228 B (41,2 KB) | `senja` | Undercase Type — SIL OFL 1.1 |
| **Inter** | `assets/fonts/inter/inter-latin.woff2` | 48.256 B (47,1 KB) | `senja` | Rasmus Andersson — SIL OFL 1.1 |

---

## 2. Pustaka Vendor Lokal (`assets/js/vendor/`)

| Berkas | Ukuran | Dipakai Oleh | Cara Muat & Lisensi |
|---|---:|---|---|
| `assets/js/vendor/qrcode-generator.js` | 20.768 B (20,3 KB) | `assets/js/qr-checkin.js` | Dimuat secara *lazy* hanya ketika tamu mengetuk tombol `#btn-qr-checkin`. Lisensi MIT (Kazuhiko Arase). |

---

## 3. Aset per Template

### ① `klasik` — Classic Elegance
- **Font preload (`template.json`):**
  - `assets/fonts/eb-garamond/eb-garamond-400.woff2` (23,3 KB)
  - `assets/fonts/poppins/poppins-400.woff2` (7,7 KB)
- **Ikon & Ornamen SVG:**
  - Ikon play/pause (`#audio-toggle-icon`), QR check-in (`#btn-qr-checkin`), dan menu navigasi (`#btn-nav-menu`) disematkan langsung (*inline SVG*) di `templates/klasik/markup.html`.
- **Gambar Latar & Tekstur:**
  - `assets/img/rsvp-bg.webp` (konversi WebP dari `rsvp-bg.jpg`)
  - `assets/img/event-capsule-paper.webp`
- **Thumbnail Katalog & OG Image:**
  - `templates/klasik/cover.jpg` (39,7 KB)
  - `assets/img/social/og-cover.jpg` & `assets/img/social/og-cover.webp` (1200×630)

### ② `senja` — Senja Golden Hour
- **Font preload (`template.json`):**
  - `assets/fonts/fraunces/fraunces-latin.woff2` (65,7 KB)
  - `assets/fonts/inter/inter-latin.woff2` (47,1 KB)
- **Ilustrasi & Ornamen SVG (`templates/senja/markup.html` — inline SVG + `<defs>`):**
  - Filter butiran *film grain* (`#senja-grain` via `<feTurbulence>` + `<feColorMatrix>`, 0 byte raster).
  - Lapisan langit senja & lingkaran matahari garis emas (`.senja-sky-svg`, `[data-parallax-speed="0.18"]`).
  - Lapisan siluet perbukitan & pepohonan berlapis (`.senja-hills-svg`, `[data-parallax-speed="0.38"]`).
  - Ornamen pembatas adegan matahari terbenam & lengkung horizon.
- **Thumbnail Katalog & OG Image:**
  - `templates/senja/cover.jpg` & `templates/senja/cover.webp` (≤ 45 KB)
  - `assets/img/social/og-senja.jpg` (34,5 KB) & `assets/img/social/og-senja.webp` (18,1 KB)
