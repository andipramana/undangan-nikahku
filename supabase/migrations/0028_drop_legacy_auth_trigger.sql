-- Provisioning client baru SELALU gagal dengan 400 "Database error creating new
-- user" dari action `create` di Edge Function provision-invitation, lalu
-- invitation-nya ikut di-rollback.
--
-- Akar masalahnya bukan di Edge Function: trigger `on_auth_user_created` pada
-- `auth.users` memanggil `public.handle_new_user()` (SECURITY DEFINER) yang
-- menyisipkan baris ke `public.profiles` dan `public.categories` — dua tabel
-- milik aplikasi keuangan lama yang SUDAH dihapus migration
-- 0018_drop_unrelated_legacy_tables.sql. Jadi setiap
-- `auth.admin.createUser()` meledak di dalam trigger.
--
-- Akun admin yang lama (mis. root_owner) lolos karena dibuat SEBELUM 0018.
--
-- Tidak ada fitur aktif yang memakai trigger ini: tabel tujuannya sudah tidak
-- ada, dan seluruh pembuatan anggota tenant berjalan lewat
-- `invitation_members` yang diisi eksplisit oleh Edge Function, bukan lewat
-- trigger auth.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
