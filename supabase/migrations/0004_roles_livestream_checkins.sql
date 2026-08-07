-- Migration 0004: Peran admin (admin / admin_qr) + livestream + check-in QR.
--
-- ⚠️ CARA MENJALANKAN — TIGA PASTE TERPISAH di SQL Editor (Supabase Dashboard):
--
--   PASTE #1 (SENDIRIAN — jebakan transaksi Postgres, lihat rencana §2.4):
--     alter type public.photo_folder add value 'gift_item';
--
--   PASTE #2: seluruh file ini dari "BAGIAN A" sampai akhir "BAGIAN C"
--     (jangan sertakan baris ALTER TYPE di atas — Postgres menolak memakai
--     nilai enum baru dalam transaksi yang sama dengan ALTER TYPE yang
--     menambahkannya).
--
--   PASTE #3 (setelah akun admin-qr dibuat di Dashboard, lihat BAGIAN D):
--     dua statement update app_metadata di BAGIAN D.
--
-- ---------------------------------------------------------------------------
-- BAGIAN A — Fungsi peran (dibaca policy RLS dari klaim JWT)
-- ---------------------------------------------------------------------------
-- `app_metadata` user Supabase Auth TIDAK bisa diubah dari client SDK — hanya
-- lewat service_role atau SQL Editor. Ini yang membuat pembatasan peran nyata
-- (ditegakkan database), bukan sekadar konvensi UI. Klaim role diisi manual di
-- BAGIAN D.
create or replace function public.jwt_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

-- ---------------------------------------------------------------------------
-- BAGIAN B — Redesain RLS per tabel
-- ---------------------------------------------------------------------------
-- Matriks akses tulis (baca publik tetap berlaku untuk tamu):
--   | Tabel            | admin   | admin_qr                          |
--   |------------------|---------|------------------------------------|
--   | site_content     | penuh   | HANYA key `livestream` di JSONB    |
--   | photos           | penuh   | tidak ada                          |
--   | wishes           | baca+   | tidak ada                          |
--   |                  | hapus   |                                    |
--   | checkins (baca+  | ya      | ya (tabel sempit/tak sensitif --   |
--   |   hapus)         |         | petugas pintu perlu batalkan salah |
--   |                  |         | pindai sendiri)                    |
--
-- Perbandingan `content - 'livestream'` sebelum/sesudah menjamin admin_qr
-- hanya boleh mengubah key itu — walau dia mengirim objek utuh lewat query
-- manual, RLS menolaknya karena sisa objeknya tidak sama dengan yang ada di
-- database.

-- 1) site_content
drop policy if exists "admin write content" on public.site_content;
create policy "admin write content" on public.site_content
  for all to authenticated
  using (jwt_role() in ('admin', 'admin_qr'))
  with check (
    jwt_role() = 'admin'
    or (
      jwt_role() = 'admin_qr'
      and (content - 'livestream') = (select content - 'livestream' from public.site_content where id = 1)
    )
  );

-- 2) photos — admin_qr tidak boleh menyentuh foto sama sekali
drop policy if exists "admin write photos" on public.photos;
create policy "admin write photos" on public.photos
  for all to authenticated
  using (jwt_role() = 'admin')
  with check (jwt_role() = 'admin');

-- 3) wishes — admin_qr tidak boleh membaca maupun menghapus ucapan
drop policy if exists "admin read wishes" on public.wishes;
create policy "admin read wishes" on public.wishes
  for select to authenticated
  using (jwt_role() = 'admin');

drop policy if exists "admin delete wishes" on public.wishes;
create policy "admin delete wishes" on public.wishes
  for delete to authenticated
  using (jwt_role() = 'admin');

-- Storage: RLS baris photos sudah dibatasi di atas, tapi policy bucket 'photos'
-- dari migration 0002 terbuka untuk SEMUA yang login — dengan itu admin_qr
-- masih bisa menghapus/mengunggah file tanpa bisa menyentuh barisnya. Tutup.
drop policy if exists "admin manage photos bucket" on storage.objects;
create policy "admin manage photos bucket" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos' and jwt_role() = 'admin')
  with check (bucket_id = 'photos' and jwt_role() = 'admin');

-- ---------------------------------------------------------------------------
-- BAGIAN C — Tabel checkins + fungsi checkin_guest()
-- ---------------------------------------------------------------------------
create table if not exists public.checkins (
  guest_key text primary key,        -- lower(trim(param "to")) — unik per nama
  guest_name text not null,          -- nama asli (apa adanya dari param "to")
  guest_count int not null default 1,
  checked_in_at timestamptz not null default now()
);

alter table public.checkins enable row level security;

-- SENGAJA tidak ada policy insert/update/delete untuk authenticated — satu-satunya
-- jalan masuk adalah fungsi checkin_guest() (SECURITY DEFINER) di bawah. Ini
-- menutup dua hal sekaligus: admin_qr tidak bisa menulis baris seenaknya, dan
-- race scan ganda ditangani on conflict di dalam fungsi, bukan di client.
create policy "admin read checkins" on public.checkins
  for select to authenticated
  using (jwt_role() in ('admin', 'admin_qr'));

-- Petugas di pintu masuk perlu bisa membatalkan salah pindai (QR keliru
-- terbaca, salah tamu, dsb) tanpa menunggu admin utama. Tabel ini sempit dan
-- tidak sensitif (cuma nama+jumlah+waktu check-in, tidak menyentuh
-- site_content/photos/wishes), jadi admin_qr diberi delete juga -- beda
-- dengan photos/wishes yang sengaja ditutup total untuknya.
-- (admin.html & admin-qr.html sama-sama sudah punya tombol Hapus dengan
-- konfirmasi untuk baris checkins; tanpa policy ini keduanya akan selalu
-- gagal dengan RLS menolak diam-diam.)
create policy "admin delete checkins" on public.checkins
  for delete to authenticated
  using (jwt_role() in ('admin', 'admin_qr'));

grant select, delete on public.checkins to authenticated;

-- Menulis lewat fungsi SECURITY DEFINER, bukan tabel langsung, karena:
--   1. admin_qr butuh membaca wishes.guest_count untuk "kalau tidak RSVP
--      hitung 1 orang" — padahal sengaja TIDAK diberi akses ke tabel wishes.
--      Fungsi boleh membaca wishes secara internal tanpa membocorkan akses
--      tabel itu ke client.
--   2. Dua scan cepat pada QR yang sama harus tetap menghasilkan satu baris —
--      ditangani `on conflict do nothing` di dalam fungsi.
create or replace function public.checkin_guest(p_to text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := lower(trim(p_to));
  v_count int;
  v_row public.checkins;
  v_inserted public.checkins;
begin
  if v_key = '' then
    raise exception 'Nama tamu kosong';
  end if;

  -- Jumlah orang dari RSVP terbaru (kalau ada); tanpa RSVP = 1.
  select guest_count into v_count
    from public.wishes
    where lower(trim(name)) = v_key
    order by created_at desc
    limit 1;

  -- Deteksi "sudah pernah check-in" yang AKURAT: kalau INSERT mengembalikan
  -- baris, ini check-in pertama (already = false); kalau batal karena konflik
  -- kunci (sudah ada barisnya), already = true. Bukan perbandingan waktu yang
  -- rapuh.
  insert into public.checkins (guest_key, guest_name, guest_count)
  values (v_key, p_to, coalesce(v_count, 1))
  on conflict (guest_key) do nothing
  returning * into v_inserted;

  select * into v_row from public.checkins where guest_key = v_key;

  return jsonb_build_object(
    'guestName', v_row.guest_name,
    'guestCount', v_row.guest_count,
    'checkedInAt', v_row.checked_in_at,
    'already', v_inserted is null
  );
end;
$$;

-- Hanya pengguna login yang boleh memanggil — tanpa ini, siapa pun (anon)
-- bisa menandai tamu "sudah hadir" tanpa benar-benar memindai QR.
revoke execute on function public.checkin_guest(text) from public, anon;
grant execute on function public.checkin_guest(text) to authenticated;

-- ---------------------------------------------------------------------------
-- BAGIAN D — Setup akun (PASTE #3, langkah manual setelah akun dibuat)
-- ---------------------------------------------------------------------------
-- 1. Buat user Auth kedua di Dashboard → Authentication → Users → Add user:
--    email admin-qr@mitaandi.wedding, password bebas, centang "Auto Confirm
--    User".
-- 2. Jalankan dua statement di bawah. WAJIB untuk KEDUA akun — akun admin lama
--    belum punya klaim role sama sekali, dan tanpa itu ia pun gagal lolos
--    policy baru yang mensyaratkan jwt_role() in ('admin','admin_qr').
--    (Aman dijalankan sebelum akun admin-qr dibuat: barisnya hanya meng-update
--    0 baris, tanpa error.)
--
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--   where email = 'admin@mitaandi.wedding';
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin_qr"}'::jsonb
--   where email = 'admin-qr@mitaandi.wedding';
