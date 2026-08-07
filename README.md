# undangan-nikahku

Undangan pernikahan digital **Mita Meliana & Andi Pramana** — single-page statis (HTML + CSS + vanilla JS, tanpa build step), terinspirasi gaya luxury gold/black/cream.

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
