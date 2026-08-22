-- Pencatat Kado & Amplop (halaman panel "kado"): daftar bernama bebas
-- (mis. "Amplop Pengantin Pria") + entri per pemberi. Model persis
-- contact_lists/contact_list_entries (0022) — tabel daftar + entri FK
-- cascade — cuma kolom entrinya beda: nama pemberi, barang (default
-- 'Amplop Uang'), jumlah nominal (boleh null), kuantiti (boleh null),
-- dan keterangan waktu terima H-/H/H+. RLS admin-only mengikuti pola 0022.
create table if not exists public.gift_lists (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.gift_list_entries (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  list_id bigint not null references public.gift_lists(id) on delete cascade,
  name text not null,
  item text not null default 'Amplop Uang',
  amount numeric,
  quantity integer,
  timing text check (timing in ('h-','h','h+')),
  created_at timestamptz not null default now()
);
create index if not exists gift_lists_invitation_idx on public.gift_lists(invitation_id, created_at desc);
create index if not exists gift_list_entries_list_idx on public.gift_list_entries(list_id, name);
create index if not exists gift_list_entries_invitation_idx on public.gift_list_entries(invitation_id);
alter table public.gift_lists enable row level security;
alter table public.gift_list_entries enable row level security;
create policy "tenant admins manage gift lists" on public.gift_lists
  for all to authenticated
  using (public.can_access_invitation(invitation_id, array['admin']))
  with check (public.can_access_invitation(invitation_id, array['admin']));
create policy "tenant admins manage gift list entries" on public.gift_list_entries
  for all to authenticated
  using (public.can_access_invitation(invitation_id, array['admin']))
  with check (public.can_access_invitation(invitation_id, array['admin']));
grant all on public.gift_lists, public.gift_list_entries to authenticated;
