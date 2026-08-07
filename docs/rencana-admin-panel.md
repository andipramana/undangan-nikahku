# Rencana: Panel Admin + Foto & Teks dari Supabase

Dokumen ini ditulis untuk dieksekusi oleh AI agent lain. Semua keputusan penting
sudah diambil dan alasannya ditulis — jangan diubah tanpa membaca bagian
"Jebakan" di akhir.

---

## 1. Tujuan

Saat ini seluruh isi undangan hidup di file statis:

- **Teks** di `assets/js/config.js` (objek `window.WEDDING_CONFIG`).
- **Foto** di `assets/img/<folder>/`, urutannya ditentukan nama file, didaftarkan
  lewat `manifest.json` per folder yang digenerate `scripts/build-manifests.mjs`.

Artinya setiap koreksi nama, jam acara, atau tukar foto harus lewat edit file →
commit → push. Yang diinginkan:

1. Foto disimpan di **Supabase Storage**, bukan di repo.
2. Ada **halaman admin berpassword** untuk mengelola semuanya.
3. Di admin bisa **mengatur urutan foto** per folder, serta **menambah/mengurangi**
   jumlah foto tiap slider.
4. Tiap foto bisa **digeser (pan) dan di-zoom** agar komposisinya pas di layar HP.
5. **Semua teks** undangan bisa diubah dari panel admin.
6. Undangan **sekali fetch** langsung dapat seluruh data yang dibutuhkan.

---

## 2. Keputusan arsitektur

### 2.1 Autentikasi — Supabase Auth, bukan pengecekan di JavaScript

Kredensial disimpan sebagai user di **Supabase Auth** dan diverifikasi di server.
Password TIDAK boleh muncul di kode mana pun.

- Email login: `admin@mitaandi.wedding` (dipakai internal — Supabase Auth memakai
  email sebagai identitas; ini bukan rahasia dan boleh terlihat di kode).
- Form login menampilkan field **"Nama pengguna"**, tamu-admin mengetik
  `Mita&Andi`, dan JS memetakannya ke email di atas. Jadi pengalamannya sesuai
  permintaan, tapi yang diverifikasi tetap Supabase.
- Password: `Mita&Andi25Agustus2026` — **diketik manusia saat login**, tidak
  pernah ada di repo.

**WAJIB: matikan pendaftaran publik.** Kalau tidak, siapa pun bisa membuat akun
sendiri, otomatis jadi role `authenticated`, dan lolos semua policy tulis di
bawah. Ini lubang terbesar di rancangan ini kalau terlewat.
Supabase Dashboard → Authentication → Sign In / Providers → Email → matikan
**"Allow new users to sign up"**. Padanan lokalnya di `supabase/config.toml`:
`[auth] enable_signup = false`.

### 2.2 Satu repo, bukan repo terpisah

Panel admin ditaruh di repo ini sebagai `admin.html`. Repo terpisah tidak
menambah keamanan sedikit pun — halaman admin tetap bisa dibuka siapa saja,
dan yang menjaganya adalah Auth + RLS, bukan alamatnya. Satu repo justru
mencegah bentuk data di admin dan di undangan melenceng diam-diam.

Tambahkan `<meta name="robots" content="noindex">` di `admin.html` supaya tidak
terindeks mesin pencari.

> Opsi bagi yang ingin permukaan serangnya lebih kecil lagi: jangan deploy
> `admin.html` sama sekali, jalankan lokal (`npm run serve` lalu buka
> `localhost:8080/admin.html`). Panel ini hanya butuh browser + koneksi ke
> Supabase. Konsekuensinya tidak bisa mengedit dari HP.

### 2.3 Undangan harus tetap hidup kalau Supabase mati

Ini undangan pernikahan dengan satu hari yang tidak bisa diulang. `config.js`
dan foto lokal **tetap dipertahankan sebagai cadangan**:

1. Undangan memanggil RPC `get_invitation()`.
2. Payload terakhir yang berhasil disimpan di `localStorage`.
3. Kalau RPC gagal → pakai `localStorage`; kalau itu pun kosong → pakai
   `WEDDING_CONFIG` + manifest lokal seperti sekarang.

Jangan hapus `assets/img/` maupun `config.js` di pekerjaan ini.

---

## 3. Skema database

Buat migration baru: `supabase/migrations/0002_admin_content.sql`.

### 3.1 Tabel `site_content` — seluruh teks dalam satu baris JSONB

```sql
create table if not exists public.site_content (
  id smallint primary key default 1,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  constraint site_content_single_row check (id = 1)
);
```

Bentuk `content` **mengikuti persis** struktur `WEDDING_CONFIG` yang ada, dikurangi
field yang tidak lagi relevan (`*Manifest`, `*.photo`, `supabase`, `gallery.manifest`).
Field yang harus ada:

`siteTitle`, `guestParam`, `defaultGuestName`,
`couple.bride{name,nickname,father,mother,instagram}`, `couple.groom{...}`,
`opening{arabicQuote,quote,source}`,
`event{dateISO,dateLabel,dayLabel,countdownTarget,akad{label,start,end},resepsi{label,start,end},venue{name,address,mapsUrl}}`,
`dresscode{text,colors[]}`, `quotePhoto{quote}`,
`loveStory[]{date,title,text}`,
`gift{accounts[]{bank,number,holder,placeholder},address{recipient,phone,detail},note}`,
`heroSlideInterval`, `audio{src,title}`, `closing{text}`.

Menyimpan semuanya sebagai satu JSONB (bukan tabel per-entitas) dipilih karena
strukturnya bersarang dan berisi array berurutan (`loveStory`, `gift.accounts`,
`dresscode.colors`) — memecahnya jadi tabel relasional menambah banyak kerja
tanpa manfaat, karena tidak ada yang perlu di-query per-field.

### 3.2 Tabel `photos`

```sql
create type public.photo_folder as enum (
  'cover', 'opening', 'closing',
  'bride', 'groom',
  'wfl',        -- We Found Love (dulu foto_slider_section_1)
  'event',      -- slider kartu event (dulu foto_slider_section_2)
  'gallery',
  'quote',      -- satu foto full-width 1:1
  'story'       -- foto per babak Our Story
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  folder public.photo_folder not null,
  storage_path text not null unique,   -- relatif terhadap bucket, mis. 'bride/01.webp'
  sort_order int not null default 0,
  focal_x numeric(5,2) not null default 50,   -- persen, untuk object-position
  focal_y numeric(5,2) not null default 50,
  zoom numeric(4,2) not null default 1,       -- 1.00 - 3.00
  alt text not null default '',
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index if not exists photos_folder_order_idx
  on public.photos (folder, sort_order, id);
```

`zoom` diberi batas lewat check constraint: `check (zoom >= 1 and zoom <= 3)`,
`focal_x`/`focal_y` `check (... between 0 and 100)`.

### 3.3 RLS

```sql
alter table public.site_content enable row level security;
alter table public.photos       enable row level security;

-- Tamu (anon) hanya boleh membaca.
create policy "anon read content" on public.site_content
  for select to anon, authenticated using (true);
create policy "anon read photos" on public.photos
  for select to anon, authenticated using (true);

-- Hanya yang sudah login yang boleh menulis.
create policy "admin write content" on public.site_content
  for all to authenticated using (true) with check (true);
create policy "admin write photos" on public.photos
  for all to authenticated using (true) with check (true);
```

---

## 4. Storage

Bucket `photos`, **public read**:

```sql
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "public read photos bucket" on storage.objects
  for select to anon, authenticated using (bucket_id = 'photos');

create policy "admin manage photos bucket" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos') with check (bucket_id = 'photos');
```

URL publik dibentuk dengan `supabase.storage.from('photos').getPublicUrl(path)`.

**Format file: WebP saja.** Panel admin mengonversi setiap unggahan ke WebP di
browser (canvas) sebelum dikirim, jadi tidak perlu lagi pasangan jpg+webp seperti
sekarang. Sekalian terapkan batas lebar per folder — angkanya sudah dihitung dari
CSS di `scripts/compress-images.py` (konstanta `TARGETS`), **pakai ulang angka itu,
jangan mengarang baru**:

| folder | lebar maks |
|---|---|
| cover, opening, closing, quote | 1280 |
| bride, groom | 1280 |
| event, gallery | 1200 |
| story | 960 |
| wfl | 560 |

Kualitas WebP 0.8. Nama file: `<folder>/<uuid>.webp`.

---

## 5. Sekali fetch — RPC `get_invitation()`

```sql
create or replace function public.get_invitation()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'content', (select content from public.site_content where id = 1),
    'photos', coalesce((
      select jsonb_object_agg(folder, arr) from (
        select folder,
               jsonb_agg(
                 jsonb_build_object(
                   'id', id, 'path', storage_path, 'alt', alt,
                   'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom,
                   'width', width, 'height', height
                 ) order by sort_order, id
               ) as arr
        from public.photos
        group by folder
      ) t
    ), '{}'::jsonb)
  );
$$;

grant execute on function public.get_invitation() to anon, authenticated;
```

Sisi undangan: `const { data } = await sb.rpc('get_invitation')` — satu panggilan,
dapat teks + seluruh foto terurut. Tidak ada lagi 8 `fetch()` manifest terpisah.

---

## 6. Migrasi data yang sudah ada

Skrip sekali-jalan `scripts/seed-supabase.mjs` (Node, jalan lokal, **jangan**
di-deploy):

1. Baca `assets/js/config.js` → susun objek `content` → upsert ke `site_content`.
2. Untuk tiap folder lama, baca `manifest.json`, unggah file `.webp`-nya ke bucket
   dengan `sort_order` mengikuti urutan sekarang, `focal_x/y = 50`, `zoom = 1`.
   Pemetaan folder lama → enum: `foto_slider_section_1`→`wfl`,
   `foto_slider_section_2`→`event`, `foto_*`→nama tanpa prefiks.
3. `foto_story` diunggah ke folder `story` dengan `sort_order` = indeks item
   `loveStory` yang memakainya.
4. `foto_quote/photo.webp` → folder `quote`, satu baris.
5. `foto_profile` **dilewati** — sudah tidak dirender di mana pun.

Skrip ini memakai **service_role key** dari `.env` (sudah masuk `.gitignore`).
Service role key tidak boleh masuk repo, dan tidak boleh dipakai di `admin.html`.

---

## 7. Perubahan sisi undangan

| File | Perubahan |
|---|---|
| `assets/js/supabase-client.js` | tambah helper `fetchInvitation()`: panggil RPC, simpan hasil ke `localStorage`, kembalikan cadangan bila gagal |
| `assets/js/photos.js` | `fetchPhotos(manifestUrl)` → `getPhotos(folder)` yang membaca payload hasil fetch tadi; `buildPhotoSlide` menerapkan pan/zoom |
| `assets/js/main.js` | `DOMContentLoaded` jadi `async`: `await fetchInvitation()` dulu, gabungkan hasilnya di atas `WEDDING_CONFIG`, baru `populateContent()` dan init modul |
| `hero-slideshow.js`, `we-found-love.js`, `couple-sliders.js`, `event-cards.js`, `gallery.js` | ganti sumber foto dari manifest ke payload |
| `assets/css/style.css` | dukungan pan/zoom (lihat §8) |

Preloader (`#preloader`) baru disembunyikan setelah payload siap — sudah ada
mekanismenya di `main.js`, cukup geser pemanggilannya. Batas aman 3 detik yang
sudah ada (`setTimeout(hidePreloader, 3000)`) **dipertahankan**.

---

## 8. Pan & zoom foto

Simpan `focalX`/`focalY` (persen) dan `zoom` per foto, terapkan sebagai CSS
custom property di elemen `<img>`:

```html
<img src="..." style="--fx:62%; --fy:30%; --zoom:1.35">
```

```css
.photo-frame { overflow: hidden; }
.photo-frame img {
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: var(--fx, 50%) var(--fy, 50%);
  transform: scale(var(--zoom, 1));
}
```

### JEBAKAN — tabrakan dengan Ken Burns

`assets/css/style.css` punya `.kenburns { animation: kenburns ... }` yang
menganimasikan `transform: scale(1) → scale(1.15)` pada foto hero (cover,
opening, closing). Animasi **selalu menang** atas `transform` biasa, jadi
`--zoom` akan diabaikan diam-diam di tiga folder itu. Perbaikannya: masukkan
zoom ke dalam keyframe-nya, jangan ke properti transform terpisah.

```css
@keyframes kenburns {
  from { transform: scale(var(--zoom, 1)); }
  to   { transform: scale(calc(var(--zoom, 1) * 1.15)); }
}
```

### Editor di panel admin

Tampilkan foto di dalam bingkai ber-rasio **sama persis** dengan tempat foto itu
dipakai, supaya yang dilihat admin sama dengan yang dilihat tamu:

| folder | rasio bingkai pratinjau |
|---|---|
| cover, opening, closing | 9:19.5 (layar HP penuh) |
| bride, groom | lebar layar × 75vh |
| wfl | 1:1 |
| event | lebar kartu × 40% tinggi kartu |
| gallery | 16:10 (landscape) / 1:2 (portrait) — ikuti pola di `gallery.js` |
| quote | 1:1 |
| story | 16:10 |

Interaksi: seret untuk menggeser (ubah `focalX/focalY`), slider untuk zoom.
Simpan saat tombol Simpan ditekan, bukan tiap gerakan.

---

## 9. Halaman admin

Berkas: `admin.html`, `assets/css/admin.css`, `assets/js/admin/*.js`.
Tanpa framework — ikuti gaya kode yang sudah ada (vanilla, modul per fungsi,
komentar berbahasa Indonesia yang menjelaskan **kenapa**, bukan apa).

Struktur:

1. **Layar login** — field "Nama pengguna" + "Kata sandi" →
   `supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password })`.
   Sesi disimpan Supabase (localStorage) sehingga tidak perlu login ulang tiap
   buka. Tombol keluar memanggil `signOut()`.
2. **Tab Teks** — form yang mencerminkan struktur `content`. Bagian berulang
   (`loveStory`, `gift.accounts`, `dresscode.colors`) bisa ditambah/dihapus/
   diurutkan. Tombol Simpan → `upsert` ke `site_content`.
3. **Tab Foto** — pilih folder → grid foto:
   - unggah banyak sekaligus (konversi WebP + resize di browser),
   - hapus (hapus baris DB **dan** objek di Storage),
   - urutkan dengan seret (`sort_order` ditulis ulang berurutan saat simpan),
   - klik foto → editor pan/zoom (§8).
4. **Tautan pratinjau** ke `index.html` di tab baru.

Peringatan jumlah minimum: slider `bride`, `groom`, `event`, `wfl` memakai
Swiper `loop: true`. Swiper butuh cukup slide untuk melooping mulus —
**tampilkan peringatan di admin bila foto < 6** di folder-folder itu. Ini
alasan `config.js` sekarang menuliskan "Minimal 6 foto agar loop Swiper aman".

---

## 10. Urutan eksekusi

1. `npx supabase login` lalu `npx supabase link --project-ref rxqolwczphehbzrzmisa`.
2. Tulis `supabase/migrations/0002_admin_content.sql` (§3, §4, §5) →
   `npx supabase db push`.
3. Matikan pendaftaran publik (§2.1) — **jangan dilewati**.
4. Buat user admin (Dashboard → Authentication → Add user → centang
   *Auto Confirm User*), email `admin@mitaandi.wedding`, password sesuai §2.1.
5. Tulis & jalankan `scripts/seed-supabase.mjs` (§6). Cek di Dashboard: jumlah
   baris `photos` per folder cocok dengan jumlah file di folder lokal.
6. Bangun `admin.html` (§9). Uji login, ubah satu teks, unggah satu foto,
   ubah urutan, atur pan/zoom.
7. Ubah sisi undangan (§7, §8). Uji dengan koneksi normal.
8. Uji cadangan: matikan jaringan → muat ulang → undangan harus tetap tampil
   dari `localStorage`; hapus `localStorage` juga → harus jatuh ke `config.js`
   dan foto lokal.
9. Commit & push. GitHub Pages otomatis membangun ulang.

---

## 11. Verifikasi

- [ ] Buka `admin.html` **tanpa login** → tidak ada data yang bisa diubah;
      coba `update` lewat konsol browser dengan anon key → ditolak RLS.
- [ ] Coba daftar akun baru lewat konsol (`supabase.auth.signUp`) → **harus gagal**.
- [ ] Ubah nama venue di admin → muat ulang undangan → berubah.
- [ ] Ubah urutan foto `wfl` → urutan di slider undangan ikut berubah.
- [ ] Atur pan/zoom satu foto `bride` → komposisi di HP sama dengan pratinjau admin.
- [ ] Atur zoom foto `cover` → **pastikan benar-benar berlaku** (ini yang paling
      mungkin gagal diam-diam karena Ken Burns, lihat §8).
- [ ] Network tab: hanya **satu** panggilan `rpc/get_invitation`, tidak ada lagi
      `fetch` ke `manifest.json`.
- [ ] Mode pesawat → undangan tetap tampil (cadangan `localStorage`).
- [ ] Halaman undangan tetap lolos: reveal jalan, slider autoplay jalan,
      musik jalan, RSVP terkirim.

---

## 12. Jebakan yang harus dihindari

1. **Jangan** menaruh password di JavaScript, sekalipun "hanya sementara".
   Repo ini publik dan halamannya ter-deploy.
2. **Jangan** memakai `service_role` key di `admin.html`. Kunci itu melewati
   seluruh RLS. Hanya untuk skrip lokal.
3. **Jangan lupa mematikan pendaftaran publik.** Tanpa itu, semua policy
   `to authenticated` di atas praktis terbuka untuk umum.
4. **Jangan** menghapus `assets/img/` atau `config.js` — keduanya jaring pengaman
   hari-H.
5. **Ken Burns menimpa `--zoom`** di folder cover/opening/closing (§8).
6. **Swiper `loop: true` butuh slide cukup banyak** — beri peringatan di admin
   bila foto < 6.
7. `photos.folder = 'story'` terikat urutan pada array `loveStory` lewat
   `sort_order`. Kalau admin menghapus satu babak cerita, foto pasangannya
   harus ikut ditangani — jangan sampai foto bergeser ke babak yang salah.
8. `main.js` sekarang berjalan sinkron saat `DOMContentLoaded`. Setelah diubah
   jadi menunggu payload, pastikan `initReveal()` tetap dipanggil **paling akhir**
   setelah seluruh konten dirender — kalau tidak, elemen yang belum ada saat
   pemindaian tidak akan pernah dapat animasi masuk.
9. Bucket `photos` bersifat publik. Jangan mengunggah apa pun ke situ selain
   foto yang memang untuk ditampilkan.
