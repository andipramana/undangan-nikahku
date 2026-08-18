-- Migration 0023: Daftar kirim WA bisa dipecah jadi beberapa list per
-- undangan (mis. "Kontak Pengantin Pria", "Kontak Pengantin Wanita", "Kontak
-- Ortu Pria", "Kontak Ortu Wanita") — supaya kontak antar kelompok tidak
-- kecampur di satu daftar kirim.
--
-- wa_lists TERPISAH dari contact_lists (migration 0022, buku alamat sumber
-- impor) — wa_lists adalah pengelompokan daftar KIRIM itu sendiri (status
-- terkirim/belum melekat di wa_contacts per baris, bukan per list, jadi
-- pindah kelompok tidak mengubah status kirim).
--
-- Kontak lama (sebelum migration ini) tidak boleh hilang dari daftar kirim:
-- dibuatkan SATU list default "Kontak Andi" per undangan yang sudah punya
-- wa_contacts, semua baris lamanya dipindah ke situ. Undangan baru yang belum
-- pernah pakai WA tidak dapat list otomatis — dibuat manual pertama kali
-- dipakai (sama seperti alur halaman Kontak).

create table if not exists public.wa_lists (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.wa_contacts add column if not exists list_id bigint references public.wa_lists(id) on delete cascade;

do $$
declare
  inv record;
  new_list_id bigint;
begin
  for inv in select distinct invitation_id from public.wa_contacts where list_id is null loop
    insert into public.wa_lists (invitation_id, name) values (inv.invitation_id, 'Kontak Andi') returning id into new_list_id;
    update public.wa_contacts set list_id = new_list_id where invitation_id = inv.invitation_id and list_id is null;
  end loop;
end $$;

alter table public.wa_contacts alter column list_id set not null;

create index if not exists wa_lists_invitation_idx on public.wa_lists(invitation_id, created_at asc);
create index if not exists wa_contacts_list_idx on public.wa_contacts(list_id);

alter table public.wa_lists enable row level security;

create policy "tenant admins manage wa lists" on public.wa_lists
  for all to authenticated
  using (public.can_access_invitation(invitation_id, array['admin']))
  with check (public.can_access_invitation(invitation_id, array['admin']));

grant all on public.wa_lists to authenticated;
