-- Migration 0008: perbaiki "kirim ucapan gagal" (403 / kode 42501,
-- insufficient_privilege) di halaman tamu.
--
-- Migration 0001 sudah membuat policy RLS "public can insert wishes" (anon,
-- with check true) dan "public can read wishes" (anon, using true) — tapi
-- TIDAK PERNAH memberi GRANT di level tabel untuk role anon. RLS policy dan
-- GRANT tabel adalah dua lapis izin terpisah di Postgres: tanpa GRANT, role
-- anon ditolak SEBELUM RLS sempat dievaluasi sama sekali, walau policy-nya
-- sudah benar. Tabel lain di proyek ini (wa_templates, wa_contacts,
-- wa_settings, checkins) semuanya sudah punya GRANT eksplisit — wishes
-- ketinggalan sejak migration 0001.
--
-- Cara menjalankan: paste seluruh file ini di SQL Editor (Supabase Dashboard).

grant select, insert on public.wishes to anon;
