-- Moderasi ucapan per-undangan. Pemblokiran memakai device token acak dari
-- browser (bukan IP); admin dapat memblokir perangkat yang mengirim spam tanpa
-- menyimpan fingerprint/IP. Enforcement terjadi di RPC database, bukan JS.
alter table public.wishes add column if not exists device_token uuid;
create index if not exists wishes_invitation_device_idx on public.wishes(invitation_id, device_token);

create table if not exists public.wish_blocks (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  device_token uuid not null,
  blocked_at timestamptz not null default now(),
  blocked_wish_id uuid references public.wishes(id) on delete set null,
  primary key (invitation_id, device_token)
);
create table if not exists public.wish_moderation (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  banned_words text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.wish_blocks enable row level security;
alter table public.wish_moderation enable row level security;
create policy "tenant admins manage wish blocks" on public.wish_blocks for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));
create policy "tenant admins manage wish moderation" on public.wish_moderation for all to authenticated using (public.can_access_invitation(invitation_id, array['admin'])) with check (public.can_access_invitation(invitation_id, array['admin']));
grant select, insert, update, delete on public.wish_blocks, public.wish_moderation to authenticated;

create or replace function public.submit_wish(
  p_invitation_id uuid, p_device_token uuid, p_name text, p_attendance text,
  p_guest_count integer, p_message text
) returns public.wishes
language plpgsql security definer set search_path = public as $$
declare v_words text; v_word text; v_wish public.wishes;
begin
  if p_device_token is null then raise exception 'Perangkat tidak valid.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.invitations where id=p_invitation_id and is_active) then raise exception 'Undangan tidak tersedia.' using errcode='P0001'; end if;
  if exists (select 1 from public.wish_blocks where invitation_id=p_invitation_id and device_token=p_device_token) then
    raise exception 'Doa baik akan kembali kepada orang yang mendoakan.' using errcode='P0001';
  end if;
  select banned_words into v_words from public.wish_moderation where invitation_id=p_invitation_id;
  for v_word in select lower(trim(x)) from unnest(string_to_array(coalesce(v_words,''), ',')) x where trim(x) <> '' loop
    if position(v_word in lower(coalesce(p_name,'') || ' ' || coalesce(p_message,''))) > 0 then
      raise exception 'Doa baik akan kembali kepada orang yang mendoakan.' using errcode='P0001';
    end if;
  end loop;
  insert into public.wishes(invitation_id, device_token, name, attendance, guest_count, message)
  values (p_invitation_id,p_device_token,trim(p_name),p_attendance,case when p_attendance='hadir' then greatest(1,least(4,coalesce(p_guest_count,1))) else 1 end,trim(p_message))
  returning * into v_wish;
  return v_wish;
end $$;
grant execute on function public.submit_wish(uuid,uuid,text,text,integer,text) to anon, authenticated;
-- Direct anonymous inserts bypass moderation; all guest submits must use RPC.
drop policy if exists "public inserts invitation wishes" on public.wishes;
revoke insert on public.wishes from anon;
