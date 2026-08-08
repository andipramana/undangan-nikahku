-- Multi-tenant invitations: one static frontend, many invitation slugs.
-- SECURITY MODEL
-- * root_owner: may access every invitation.
-- * invitation_members: an authenticated user is bound to exactly the invitations
--   assigned here, with role admin or admin_qr.
-- * Every tenant-owned row carries invitation_id and every RLS policy checks it.
--   Changing a URL or calling PostgREST manually cannot cross the boundary.

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

insert into public.invitations (slug, display_name)
values ('root', 'Mita & Andi')
on conflict (slug) do nothing;

do $$ begin
  create type public.invitation_member_role as enum ('admin', 'admin_qr');
exception when duplicate_object then null;
end $$;
create table if not exists public.invitation_members (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.invitation_member_role not null,
  created_at timestamptz not null default now(),
  primary key (invitation_id, user_id),
  unique (user_id, invitation_id)
);

-- Add tenant keys and assign every old row to the original root invitation.
alter table public.site_content add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
alter table public.photos add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
alter table public.wishes add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
alter table public.checkins add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
alter table public.wa_templates add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
alter table public.wa_contacts add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
alter table public.wa_settings add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;

do $$
declare root_id uuid;
begin
  select id into root_id from public.invitations where slug = 'root';
  update public.site_content set invitation_id = root_id where invitation_id is null;
  update public.photos set invitation_id = root_id where invitation_id is null;
  update public.wishes set invitation_id = root_id where invitation_id is null;
  update public.checkins set invitation_id = root_id where invitation_id is null;
  update public.wa_templates set invitation_id = root_id where invitation_id is null;
  update public.wa_contacts set invitation_id = root_id where invitation_id is null;
  update public.wa_settings set invitation_id = root_id where invitation_id is null;
end $$;

-- Replace old one-row constraints/primary keys with one row per invitation.
alter table public.site_content drop constraint if exists site_content_single_row;
alter table public.site_content drop constraint if exists site_content_pkey;
alter table public.site_content alter column invitation_id set not null;
alter table public.site_content add primary key (invitation_id, id);

alter table public.wa_settings drop constraint if exists wa_settings_single_row;
alter table public.wa_settings drop constraint if exists wa_settings_pkey;
alter table public.wa_settings alter column invitation_id set not null;
alter table public.wa_settings add primary key (invitation_id, id);

alter table public.photos alter column invitation_id set not null;
alter table public.photos drop constraint if exists photos_storage_path_key;
alter table public.photos add constraint photos_invitation_storage_path_key unique (invitation_id, storage_path);
alter table public.wishes alter column invitation_id set not null;
alter table public.checkins alter column invitation_id set not null;
alter table public.wa_templates alter column invitation_id set not null;
alter table public.wa_contacts alter column invitation_id set not null;

-- Existing IDs/keys were only globally unique before multi-tenant. Make check-in
-- uniqueness tenant-local so the same guest can check in at different weddings.
alter table public.checkins drop constraint if exists checkins_pkey;
alter table public.checkins add primary key (invitation_id, guest_key);

create index if not exists photos_invitation_folder_order_idx on public.photos(invitation_id, folder, sort_order, id);
create index if not exists wishes_invitation_created_idx on public.wishes(invitation_id, created_at desc);
create index if not exists checkins_invitation_created_idx on public.checkins(invitation_id, checked_in_at desc);
create index if not exists wa_contacts_invitation_created_idx on public.wa_contacts(invitation_id, created_at desc);

-- Preserve the current root operators without exposing roles to the browser.
-- Existing main admin becomes the sole root owner; existing QR staff is attached
-- only to the root invitation. No account or invitation data is deleted.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"root_owner"}'::jsonb
where email = 'admin@mitaandi.wedding';

insert into public.invitation_members (invitation_id, user_id, role)
select i.id, u.id, 'admin_qr'::public.invitation_member_role
from public.invitations i cross join auth.users u
where i.slug = 'root'
  and u.email = 'admin-qr@mitaandi.wedding'
on conflict (invitation_id, user_id) do update set role = excluded.role;

-- `root_owner` is placed in immutable app_metadata. Tenant roles live in
-- invitation_members, never client metadata.
create or replace function public.is_root_owner()
returns boolean language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'root_owner';
$$;

create or replace function public.invitation_role(p_invitation_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when public.is_root_owner() then 'root_owner'
    else (select role::text from public.invitation_members
          where invitation_id = p_invitation_id and user_id = auth.uid())
  end;
$$;

create or replace function public.can_access_invitation(p_invitation_id uuid, p_roles text[] default array['admin','admin_qr'])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_root_owner()
    or exists (
      select 1 from public.invitation_members
      where invitation_id = p_invitation_id
        and user_id = auth.uid()
        and role::text = any(p_roles)
    );
$$;

grant execute on function public.is_root_owner() to authenticated;
grant execute on function public.invitation_role(uuid) to authenticated;
grant execute on function public.can_access_invitation(uuid, text[]) to authenticated;

alter table public.invitations enable row level security;
alter table public.invitation_members enable row level security;
create policy "public reads active invitations" on public.invitations for select to anon, authenticated using (is_active or public.is_root_owner());
create policy "owner manages invitations" on public.invitations for all to authenticated using (public.is_root_owner()) with check (public.is_root_owner());
create policy "members read only their membership" on public.invitation_members for select to authenticated using (user_id = auth.uid() or public.is_root_owner());
grant select on public.invitations to anon, authenticated;
grant select on public.invitation_members to authenticated;

-- Remove all legacy broad policies before creating tenant-scoped policies.
drop policy if exists "anon read content" on public.site_content;
drop policy if exists "admin write content" on public.site_content;
drop policy if exists "anon read photos" on public.photos;
drop policy if exists "admin write photos" on public.photos;
drop policy if exists "public can insert wishes" on public.wishes;
drop policy if exists "public can read wishes" on public.wishes;
drop policy if exists "admin read wishes" on public.wishes;
drop policy if exists "admin delete wishes" on public.wishes;
drop policy if exists "admin read checkins" on public.checkins;
drop policy if exists "admin delete checkins" on public.checkins;
drop policy if exists "admin all wa_templates" on public.wa_templates;
drop policy if exists "admin all wa_contacts" on public.wa_contacts;
drop policy if exists "admin all wa_settings" on public.wa_settings;

create policy "public reads invitation content" on public.site_content for select to anon, authenticated using (exists (select 1 from public.invitations i where i.id = invitation_id and i.is_active));
create policy "tenant admins write content" on public.site_content for all to authenticated using (public.can_access_invitation(invitation_id, array['admin','admin_qr'])) with check (public.can_access_invitation(invitation_id, array['admin','admin_qr']));
create policy "public reads invitation photos" on public.photos for select to anon, authenticated using (exists (select 1 from public.invitations i where i.id = invitation_id and i.is_active));
create policy "tenant admins write photos" on public.photos for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));
create policy "public reads invitation wishes" on public.wishes for select to anon using (exists (select 1 from public.invitations i where i.id = invitation_id and i.is_active));
create policy "public inserts invitation wishes" on public.wishes for insert to anon with check (exists (select 1 from public.invitations i where i.id = invitation_id and i.is_active));
create policy "tenant admins manage wishes" on public.wishes for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));
create policy "tenant staff read checkins" on public.checkins for select to authenticated using (public.can_access_invitation(invitation_id));
create policy "tenant staff delete checkins" on public.checkins for delete to authenticated using (public.can_access_invitation(invitation_id));
create policy "tenant admins manage wa templates" on public.wa_templates for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));
create policy "tenant admins manage wa contacts" on public.wa_contacts for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));
create policy "tenant admins manage wa settings" on public.wa_settings for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));

-- Storage isolation is enforced from the first path segment: slug/folder/file.
drop policy if exists "public read photos bucket" on storage.objects;
drop policy if exists "admin manage photos bucket" on storage.objects;
create policy "public reads invitation photo objects" on storage.objects for select to anon, authenticated using (bucket_id = 'photos');
create policy "tenant admins manage own photo objects" on storage.objects for all to authenticated
using (
  bucket_id = 'photos' and (
    public.is_root_owner()
    or public.can_access_invitation((select id from public.invitations where slug = (storage.foldername(name))[1]), array['admin'])
  )
)
with check (
  bucket_id = 'photos' and (
    public.is_root_owner()
    or public.can_access_invitation((select id from public.invitations where slug = (storage.foldername(name))[1]), array['admin'])
  )
);

-- Public payload is slug-scoped; no table endpoint is needed by the invitation.
create or replace function public.get_invitation(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('id', i.id, 'slug', i.slug, 'displayName', i.display_name),
    'content', (select content from public.site_content where invitation_id = i.id),
    'photos', coalesce((select jsonb_object_agg(folder, arr) from (
      select folder, jsonb_agg(jsonb_build_object('id', id, 'path', storage_path, 'alt', alt, 'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom, 'width', width, 'height', height) order by sort_order, id) arr
      from public.photos where invitation_id = i.id group by folder
    ) grouped), '{}'::jsonb)
  ) from public.invitations i where i.slug = p_slug and i.is_active;
$$;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Context endpoint makes route authorization explicit in the UI. RLS remains the
-- authoritative barrier for every actual read/write.
create or replace function public.get_my_invitation_access(p_slug text)
returns table(invitation_id uuid, slug text, role text)
language sql stable security definer set search_path = public as $$
  select i.id, i.slug, public.invitation_role(i.id)
  from public.invitations i
  where i.slug = p_slug and public.can_access_invitation(i.id);
$$;
grant execute on function public.get_my_invitation_access(text) to authenticated;

-- Check-in is now tenant scoped and validates that the scanned URL's slug matches.
create or replace function public.checkin_guest(p_invitation_id uuid, p_to text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_key text := lower(trim(p_to)); v_count int; v_row public.checkins; v_inserted public.checkins;
begin
  if not public.can_access_invitation(p_invitation_id) then raise exception 'Tidak berhak mengakses undangan ini'; end if;
  if v_key = '' then raise exception 'Nama tamu kosong'; end if;
  select guest_count into v_count from public.wishes where invitation_id = p_invitation_id and lower(trim(name)) = v_key order by created_at desc limit 1;
  insert into public.checkins (invitation_id, guest_key, guest_name, guest_count) values (p_invitation_id, v_key, p_to, coalesce(v_count, 1)) on conflict (invitation_id, guest_key) do nothing returning * into v_inserted;
  select * into v_row from public.checkins where invitation_id = p_invitation_id and guest_key = v_key;
  return jsonb_build_object('guestName', v_row.guest_name, 'guestCount', v_row.guest_count, 'checkedInAt', v_row.checked_in_at, 'already', v_inserted is null);
end;
$$;
revoke execute on function public.checkin_guest(text) from public, anon, authenticated;
grant execute on function public.checkin_guest(uuid, text) to authenticated;

-- Run ONCE after this migration for the existing owner account, replacing email:
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"root_owner"}'::jsonb where email = 'admin@mitaandi.wedding';
-- New tenant accounts are created only by the deployable Edge Function
-- supabase/functions/provision-invitation. Never expose SERVICE_ROLE in browser code.
