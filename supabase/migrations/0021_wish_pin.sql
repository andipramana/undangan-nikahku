-- Pin ucapan pilihan admin ke atas daftar (halaman tamu & panel) — sisanya
-- tetap urut created_at desc. RLS admin sudah "for all" (0010,
-- "tenant admins manage wishes"), tapi GRANT tabel untuk UPDATE belum pernah
-- diberikan ke authenticated (0003 cuma grant select,delete) — tanpa ini
-- toggle pin akan ditolak Postgres di level grant, sebelum RLS sempat dicek.
alter table public.wishes add column if not exists pinned boolean not null default false;
create index if not exists wishes_invitation_pinned_idx on public.wishes(invitation_id, pinned desc, created_at desc);
grant update on public.wishes to authenticated;
