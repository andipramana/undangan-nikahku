-- Migration 0022: Buku kontak admin (halaman panel "Kontak") — daftar kontak
-- bernama bebas yang admin bisa isi/import sendiri (CSV/Excel/vCard), dipakai
-- sebagai SUMBER untuk mengisi wa_contacts lewat tombol "Tambah dari kontak"
-- di halaman Kirim WhatsApp. Tabel ini terpisah dari wa_contacts — bukan
-- daftar kirim, murni buku alamat yang bisa dipakai berulang kali.
--
-- Pola RLS sama persis dengan wa_contacts (migration 0006/0010): admin-only
-- via can_access_invitation(invitation_id, array['admin']).

create table if not exists public.contact_lists (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_list_entries (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  list_id bigint not null references public.contact_lists(id) on delete cascade,
  name text not null,
  phone text not null,       -- dinormalisasi ke format 62xxxxxxxxxx sebelum disimpan, sama seperti wa_contacts
  created_at timestamptz not null default now()
);

create index if not exists contact_lists_invitation_idx on public.contact_lists(invitation_id, created_at desc);
create index if not exists contact_list_entries_list_idx on public.contact_list_entries(list_id, name);
create index if not exists contact_list_entries_invitation_idx on public.contact_list_entries(invitation_id);

alter table public.contact_lists enable row level security;
alter table public.contact_list_entries enable row level security;

create policy "tenant admins manage contact lists" on public.contact_lists
  for all to authenticated
  using (public.can_access_invitation(invitation_id, array['admin']))
  with check (public.can_access_invitation(invitation_id, array['admin']));

create policy "tenant admins manage contact list entries" on public.contact_list_entries
  for all to authenticated
  using (public.can_access_invitation(invitation_id, array['admin']))
  with check (public.can_access_invitation(invitation_id, array['admin']));

grant all on public.contact_lists, public.contact_list_entries to authenticated;
