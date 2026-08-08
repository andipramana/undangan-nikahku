-- Migration 0009: "new row violates row-level security policy for table
-- wishes" (kode 42501) masih muncul walau migration 0008 (GRANT) sudah
-- dijalankan — berarti bukan cuma soal GRANT, kebijakan RLS insert untuk
-- anon di tabel wishes sendiri tampaknya tidak ada/tidak sesuai lagi di
-- database (migration 0001 seharusnya membuatnya, tapi bisa saja waktu itu
-- tidak ke-paste utuh, atau policy-nya sempat berubah lewat Dashboard).
--
-- Migrasi ini AMAN dijalankan berkali-kali (drop-if-exists lalu create
-- ulang) — tidak peduli kondisi sekarang persis apa, hasil akhirnya pasti
-- anon boleh insert wishes.
--
-- Cara menjalankan: paste seluruh file ini di SQL Editor (Supabase Dashboard).

drop policy if exists "public can insert wishes" on public.wishes;
create policy "public can insert wishes"
  on public.wishes for insert
  to anon
  with check (true);

drop policy if exists "public can read wishes" on public.wishes;
create policy "public can read wishes"
  on public.wishes for select
  to anon
  using (true);

-- Ulangi GRANT (migration 0008) — tidak masalah dijalankan dua kali, jaga-jaga
-- kalau migration itu belum sempat dijalankan atau urutannya kebalik.
grant select, insert on public.wishes to anon;
