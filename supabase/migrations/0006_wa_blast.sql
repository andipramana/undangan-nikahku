-- Migration 0006: Tab "Kirim WA" di admin — template pesan + daftar kontak.
--
-- Akses dibatasi HANYA untuk role `admin` (fungsi jwt_role() dari migration
-- 0004). `admin_qr` sengaja TIDAK diberi akses: fitur broadcast tidak relevan
-- untuk peran check-in di pintu masuk.
--
-- Fitur ini BUKAN bulk-sender otomatis: tiap kontak = SATU tombol "Kirim" yang
-- membuka link wa.me — admin sendiri yang menekan tombol kirim final di aplikasi
-- WhatsApp. Tabel di bawah hanya menyimpan daftar kontak + template pesan, tidak
-- ada mekanisme pengiriman otomatis apa pun.
--
-- Cara menjalankan: paste seluruh file ini di SQL Editor (Supabase Dashboard).

create table if not exists public.wa_templates (
  id bigint generated always as identity primary key,
  name text not null,
  body text not null,        -- isi pesan, boleh berisi token ${tamu} ${CPP} ${CPW}
  created_at timestamptz not null default now()
);

create table if not exists public.wa_contacts (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,       -- SUDAH dinormalisasi ke format 62xxxxxxxxxx sebelum disimpan
  template_id bigint references public.wa_templates(id) on delete set null, -- null = pakai default
  sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.wa_templates enable row level security;
alter table public.wa_contacts enable row level security;

-- Hanya admin utama yang boleh menyentuh keduanya — akses penuh (baca, tulis,
-- hapus) untuk role admin, TIDAK ADA akses untuk anon/admin_qr.
create policy "admin all wa_templates" on public.wa_templates
  for all to authenticated
  using (jwt_role() = 'admin')
  with check (jwt_role() = 'admin');

create policy "admin all wa_contacts" on public.wa_contacts
  for all to authenticated
  using (jwt_role() = 'admin')
  with check (jwt_role() = 'admin');

grant all on public.wa_templates, public.wa_contacts to authenticated;
