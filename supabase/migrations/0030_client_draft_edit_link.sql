-- Calon pengantin bisa membaca ulang dan mengubah draft yang sudah dikirim.
--
-- Tanpa login, jadi identitasnya adalah KODE RAHASIA PANJANG (edit_token):
-- 64 karakter heksadesimal dari dua gen_random_uuid() (CSPRNG), diberikan
-- hanya kepada pengirim saat submit. Berbeda dari "kode" pendek 8 karakter yang
-- hanya label untuk ditanyakan ke admin dan TIDAK memberi akses apa pun.
--
-- Aturan: draft boleh diubah selama status 'baru' / 'diproses'. Begitu
-- dijadikan client ('dibuat') atau ditolak, hanya bisa dibaca — perubahan
-- selanjutnya lewat panel admin client, supaya tidak menimpa pekerjaan admin.

alter table public.client_drafts add column if not exists edit_token text;
alter table public.client_drafts add column if not exists updated_at timestamptz not null default now();

update public.client_drafts
   set edit_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
 where edit_token is null;

alter table public.client_drafts alter column edit_token set not null;
alter table public.client_drafts
  alter column edit_token set default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists client_drafts_edit_token_key on public.client_drafts (edit_token);

-- Validasi isian dipakai bersama oleh kirim & ubah. Tidak diekspos ke publik.
create or replace function public.check_draft_payload(p_payload jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_name  text;
  v_wa    text;
  v_email text;
  v_slug  text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Data tidak valid';
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

  return jsonb_build_object('name', v_name, 'wa', v_wa, 'email', v_email, 'slug', v_slug);
end;
$$;
revoke all on function public.check_draft_payload(jsonb) from public, anon, authenticated;

-- Kirim: sama seperti sebelumnya, kini mengembalikan edit_token (rahasia) juga.
create or replace function public.submit_client_draft(p_device_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := left(coalesce(p_device_token, ''), 80);
  v_norm  jsonb;
  v_id    uuid;
  v_edit  text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'Data tidak valid';
  end if;

  -- Kolom jebakan bot: pura-pura sukses, tidak disimpan.
  if btrim(coalesce(p_payload->>'website', '')) <> '' then
    return jsonb_build_object('id', gen_random_uuid(), 'code', 'TERIMA', 'editToken', '');
  end if;

  v_norm := public.check_draft_payload(p_payload);

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
  values (v_norm->>'name', v_norm->>'wa', v_norm->>'email', v_norm->>'slug', p_payload - 'website', nullif(v_token, ''))
  returning id, edit_token into v_id, v_edit;

  return jsonb_build_object('id', v_id, 'code', upper(substr(replace(v_id::text, '-', ''), 1, 8)), 'editToken', v_edit);
end;
$$;
revoke all on function public.submit_client_draft(text, jsonb) from public;
grant execute on function public.submit_client_draft(text, jsonb) to anon, authenticated;

-- Baca: kembalikan null (bukan galat) bila kode tidak dikenal, supaya tidak
-- membedakan "salah" dari "tidak ada".
create or replace function public.get_client_draft(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.client_drafts;
begin
  if length(coalesce(p_token, '')) < 32 or length(p_token) > 128 then
    return null;
  end if;
  select * into r from public.client_drafts where edit_token = p_token;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'code', upper(substr(replace(r.id::text, '-', ''), 1, 8)),
    'status', r.status,
    'editable', r.status in ('baru', 'diproses'),
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'payload', r.payload
  );
end;
$$;
revoke all on function public.get_client_draft(text) from public;
grant execute on function public.get_client_draft(text) to anon, authenticated;

-- Ubah: hanya selama belum dijadikan client.
create or replace function public.update_client_draft(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.client_drafts;
  v_norm jsonb;
begin
  if length(coalesce(p_token, '')) < 32 or length(p_token) > 128 then
    raise exception 'Link tidak valid';
  end if;
  select * into r from public.client_drafts where edit_token = p_token for update;
  if not found then
    raise exception 'Draft tidak ditemukan';
  end if;
  if r.status not in ('baru', 'diproses') then
    raise exception 'Datamu sudah diproses jadi undangan, jadi tidak bisa diubah dari sini. Hubungi kami ya.';
  end if;

  v_norm := public.check_draft_payload(p_payload);

  update public.client_drafts
     set contact_name = v_norm->>'name', contact_wa = v_norm->>'wa', contact_email = v_norm->>'email',
         preferred_slug = v_norm->>'slug', payload = p_payload - 'website', updated_at = now()
   where id = r.id;

  return jsonb_build_object('ok', true, 'code', upper(substr(replace(r.id::text, '-', ''), 1, 8)));
end;
$$;
revoke all on function public.update_client_draft(text, jsonb) from public;
grant execute on function public.update_client_draft(text, jsonb) to anon, authenticated;
