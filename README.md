# undangan-nikahku

Undangan pernikahan digital — HTML + CSS + vanilla JS (tanpa framework/bundler), backend Supabase. Multi-tenant (`/<slug>/`) dengan beberapa template pilihan. Harga perkenalan **Rp199.000** (coret Rp499.000).

## Fitur untuk pembeli

Semua yang di bawah ini sudah termasuk dalam paket.

### 1. Undangan untuk tamu
- **Link pribadi per tamu** — `?to=Nama+Tamu` menampilkan nama tamu di cover, dengan sapaan otomatis.
- **Sapaan per kelompok** — mis. keluarga, teman kantor, sahabat; tiap kelompok punya sapaan dan kalimat penutup sendiri (token `${tamu}`, `${CPP}`, `${CPW}`).
- **Cover / amplop pembuka** — layar pembuka sebelum undangan dibaca, dengan slideshow foto.
- **Countdown** menuju hari-H.
- **Profil mempelai** — nama lengkap, panggilan, orang tua, foto, dan Instagram.
- **Acara Akad & Resepsi** — tanggal, jam, lokasi, tautan Google Maps, tombol **Tambah ke Kalender**.
- **Live streaming** — tautan siaran (YouTube/TikTok/Instagram) untuk tamu yang tidak bisa hadir.
- **Love story** — linimasa cerita perjalanan, lengkap dengan foto per momen.
- **Galeri foto & video** — pola tata letak otomatis, foto bisa diatur crop/zoom.
- **Quote / ayat** — termasuk teks Arab dan foto quote.
- **Dress code** — palet warna yang dianjurkan untuk tamu.
- **Musik latar (backsound)** — tombol putar/jeda melayang, judul lagu bisa diatur.
- **Animasi & transisi** — reveal saat scroll, teks bergerak per huruf, slideshow, sesuai karakter tiap template.
- **Responsif** — dioptimalkan untuk layar HP.

#### Bagian-bagian undangan (9 bab)

Keempat template memakai urutan bab yang sama; tampilan dan animasinya yang berbeda.

| # | Bab | Isi |
|---|---|---|
| 1 | **Cover / Sampul** | Nama mempelai, nama tamu (`?to=`), foto cover atau slideshow, tombol buka undangan. Di Classic Elegance ada juga subcover dan quote dua baris. |
| 2 | **Pembuka & Ayat** | Bismillah (Arab), terjemahan, dan sumber ayat (QS …). Foto opening. |
| 3 | **Mempelai** | Mempelai wanita dan pria: nama lengkap, panggilan, Instagram (opsional), nama ayah dan ibu, foto. |
| 4 | **Acara** | Tanggal dan hari, countdown, kartu **Akad** dan **Resepsi** (jam mulai/selesai, nama venue, alamat, tautan Maps), tombol tambah ke kalender, dress code dan palet warna. |
| 5 | **Live Streaming** | Tautan YouTube, Instagram, dan TikTok untuk tamu yang menonton dari jauh. |
| 6 | **Cerita Kami** | Linimasa love story dengan foto per momen (daftar bisa ditambah dan diurutkan). |
| 7 | **Galeri** | Galeri foto, video YouTube (Classic Elegance), dan foto quote. |
| 8 | **Hadiah** | Amplop digital (rekening/e-wallet, tombol salin), alamat kado, rekomendasi kado, konfirmasi kirim via WhatsApp. Di Nocturne, Kertas, dan Sekar Jagat bab ini juga memuat **RSVP & ucapan**. |
| 9 | **Penutup** | Kalimat penutup (bisa beda per kelompok tamu) dan foto penutup. |

Elemen melayang di luar bab: tombol musik, tombol QR check-in (khusus tamu ber-link pribadi), dan navigasi antarbagian.

### 2. RSVP & ucapan
- Tamu mengisi **konfirmasi kehadiran** (Hadir / Tidak Hadir / Ragu-ragu) dan mengirim **ucapan & doa**.
- Ucapan tampil sebagai buku tamu di undangan.
- **Moderasi**: filter kata terlarang, hapus ucapan, blokir perangkat penyebar spam, **sematkan (pin)** ucapan pilihan.
- **Ekspor** ucapan/RSVP ke CSV dan gambar (PNG).

### 3. Hadiah & amplop digital
- Panel **amplop digital**: beberapa rekening/e-wallet, tombol **salin nomor rekening**, dan alamat pengiriman kado.
- **Rekomendasi kado** (wishlist) yang bisa dilihat tamu.
- **Konfirmasi pengiriman kado** lewat WhatsApp.
- **Pencatat Kado & Amplop** (admin): beberapa daftar bernama, catat pemberi, barang, jumlah, nominal, dan keterangan; ada ringkasan total dan **ekspor Excel**.

### 4. Kirim undangan lewat WhatsApp
- Halaman **Kirim WhatsApp** khusus: daftar kontak + template pesan dengan token nama tamu & mempelai.
- Satu klik membuka WhatsApp dengan pesan dan link pribadi tamu sudah terisi (dikirim satu per satu — aman dari deteksi spam).
- Penanda **sudah dikirim**, beberapa template pesan.
- **Buku kontak**: beberapa daftar, isi manual atau **impor CSV / Excel / vCard** (kontak HP).

### 5. Check-in QR di hari-H
- Tamu dengan link pribadi punya **tombol QR** melayang di undangannya.
- Petugas memakai halaman **Check-in QR** untuk memindai dan mencatat kehadiran → daftar hadir rapi.
- Bisa dimatikan bila acara tidak memakai check-in.

### 6. Panel admin (edit sendiri, tanpa chat revisi)
- **Revisi tanpa batas** selama undangan aktif — ubah kapan pun.
- Navigasi **bab bernomor** + halaman **Ringkasan** berisi checklist kesiapan undangan.
- Form **menyesuaikan template** yang aktif: hanya field yang benar-benar dipakai template yang tampil.
- **Draft & Publikasikan** — perubahan aman disimpan dulu, tamu baru melihatnya setelah dipublikasikan.
- **Editor Visual** — klik langsung teks/elemen di pratinjau undangan asli untuk mengubah teks, tipografi, tombol, posisi, dan overlay.
- **Manajer foto** — unggah, konversi otomatis ke WebP, urutkan, atur crop/zoom, per bagian.
- **Warna** (preset + kustom) dan **Font** per template.
- **Ganti template** kapan saja; pengaturan tiap template tersimpan terpisah sehingga tidak saling menimpa.
- **Akun admin** — tambah/kelola admin (mis. pasangan) dan akun petugas check-in.
- Judul situs, parameter nama tamu, nama tamu default, jeda slideshow, dan audio.

### 7. Template
| Template | Karakter |
|---|---|
| **Classic Elegance** (`klasik`) | Hangat, emas, timeless. Cover layar penuh, kartu akad & resepsi, linimasa cerita. |
| **Nocturne** | Sinematik plum malam; tiap bagian setinggi layar dengan scroll-snap, nama didone di atas foto redup. |
| **Kertas** | Cetak risograph dua warna; nama dicetak besar, halaman mengalir seperti majalah. |
| **Sekar Jagat** | Keraton Jawa; indigo & emas, ornamen SVG, potret berbingkai lengkung, motif kawung. |

### 8. Teknis & keamanan
- **Alamat sendiri** (`/<slug>/`) per pasangan, data & foto terisolasi per tenant (RLS Supabase).
- **Cadangan offline** — bila server tak terjangkau, undangan tetap tampil dari cache/konfigurasi lokal.
- Pemuatan cepat: data dan template diambil paralel, satu panggilan RPC per kunjungan.
- Halaman marketing & **demo** tersedia di `/home/` dan `/demo/`.

## Untuk developer (single-tenant lama)

Bagian di bawah ini menjelaskan setup dasar berbasis `config.js` (fallback offline). Arsitektur lengkap ada di `CLAUDE.md` dan `docs/kontrak-template.md`.

## Jalankan lokal

```bash
# dari root project
npx http-server . -p 8080
```

Buka `http://localhost:8080/?to=Nama+Tamu`.

## Ganti data (nama, tanggal, rekening, dll)

Semua konten ada di satu file: **`assets/js/config.js`** — tidak perlu menyentuh HTML/JS lain.

## Foto & slideshow

Foto dikelompokkan per section di `assets/img/`:

| Folder | Dipakai untuk |
|---|---|
| `foto_cover` | Slideshow cover (halaman pertama) |
| `foto_opening` | Slideshow section pembuka (countdown) |
| `foto_closing` | Slideshow penutup/footer |
| `foto_slider_section_1` | Slider We Found Love |
| `foto_slider_section_2` | Slider kartu Event (Akad & Resepsi) |
| `foto_gallery` | Galeri foto (pola baris otomatis) |
| `foto_bride` | Slideshow mempelai wanita |
| `foto_groom` | Slideshow mempelai pria |
| `foto_profile` | Foto profil mempelai (`bride.jpg` / `groom.jpg`) |
| `foto_quote` | Foto quote full-width (`photo.jpg`) |
| `foto_story` | Foto love story (`01.jpg`–`04.jpg`, urut per milestone) |

**Tambah/ganti foto**: letakkan file (jpg + webp dengan nama sama) di folder yang sesuai, lalu jalankan:

```bash
node scripts/build-manifests.mjs
```

Script ini memindai folder dan menulis `manifest.json` per folder (diurutkan by name). Aplikasi cukup fetch manifest — tidak ada nama file statis di config. Slideshow butuh minimal 2 foto; slider loop butuh minimal 6.

> Catatan: webp disarankan (lebih ringan). Kalau tidak punya webp, hapus baris `<source>` webp di file yang bersangkutan atau cukup sediakan jpg — manifest tetap jalan.

## RSVP & buku tamu (Supabase)

Ucapan tersimpan permanen di Supabase (project `rxqolwczphehbzrzmisa`, tabel `wishes`). Konfigurasi ada di `config.js` → `supabase`. Migration SQL ada di `supabase/migrations/0001_create_wishes.sql`.

## Tes lewat tunnel (anti-CORS file://)

Fetch manifest tidak bisa diakses lewat `file://`. Untuk tes di HP:

```bash
npx http-server . -p 8080          # terminal 1: server lokal
C:/Users/andi.pramana/cloudflared.exe tunnel --url http://localhost:8080 --no-autoupdate   # terminal 2: tunnel
```

Tunnel akan memberi URL `https://xxxx.trycloudflare.com` (berubah setiap restart).
