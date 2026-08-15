# Rencana Admin Panel v2 — Tulis Ulang dari Nol

> **Dokumen ini adalah spesifikasi eksekusi.** Ditulis untuk dieksekusi oleh sesi
> coding lain. Baca seluruhnya sebelum menulis kode. Bagian §11 (Definition of
> Done) adalah kontrak penerimaan.

---

## 1. Latar belakang & tujuan

Admin panel sekarang (`admin.html` + `assets/js/admin/*` + `assets/css/admin.css`,
±5.500 baris) tumbuh organik menjadi 8 tab gelap yang isinya campur aduk. Keluhan
konkret pemilik produk:

- **Tab "Teks" menampung 14 fieldset** yang tidak berhubungan satu sama lain —
  Umum, Sapaan, Mempelai, Opening, Subcover, Event, Dresscode, Quote, Live
  Streaming, Love Story, Gift-rekening, Gift-kontak, Gift-alamat, Lainnya. Ini
  satu halaman scroll panjang tanpa struktur.
- **Teks dan Foto dipisah secara artifisial.** Untuk mengurus satu bagian
  undangan (mis. "Mempelai") admin harus bolak-balik antara tab Teks dan tab
  Foto lalu memilih folder yang benar dari dropdown.
- **Tema gelap** tidak diinginkan.
- **Pola tab tidak skalabel** — sudah 8 item dan meluber.

**Tujuan v2:**

1. Tulis ulang 100% dari nol. **Tidak boleh ada sisa kode admin lama.**
2. Setiap bagian jadi **halaman terpisah**, bukan tab.
3. Pengelompokan pengaturan yang masuk akal, berbasis riset UX (§2).
4. **Terang (light)**, bukan gelap.
5. Responsif; **prioritas utama tampilan HP**, tetap rapi di PC.
6. Terasa seperti dashboard produk profesional — **bukan UI hasil generator AI**.

---

## 2. Dasar riset (bukan selera — ini yang memandu keputusan di §3–§6)

| Temuan riset | Sumber | Konsekuensi desain di sini |
|---|---|---|
| Tab bar hanya efektif untuk **≤5 item**; lebih dari itu, target sentuh mengecil dan opsi meluber | [NN/g — Basic Patterns for Mobile Navigation](https://www.nngroup.com/articles/mobile-navigation-patterns/) | Pola tab **dibuang**. 8 tab sekarang memang di luar batas yang bisa dipakai. |
| **Hub-and-spoke** cocok untuk aplikasi berorientasi tugas, di mana user menyelesaikan satu tugas per sesi dan area-areanya tidak saling tumpang tindih | NN/g, ibid. | Beranda = hub. Tiap bagian = spoke (halaman sendiri) dengan tombol kembali. Persis pola Settings di ponsel. |
| Hamburger/drawer menampung banyak item tapi **discoverability rendah** ("out of sight, out of mind") | NN/g, ibid. | Di HP navigasi utama **bukan** hamburger — hub yang terlihat penuh di layar. Drawer hanya dipakai di desktop sebagai sidebar permanen (selalu terlihat, bukan tersembunyi). |
| **Progressive disclosure**: tampilkan yang esensial dulu, sisanya saat dibutuhkan — menurunkan beban kognitif | [Excited — Dashboard UX](https://excited.agency/blog/dashboard-ux-design), [Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) | Tiap halaman punya blok "Lanjutan" yang terlipat (`<details>`) untuk field jarang dipakai. |
| **Inverted pyramid**: ringkasan/KPI paling penting di atas, detail menyusul | [Fuselab — Enterprise UX 2026](https://fuselabcreative.com/enterprise-ux-design-guide-2026-best-practices/) | Beranda: status publikasi → angka ringkas (RSVP, ucapan, WA) → navigasi. |
| Form **satu kolom** lebih efisien; kolom ganda memaksa baca zig-zag. Pengecualian hanya untuk field yang konsepnya berpasangan | Baymard Institute (via [ringkasan riset](https://fomr.io/blog/form-ux-best-practices)) | Buang `.form-grid` 2 kolom yang dipakai sekarang. Satu kolom, kecuali pasangan alami (Nama + Panggilan, Mulai + Selesai). |
| **Label di atas field** terbukti lebih baik di mobile (studi 18 situs, >1.000 field) | [Baymard — Field Label UX](https://baymard.com/blog/mobile-form-usability-label-position) | Semua label di atas input. Jangan pernah pakai placeholder sebagai pengganti label. |
| Kelompokkan field terkait ke **section berlabel** dengan spasi & tipografi | Baymard, ibid. | Tiap halaman = beberapa kartu berjudul, bukan satu tumpukan field. |
| **Explicit save** lebih sesuai ekspektasi untuk halaman pengaturan; autosave cocok untuk editor dokumen. Pola terbaik: **draft + publish** dengan indikator perubahan belum tersimpan | [Damian Wajer — Autosave or explicit save](https://www.damianwajer.com/blog/autosave/), [NN/g — Efficiency vs Expectations](https://www.nngroup.com/articles/efficiency-vs-expectations/) | Simpan eksplisit per halaman + gerbang Publish yang sudah ada (migration 0020). Dua tingkat: **Simpan** (draft) → **Publish** (tayang ke tamu). |
| Spasi ikut **grid 8pt**; batasi 3–5 warna semantik; **whitespace** lebih efektif dari garis/bayangan untuk memisahkan; hindari bayangan berat | [EightShapes — Light & Dark](https://medium.com/eightshapes-llc/light-dark-9f8ea42c9081), [AdminLTE — Color Schemes](https://adminlte.io/blog/best-admin-dashboard-color-schemes/) | Token spasi kelipatan 4/8. Border 1px + bayangan sangat tipis. |
| Kontras WCAG: **4.5:1** teks isi, **3:1** teks besar & komponen UI | WCAG 2.2 (via [Accessibility.build](https://accessibility.build/tools/color-palette-generator)) | Semua pasangan warna di §4 wajib lolos; termasuk teks sekunder & placeholder. |

### 2.1 Cara menghindari "terlihat seperti UI buatan AI"

Ini permintaan eksplisit. Aturan keras — **dilarang**:

- Gradien ungu→biru, hero gradient, glassmorphism/blur dekoratif.
- Emoji sebagai ikon fungsional.
- `border-radius` besar seragam di semua elemen (kesan "rounded-3xl di mana-mana").
- Bayangan besar mengambang (`0 20px 60px rgba(0,0,0,.3)`) pada kartu biasa.
- Empty-state dengan ilustrasi generik + teks "No data yet 🎉".
- Semua judul rata tengah.

**Yang dipakai sebagai gantinya** — bahasa desain yang sudah ada di produk ini:
`assets/css/wa.css` (workspace WhatsApp) sudah light dan punya karakter: heading
**Georgia serif** dengan `letter-spacing:-.04em`, kicker huruf kapital kecil
ber-`letter-spacing` lebar, kertas hangat `#fffdf8`, border tipis `#dfe7df`,
bayangan sangat rendah. **Admin v2 wajib satu keluarga dengan wa.css** — beda
warna aksen saja (emas/perunggu pernikahan, bukan hijau WhatsApp). Hasilnya
terbaca sebagai satu produk, bukan template.

Karakter yang dituju: rata kiri, kepadatan informasi nyata, serif untuk judul
halaman dipasangkan sans netral untuk UI, pemisah berupa border 1px dan
whitespace — bukan kartu melayang.

---

## 3. Arsitektur informasi baru

Prinsip pengelompokan: **urutkan sesuai yang dilihat tamu**, dan **satukan teks
dengan fotonya**. Admin berpikir "saya mau ubah bagian Mempelai" — bukan "saya
mau ubah teks, lalu saya mau ubah foto".

Ini menghapus pemisahan Teks/Foto yang sekarang jadi sumber utama kebingungan.

```
Beranda (hub)
│
├─ ISI UNDANGAN                     ← urut sesuai urutan section di undangan
│   ├─ Cover & Sampul
│   ├─ Mempelai
│   ├─ Pembuka & Ayat
│   ├─ Acara
│   ├─ Cerita Kami
│   ├─ Galeri
│   ├─ Hadiah
│   ├─ Live Streaming
│   └─ Penutup
│
├─ TAMU
│   ├─ Sapaan Tamu
│   ├─ Kirim WhatsApp        → wa.html (halaman terpisah yang sudah ada)
│   ├─ Ucapan & RSVP
│   └─ Check-in QR           → admin-qr.html (halaman terpisah yang sudah ada)
│
├─ TAMPILAN
│   ├─ Template
│   ├─ Warna
│   ├─ Font
│   └─ Editor Visual
│
└─ PENGATURAN
    └─ Pengaturan Undangan
```

19 tujuan, 4 kelompok. Bandingkan dengan sekarang: 8 tab, satu di antaranya
berisi 14 fieldset campur aduk.

### 3.1 Peta lengkap: dari mana ke mana (kontrak migrasi — tidak boleh ada yang hilang)

Setiap field yang ada sekarang **wajib** punya rumah baru. Tabel ini adalah
checklist; eksekutor harus mencentang semuanya.

| Halaman baru | Field teks (dari `content.js`) | Folder foto (dari `photos.js`) |
|---|---|---|
| **Cover & Sampul** | `subcover.enabled`, `subcover.quoteLine1`, `subcover.quoteLine2` | `cover`, `subcover` |
| **Mempelai** | `couple.bride.{name,nickname,instagram,father,mother}`, `couple.groom.{name,nickname,instagram,father,mother}` | `bride`, `groom` |
| **Pembuka & Ayat** | `opening.{arabicQuote,quote,source}` | `opening`, `std2` |
| **Acara** | `event.{dateISO,dateLabel,dayLabel,countdownTarget}`, `event.akad.{label,start,end,venue.name,venue.address,venue.mapsUrl}`, `event.resepsi.{…sama…}`, `dresscode.text`, `dresscode.colors[]` | `event` |
| **Cerita Kami** | `loveStory[].{date,title,text}` (daftar berulang) | `story` |
| **Galeri** | `quotePhoto.quote`, `galleryVideo` (YouTube) | `gallery`, `quote` |
| **Hadiah** | `gift.accounts[]` (rekening + owner + template per rekening), `gift.contact.{cpw,cpp}`, `gift.address.{recipient,phone,detail}`, `gift.templateKado`, `giftRecommendations` | `gift_item` |
| **Live Streaming** | `livestream.{youtube,instagram,tiktok}` | — |
| **Penutup** | `closingText` (closing statement default) | `closing` |
| **Sapaan Tamu** | `defaultGuestGreeting`, `guestGreetings[]` (kelompok: label + names[]) | — |
| **Ucapan & RSVP** | moderasi `wishes` (tabel), blokir, export CSV/PNG | — |
| **Check-in QR** | `qrCheckin.enabled` | — |
| **Template** | `content.template` | — |
| **Warna** | `theme.colors.*` (7), `theme.overlays.*` (4 × enabled/color/opacity), 12 preset | — |
| **Font** | `fonts.*` per elemen, 7 grup (cover, opening, couple, event, story, gift, closing) | — |
| **Editor Visual** | `visualEditor.elements` | — |
| **Pengaturan** | `siteTitle`, `guestParam`, `defaultGuestName`, `heroSlideInterval`, `audio.{title,path}` + unggah backsound | — |

> **Catatan folder foto:** `wfl` ada di `MAX_WIDTH`/`LOOP_FOLDERS` tapi sudah
> tidak muncul di dropdown `FOLDERS` (sengaja disembunyikan). Pertahankan
> perilaku itu — datanya tetap ada, tidak ditampilkan.

### 3.2 Yang TIDAK berubah

- Skema database. **Tidak ada migration baru.** Bentuk `site_content.content`
  tetap sama persis — v2 hanya mengubah cara menampilkan/mengelompokkan.
- Fitur Publish (migration `0020_publish_invitation.sql`) dan RPC
  `publish_invitation` / `get_invitation_draft`.
- Halaman tamu (`index.html`, `assets/js/main.js`, dst.) — **tidak disentuh
  sama sekali**.
- `wa.html` + `assets/css/wa.css` + `assets/js/admin/wa-blast.js` +
  `assets/js/wa.js` — halaman terpisah, sudah light, dibiarkan.
- `admin-qr.html` + `assets/js/admin/admin-qr.js` — dibiarkan.

---

## 4. Sistem desain

Semua token di `:root` pada `assets/css/panel.css`. Tidak ada nilai warna/spasi
hardcoded di luar blok token.

### 4.1 Warna (light, hangat, kontras lolos WCAG AA)

```css
:root {
  /* Permukaan */
  --p-canvas:   #f6f4ef;   /* latar halaman */
  --p-paper:    #fffdf9;   /* kartu */
  --p-sunken:   #f0ece3;   /* input disabled, header tabel */
  --p-line:     #e2ddd1;   /* border 1px */
  --p-line-strong: #cfc7b5;

  /* Tinta — dicek terhadap --p-paper */
  --p-ink:      #1f1c16;   /* 15.8:1  teks utama */
  --p-ink-2:    #5c5648;   /* 6.6:1   teks sekunder */
  --p-ink-3:    #7d7666;   /* 4.6:1   placeholder/hint — batas minimum AA */

  /* Aksen tunggal: perunggu hangat (nuansa pernikahan, cukup gelap
     untuk teks putih di atasnya) */
  --p-accent:   #8a6a2f;   /* 5.9:1 vs putih → aman untuk tombol primary */
  --p-accent-hover: #6f5424;
  --p-accent-wash:  #f5efe1;  /* latar badge/highlight */

  /* Semantik — 4 saja */
  --p-ok:    #1f6f43;
  --p-warn:  #8a5a12;
  --p-danger:#a3271f;
  --p-info:  #2a5a7a;
  --p-ok-wash: #eaf3ed; --p-warn-wash: #fbf2e2;
  --p-danger-wash: #fbeceb; --p-info-wash: #eaf1f6;

  /* Spasi — grid 4/8pt */
  --p-1:4px; --p-2:8px; --p-3:12px; --p-4:16px;
  --p-5:24px; --p-6:32px; --p-7:48px; --p-8:64px;

  /* Radius — bertingkat, TIDAK seragam */
  --p-r-sm:6px;    /* input, tombol kecil */
  --p-r-md:10px;   /* tombol, kartu kecil */
  --p-r-lg:16px;   /* kartu utama */

  /* Bayangan — sangat rendah, border yang bekerja */
  --p-shadow: 0 1px 2px rgba(31,28,22,.04), 0 8px 24px rgba(31,28,22,.05);

  /* Tipografi */
  --p-font-ui: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --p-font-display: Georgia, "Times New Roman", serif;
}
```

**Wajib diverifikasi eksekutor:** setiap kombinasi teks/latar dihitung ulang.
Jangan asumsikan angka di komentar benar — cek dengan kalkulator kontras.

### 4.2 Tipografi

- Judul halaman: `--p-font-display`, `clamp(1.5rem, 4vw, 2rem)`,
  `letter-spacing:-.035em`. **Rata kiri.**
- Kicker (label kelompok di atas judul): `.68rem`, `font-weight:800`,
  `letter-spacing:.13em`, `text-transform:uppercase`, warna `--p-accent`.
- Judul kartu: `--p-font-ui`, `.95rem`, `font-weight:700`.
- Label field: `.82rem`, `font-weight:650`, warna `--p-ink`.
- Teks bantuan: `.78rem`, `line-height:1.55`, warna `--p-ink-2`.
- Ukuran input minimal `16px` di HP (mencegah iOS auto-zoom saat fokus).

### 4.3 Komponen (daftar tertutup — jangan bikin varian lain)

`.p-btn` (`--primary` / `--ghost` / `--danger` / `--tiny`), `.p-card`,
`.p-field`, `.p-input`, `.p-textarea`, `.p-select`, `.p-switch`, `.p-badge`
(varian semantik), `.p-list-row`, `.p-empty`, `.p-modal`, `.p-toast`,
`.p-savebar`, `.p-nav-card`, `.p-photo-grid`.

Target sentuh minimum **44×44px** untuk semua kontrol.

---

## 5. Navigasi & routing

### 5.1 Routing

**Hash routing dalam satu shell** `admin.html`: `#/`, `#/mempelai`, `#/acara`, …

Alasan (bukan preferensi — kendala nyata): situs ini statis di GitHub Pages.
Path asli seperti `/​<slug>/admin/mempelai/` butuh penanganan di `404.html` +
`tenant.js` untuk **tiap** halaman baru. Hash routing memberi hasil yang sama
bagi pengguna (URL bisa di-bookmark, tombol Back browser jalan, tiap halaman
terpisah) tanpa menyentuh routing tenant sama sekali.

Di level kode tetap terpisah: **satu file per halaman** di `assets/js/panel/pages/`.
Router hanya me-mount modul halaman yang diminta ke `<main id="p-outlet">` dan
memanggil `destroy()` milik halaman sebelumnya.

### 5.2 Layout HP (prioritas utama)

- **Beranda** = hub penuh layar. Header ringkas (nama tenant + tombol keluar),
  kartu status publikasi, baris ringkasan angka, lalu 4 kelompok kartu navigasi.
- **Halaman detail** = layar penuh. Header sticky: tombol **‹ Kembali**, judul
  halaman, dan kicker nama kelompok. Konten scroll di bawahnya.
- **Save bar sticky di bawah**, `position:sticky; bottom:0`, **hanya muncul saat
  ada perubahan belum tersimpan**. Isi: teks status kiri, tombol Simpan kanan.
  Beri `padding-bottom: env(safe-area-inset-bottom)`.
- Tidak ada bottom tab bar (riset NN/g: >5 item tidak layak).

### 5.3 Layout desktop (≥1024px)

- **Sidebar kiri permanen 260px** berisi seluruh 19 tujuan yang dikelompokkan
  dengan heading kelompok — selalu terlihat (bukan drawer tersembunyi, sesuai
  catatan discoverability di §2).
- Konten kanan `max-width: 860px` (baris form yang terlalu lebar sulit dipindai).
- Beranda tetap ada sebagai item pertama sidebar.
- Save bar jadi sticky di bawah kolom konten.

Breakpoint tunggal: `1024px`. Di antaranya (tablet) pakai layout HP — sederhana
dan cukup.

### 5.4 Status publikasi

Fitur Publish sudah ada di DB. Di v2 tempatnya:

- **Beranda**: kartu status paling atas — "Semua perubahan sudah dipublikasikan"
  (badge `--p-ok`) atau "Ada perubahan belum dipublikasikan" (badge `--p-warn`)
  + tombol **Publikasikan** + tombol **Pratinjau draft**.
- **Header setiap halaman detail**: badge kecil non-intrusif dengan status yang
  sama, agar admin tahu tanpa harus kembali ke Beranda.
- Sumbernya satu: `invitations.content_updated_at` vs `published_at` (RPC dan
  trigger sudah ada — jangan bikin mekanisme baru).

Bedakan dua tingkat dengan jelas di UI, karena mudah tertukar:
**Simpan** = tersimpan sebagai draft. **Publikasikan** = tamu melihatnya.

---

## 6. Struktur file

### 6.1 Dihapus total

```
admin.html                        (ditulis ulang dari nol, bukan diedit)
assets/css/admin.css
assets/js/admin/admin.js
assets/js/admin/content.js
assets/js/admin/photos.js
assets/js/admin/editor.js
assets/js/admin/theme.js
assets/js/admin/fonts.js
assets/js/admin/template.js
assets/js/admin/visual-editor.js
assets/js/admin/wishes.js
assets/js/admin/section-nav.js
assets/js/admin/publish.js
assets/js/admin/shared.js         (diganti panel/core.js — lihat catatan)
```

**Catatan `shared.js`:** dipakai juga oleh `admin-qr.html` dan `wa.html`.
Ganti isinya dengan **shim tipis** yang mengekspor ulang API dari
`panel/core.js` (`window.AdminAPI`, `window.AdminShared.initAdminAuth`,
`window.AdminToast`) supaya kedua halaman itu tetap jalan tanpa diubah.
Shim ini **satu-satunya** kompromi terhadap "tanpa sisa" — dan isinya kode baru,
bukan kode lama yang dipertahankan. Jangan menyalin implementasi lama ke sana.

### 6.2 Dibuat

```
admin.html                        shell: <head>, layar login, app frame, outlet, sidebar
assets/css/panel.css              token + komponen + layout (satu file)
assets/js/panel/core.js           client Supabase, auth, akses tenant, query+timeout, toast
assets/js/panel/store.js          baca/tulis site_content, cache di memori, pelacakan dirty
assets/js/panel/router.js         hash router, mount/destroy halaman
assets/js/panel/ui.js             helper komponen (field, card, switch, modal, savebar)
assets/js/panel/photos.js         komponen foto reusable (unggah/urut/hapus/crop) per folder
assets/js/panel/pages/home.js
assets/js/panel/pages/cover.js
assets/js/panel/pages/mempelai.js
assets/js/panel/pages/pembuka.js
assets/js/panel/pages/acara.js
assets/js/panel/pages/cerita.js
assets/js/panel/pages/galeri.js
assets/js/panel/pages/hadiah.js
assets/js/panel/pages/livestream.js
assets/js/panel/pages/penutup.js
assets/js/panel/pages/sapaan.js
assets/js/panel/pages/ucapan.js
assets/js/panel/pages/checkin.js
assets/js/panel/pages/template.js
assets/js/panel/pages/warna.js
assets/js/panel/pages/font.js
assets/js/panel/pages/editor-visual.js
assets/js/panel/pages/pengaturan.js
```

Semua modul pola IIFE + `window.*` (sama seperti kode existing — **tanpa** ES
module/bundler, proyek ini memang tidak punya build step untuk JS).

### 6.3 Kontrak modul halaman

Setiap file di `pages/` mendaftarkan dirinya:

```js
window.PanelPages = window.PanelPages || {};
window.PanelPages["mempelai"] = {
  title: "Mempelai",
  group: "Isi Undangan",
  icon: "<svg …>",              // SVG inline, BUKAN emoji
  async mount(outlet) { … },     // render + pasang listener
  destroy() { … }                // lepas listener/observer/objectURL
};
```

Router membaca `window.PanelPages` untuk membangun sidebar & hub — jadi
menambah halaman baru cukup menambah satu file, tanpa menyentuh router.

### 6.4 Yang perlu dipertahankan perilakunya (baca kode lama sebelum menghapus)

Ini logika yang mahal ditemukan ulang. **Baca file lamanya, pahami, tulis ulang
bersih di tempat baru** — jangan salin-tempel utuh, tapi jangan pula
menghilangkan perilakunya:

- **Konversi WebP sisi klien + `MAX_WIDTH` per folder** (`photos.js` lama baris
  ~24–47) — batas lebar per folder harus sama dengan `TARGETS` di
  `compress-images.py`.
- **`LOOP_FOLDERS` + `MIN_LOOP_PHOTOS`** — peringatan kalau folder slider punya
  foto < 6 (Swiper `loop:true` rusak di bawah itu).
- **Tata letak galeri** (`gallery_layout`/`gallery_row`) memakai
  `assets/js/gallery-layout.js` yang dipakai bersama halaman tamu — **jangan
  duplikasi logikanya**, panggil modul itu.
- **Editor pan/zoom** rasio bingkai mengikuti bentuk asli tiap folder.
- **Pola simpan aman `site_content`**: SELECT → ubah key yang diperlukan saja →
  UPSERT objek utuh. Ini mencegah tab lain tertimpa. Di v2 jalurnya
  **wajib satu pintu** lewat `store.js` (dulu ada 6+ tempat upsert independen —
  itu sumber bug dan penyebab pelacakan dirty harus dipasang di level DB).
- **Batasan peran `admin_qr`**: RLS hanya mengizinkan peran itu mengubah key
  `livestream`. `store.js` harus punya jalur khusus itu (dulu
  `saveLivestream()`).
- **Unggah backsound**: ekstensi + batas 15 MB, path `<slug>/audio/<uuid>.<ext>`.
- **Isolasi storage**: path selalu `<slug>/…` — ditegakkan juga oleh RLS.

---

## 7. Perilaku menyimpan

1. Halaman memuat data dari `store.js` (satu kali fetch `site_content`, di-cache
   di memori untuk seluruh sesi).
2. Perubahan field → tandai halaman `dirty` → save bar muncul.
3. **Simpan** → `store.save(patch)` → SELECT-merge-UPSERT satu pintu → toast
   "Tersimpan" → save bar hilang.
4. Trigger DB otomatis membumping `content_updated_at` → badge publikasi jadi
   "belum dipublikasikan".
5. Meninggalkan halaman dengan perubahan belum tersimpan → konfirmasi
   (`beforeunload` untuk tutup tab, dialog in-app untuk pindah rute).
6. **Publikasikan** hanya dari Beranda → RPC `publish_invitation`.

Foto **pengecualian**: unggah/hapus/urut langsung tertulis ke tabel `photos`
saat aksi dilakukan (tidak ada draft lokal untuk file biner). Beri umpan balik
langsung per kartu foto, dan jangan tampilkan save bar untuk aksi foto.

---

## 8. Aksesibilitas (minimum yang wajib)

- Semua input punya `<label>` terkait (bukan hanya placeholder).
- Fokus terlihat jelas: `:focus-visible` → outline 2px `--p-accent` + offset.
- Modal: fokus terperangkap, `Esc` menutup, fokus balik ke pemicu.
- Toast: `role="status" aria-live="polite"`.
- Navigasi sidebar: `<nav>` + `aria-current="page"`.
- Kontras minimum §2 dipenuhi termasuk teks di dalam badge.
- Sepenuhnya bisa dioperasikan dengan keyboard.

---

## 9. Urutan eksekusi

Kerjakan berurutan; setelah tiap fase pastikan aplikasi tetap bisa dibuka.

1. **Fase 1 — Fondasi.** `panel.css` (token + komponen), `admin.html` shell,
   `core.js` (auth + akses tenant + toast), `router.js`, `ui.js`, `store.js`.
   Buat satu halaman dummy untuk membuktikan alurnya jalan.
2. **Fase 2 — Beranda + Pengaturan.** Hub, kartu status publikasi, ringkasan
   angka, halaman Pengaturan (paling sederhana, membuktikan siklus simpan).
3. **Fase 3 — Komponen foto** (`panel/photos.js`) + halaman **Mempelai** sebagai
   pembuktian bahwa teks + foto menyatu dalam satu halaman.
4. **Fase 4 — Sisa halaman Isi Undangan**: Cover, Pembuka, Acara, Cerita,
   Galeri, Hadiah, Live Streaming, Penutup.
5. **Fase 5 — Tamu**: Sapaan, Ucapan & RSVP, Check-in QR.
6. **Fase 6 — Tampilan**: Template, Warna, Font, Editor Visual.
7. **Fase 7 — Bersih-bersih.** Hapus semua file di §6.1, ganti `shared.js`
   dengan shim, pastikan `admin-qr.html` dan `wa.html` masih berfungsi.
8. **Fase 8 — Pemeriksaan akhir** terhadap §11.

---

## 10. Pengujian

Proyek ini tidak punya test runner; skrip uji berupa file mandiri di `scripts/`
yang dijalankan langsung dengan `node scripts/test-<nama>.mjs`. Ikuti pola itu.

Buat `scripts/test-admin-v2-contract.mjs` yang memeriksa secara statis:

- Tidak ada lagi file di §6.1 yang tersisa (kecuali shim `shared.js`).
- `admin.html` tidak mengandung `class="tab"` atau `data-tab`.
- Setiap kunci di `window.PanelPages` (diambil dengan regex dari
  `assets/js/panel/pages/*.js`) punya `title`, `group`, `mount`, `destroy`.
- Seluruh field pada tabel §3.1 muncul di salah satu file `pages/` — ini
  jaring pengaman utama supaya tidak ada pengaturan yang hilang saat migrasi.
- `panel.css` tidak memuat literal warna hex di luar blok `:root`.

**Jangan** jalankan verifikasi Playwright/screenshot/tunnel — pemilik menguji
sendiri di ponselnya. Cukup `npm run build:pages` untuk memastikan build lolos.

---

## 11. Definition of Done

- [ ] Seluruh 19 halaman ada, tiap halaman punya rute sendiri, tidak ada tab.
- [ ] Seluruh baris tabel §3.1 sudah punya rumah dan terbukti tersimpan.
- [ ] Semua file di §6.1 terhapus; `shared.js` hanya shim tipis ke `core.js`.
- [ ] `admin-qr.html` dan `wa.html` masih berfungsi penuh.
- [ ] Tema terang, tidak ada sisa palet gelap.
- [ ] HP: hub-and-spoke, save bar sticky, target sentuh ≥44px, input ≥16px.
- [ ] Desktop ≥1024px: sidebar permanen berkelompok, konten `max-width:860px`.
- [ ] Alur simpan satu pintu lewat `store.js`; tidak ada `.upsert("site_content")`
      yang tersebar di file halaman.
- [ ] Status publikasi tampil di Beranda dan di header tiap halaman.
- [ ] Kontras WCAG AA terpenuhi dan sudah diverifikasi, bukan diasumsikan.
- [ ] Tidak ada gradien ungu/biru, emoji-sebagai-ikon, atau glassmorphism (§2.1).
- [ ] `node scripts/test-admin-v2-contract.mjs` lolos.
- [ ] `npm run build:pages` lolos.
- [ ] Tidak ada perubahan pada halaman tamu maupun migration database.

---

## 12. Catatan untuk eksekutor

- Bahasa UI: **Indonesia**. Komentar kode: Indonesia, mengikuti gaya berkas yang
  sudah ada (jelaskan *kenapa*, bukan *apa*).
- Jangan tambahkan dependency baru. `html2canvas` dan `xlsx` dari CDN yang sudah
  dipakai boleh dipertahankan untuk export.
- Jangan menyentuh `supabase/migrations/**` maupun `supabase/functions/**`.
- Jangan menyentuh halaman tamu.
- Kalau menemukan pertentangan antara dokumen ini dan kode nyata, **kode nyata
  yang benar** — catat pertentangannya di ringkasan akhir.
- Commit bertahap per fase, jangan satu commit raksasa.
