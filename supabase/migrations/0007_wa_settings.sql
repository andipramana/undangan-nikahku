-- Migration 0007: Pengaturan tab "Kirim WA" — link undangan + template default.
--
-- SATU baris saja (id=1, dipaksa constraint check). `invitation_link` = base URL
-- undangan yang disisipkan lewat token ${link} di pesan WA; `default_template`
-- = isi pesan bawaan untuk kontak tanpa template kustom.
--
-- `default_template` sengaja default '' (kosong): kosong berarti "belum pernah
-- diedit admin", dan JS memakai teks sopan bawaan di wa-blast.js. Teks default
-- TIDAK ditulis ke DB langsung supaya kalau teks bawaan di JS diperbarui lagi,
-- baris yang belum pernah diedit admin ikut update otomatis.
--
-- Akses dibatasi HANYA untuk role `admin` — fungsi jwt_role() dan pola grant
-- PERSIS sama dengan migration 0006 (wa_templates/wa_contacts).
--
-- Cara menjalankan: paste seluruh file ini di SQL Editor (Supabase Dashboard).

create table if not exists public.wa_settings (
  id int primary key default 1,
  invitation_link text not null default 'https://undangan.andipramana.com/',
  default_template text not null default '',
  constraint wa_settings_single_row check (id = 1)
);
insert into public.wa_settings (id) values (1) on conflict (id) do nothing;

alter table public.wa_settings enable row level security;

create policy "admin all wa_settings" on public.wa_settings
  for all to authenticated
  using (jwt_role() = 'admin') with check (jwt_role() = 'admin');

grant all on public.wa_settings to authenticated;
