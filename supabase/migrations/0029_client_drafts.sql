-- Draft client dari halaman publik /catin.
--
-- Calon pengantin mengisi data undangan lewat form tanpa login; hasilnya
-- disimpan sebagai DRAFT. Root owner lalu membuat client baru langsung dari
-- draft itu (Edge Function provision-invitation, action `create` + draftId),
-- jadi data tidak perlu diketik ulang.
--
-- Keamanan: tabel TERTUTUP untuk anon (tanpa policy sama sekali). Satu-satunya
-- pintu masuk publik adalah RPC submit_client_draft, yang memvalidasi isian,
-- menolak bot (kolom jebakan), dan membatasi laju per perangkat serta global.
-- Membaca / mengubah / menghapus draft hanya untuk root owner.

create table if not exists public.client_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'baru' check (status in ('baru', 'diproses', 'dibuat', 'ditolak')),
  contact_name text not null,
  contact_wa text not null,
  contact_email text not null,
  preferred_slug text not null default '',
  payload jsonb not null,
  device_token text,
  invitation_id uuid references public.invitations(id) on delete set null,
  note text not null default ''
);

create index if not exists client_drafts_created_idx on public.client_drafts (created_at desc);
create index if not exists client_drafts_device_idx on public.client_drafts (device_token, created_at desc);

alter table public.client_drafts enable row level security;

drop policy if exists "root owner manages client drafts" on public.client_drafts;
create policy "root owner manages client drafts" on public.client_drafts
  for all to authenticated
  using (public.is_root_owner())
  with check (public.is_root_owner());

revoke all on public.client_drafts from anon, authenticated;
grant select, update, delete on public.client_drafts to authenticated;   -- RLS membatasi ke root owner

create or replace function public.submit_client_draft(p_device_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_wa    text;
  v_email text;
  v_slug  text;
  v_token text := left(coalesce(p_device_token, ''), 80);
  v_id    uuid;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Data tidak valid';
  end if;

  -- Kolom jebakan: manusia tidak melihatnya, bot mengisinya. Pura-pura sukses,
  -- tidak disimpan, supaya bot tidak belajar bahwa ia ditolak.
  if btrim(coalesce(p_payload->>'website', '')) <> '' then
    return jsonb_build_object('id', gen_random_uuid(), 'code', 'TERIMA');
  end if;

  if length(p_payload::text) > 40000 then
    raise exception 'Data terlalu besar';
  end if;

  v_name  := btrim(coalesce(p_payload->>'contactName', ''));
  v_wa    := regexp_replace(coalesce(p_payload->>'contactWa', ''), '[^0-9+]', '', 'g');
  v_email := lower(btrim(coalesce(p_payload->>'contactEmail', '')));
  v_slug  := lower(btrim(coalesce(p_payload->>'preferredSlug', '')));

  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Nama kamu wajib diisi';
  end if;
  if length(v_wa) < 8 or length(v_wa) > 20 then
    raise exception 'Nomor WhatsApp tidak valid';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(v_email) > 120 then
    raise exception 'Email tidak valid';
  end if;
  if v_slug <> '' and (v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug) > 60) then
    raise exception 'Nama link hanya huruf kecil, angka, dan tanda hubung';
  end if;

  -- Batas laju: 5 kiriman per perangkat per jam, 60 per jam untuk semua.
  if v_token <> '' and (
    select count(*) from public.client_drafts
    where device_token = v_token and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Terlalu banyak pengiriman. Coba lagi nanti ya.';
  end if;
  if (select count(*) from public.client_drafts where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Sedang ramai. Coba lagi beberapa menit lagi ya.';
  end if;

  insert into public.client_drafts (contact_name, contact_wa, contact_email, preferred_slug, payload, device_token)
  values (v_name, v_wa, v_email, v_slug, p_payload - 'website', nullif(v_token, ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'code', upper(substr(replace(v_id::text, '-', ''), 1, 8)));
end;
$$;

revoke all on function public.submit_client_draft(text, jsonb) from public;
grant execute on function public.submit_client_draft(text, jsonb) to anon, authenticated;
