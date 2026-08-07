-- Migration 0005: Perbaiki rekursi tak berhingga pada policy site_content.
--
-- ⚠️ CARA MENJALANKAN — SATU PASTE di SQL Editor (Supabase Dashboard):
--   Salin seluruh isi file ini (dari BAGIAN A sampai akhir) dan jalankan
--   SEKALI jalan. Tidak ada jebakan ALTER TYPE di sini (beda dengan 0004),
--   jadi tidak perlu dipecah menjadi beberapa paste.
--
--   Syarat: migration 0004 sudah dijalankan dulu (fungsi jwt_role() dan
--   policy "admin write content" versi lama harus sudah ada), dan klaim
--   role di app_metadata sudah diisi (BAGIAN D 0004).
--
-- ---------------------------------------------------------------------------
-- LATAR BELAKANG (bug produksi)
-- ---------------------------------------------------------------------------
-- Policy "admin write content" dari 0004 membatasi admin_qr "hanya boleh
-- mengubah key `livestream`" lewat subquery di WITH CHECK:
--
--     and (content - 'livestream') =
--         (select content - 'livestream' from public.site_content where id = 1)
--
-- Subquery yang membaca tabel site_content SENDIRI di dalam policy RLS
-- site_content selalu memicu evaluasi RLS untuk tabel yang sama, dan karena
-- policy itu sendiri dievaluasi lagi di dalamnya, Postgres menemukan rekursi
-- tak berhingga dan membatalkan query:
--     ERROR: infinite recursion detected in policy for relation "site_content"
-- Akibatnya, SETIAP percobaan simpan oleh admin_qr (saveLivestream → upsert
-- id=1) gagal, walau yang diubah memang cuma key livestream.
--
-- PERBAIKAN: pindahkan pembatasan per-key keluar dari RLS ke trigger.
-- Trigger BEFORE UPDATE punya akses langsung ke OLD/NEW row — ia membandingkan
-- konten lama vs baru TANPA subquery SELECT ke tabel yang sama, sehingga tidak
-- melewati evaluasi RLS sama sekali dan tidak ada rekursi. Peran admin tetap
-- tidak tersentuh: trigger hanya menegakkan batasan untuk jwt_role()='admin_qr'.
--
-- ---------------------------------------------------------------------------
-- BAGIAN A — Policy tanpa subquery
-- ---------------------------------------------------------------------------
-- Pembatasan "cuma boleh ubah key livestream" TIDAK lagi di level RLS (itu
-- sumber rekursi). Policy ini hanya menegakkan "siapa yang boleh menyentuh
-- site_content": admin dan admin_qr. Batasan per-key dijalankan trigger di
-- BAGIAN B.
drop policy if exists "admin write content" on public.site_content;
create policy "admin write content" on public.site_content
  for all to authenticated
  using (jwt_role() in ('admin', 'admin_qr'))
  with check (jwt_role() in ('admin', 'admin_qr'));

-- ---------------------------------------------------------------------------
-- BAGIAN B — Trigger penjaga key `livestream` untuk admin_qr
-- ---------------------------------------------------------------------------
-- Function trigger (bukan SECURITY DEFINER — ia tidak butuh hak ekstra:
-- OLD/NEW row dan jwt_role() bisa dibaca dengan hak pemanggil). Untuk
-- admin_qr, perubahan apa pun di luar key `livestream` ditolak; admin biasa
-- tidak kena cek ini.
create or replace function public.enforce_admin_qr_livestream_only()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if jwt_role() = 'admin_qr'
     and (coalesce(old.content, '{}'::jsonb) - 'livestream')
         is distinct from (coalesce(new.content, '{}'::jsonb) - 'livestream')
  then
    raise exception 'admin_qr hanya boleh mengubah key livestream di site_content';
  end if;
  return new;
end;
$$;

-- BEFORE UPDATE (bukan AFTER): menolak sebelum baris tertulis, jadi tidak
-- pernah ada perubahan separuh jalan. Upsert dengan konflik (onConflict id)
-- dari saveLivestream lewat jalur UPDATE — ikut kena trigger ini.
drop trigger if exists trg_site_content_admin_qr_livestream on public.site_content;
create trigger trg_site_content_admin_qr_livestream
  before update on public.site_content
  for each row
  execute function public.enforce_admin_qr_livestream_only();
