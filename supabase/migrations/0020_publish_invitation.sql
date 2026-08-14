-- Fitur Publish: guest melihat snapshot yang dibekukan (published_content/
-- published_photos), bukan data live site_content/photos. Sebelum admin
-- pernah klik Publish, get_invitation() fallback ke live (coalesce) supaya
-- tenant lama/baru tidak tiba-tiba kosong.
alter table public.invitations
  add column if not exists content_updated_at timestamptz not null default now(),
  add column if not exists published_at timestamptz,
  add column if not exists published_content jsonb,
  add column if not exists published_photos jsonb;

-- Dirty-tracking di level DB: site_content.js/theme.js/fonts.js/template.js/
-- visual-editor.js/photos.js semuanya upsert langsung ke site_content/photos
-- tanpa helper bersama (6+ titik tulis independen) — trigger di sini satu-
-- satunya titik deteksi "ada perubahan belum dipublish", tidak perlu hook di
-- tiap file admin.
create or replace function public.touch_invitation_content_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.invitations
    set content_updated_at = now()
    where id = coalesce(new.invitation_id, old.invitation_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_site_content_touch on public.site_content;
create trigger trg_site_content_touch
  after insert or update or delete on public.site_content
  for each row execute function public.touch_invitation_content_updated_at();

drop trigger if exists trg_photos_touch on public.photos;
create trigger trg_photos_touch
  after insert or update or delete on public.photos
  for each row execute function public.touch_invitation_content_updated_at();

-- Dipanggil admin (role 'admin', bukan 'admin_qr') lewat tombol Publish:
-- membekukan site_content + photos live saat ini ke kolom published_*.
create or replace function public.publish_invitation(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_content jsonb;
  v_photos jsonb;
  v_published_at timestamptz := now();
begin
  if not public.can_access_invitation(p_invitation_id, array['admin']) then
    raise exception 'Tidak berhak mempublikasikan undangan ini';
  end if;

  select content into v_content from public.site_content
    where invitation_id = p_invitation_id and id = 1;

  select coalesce(jsonb_object_agg(folder, arr), '{}'::jsonb) into v_photos
  from (
    select folder, jsonb_agg(jsonb_build_object(
      'id', id, 'path', storage_path, 'alt', alt,
      'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom,
      'galleryLayout', gallery_layout, 'galleryRow', gallery_row, 'width', width, 'height', height
    ) order by sort_order, id) arr
    from public.photos where invitation_id = p_invitation_id group by folder
  ) grouped;

  update public.invitations
    set published_content = v_content,
        published_photos = v_photos,
        published_at = v_published_at
    where id = p_invitation_id;

  return jsonb_build_object('publishedAt', v_published_at);
end;
$$;
grant execute on function public.publish_invitation(uuid) to authenticated;

-- Dipakai tombol "Pratinjau undangan" di admin: kembalikan data LIVE (bentuk
-- sama persis dengan get_invitation() versi lama), tapi digerbangi akses
-- admin — supaya admin bisa lihat draft sebelum publish tanpa membuka draft
-- ke publik lewat get_invitation() biasa.
create or replace function public.get_invitation_draft(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('id', i.id, 'slug', i.slug, 'displayName', i.display_name),
    'content', (select content from public.site_content where invitation_id = i.id),
    'photos', coalesce((select jsonb_object_agg(folder, arr) from (
      select folder, jsonb_agg(jsonb_build_object(
        'id', id, 'path', storage_path, 'alt', alt,
        'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom,
        'galleryLayout', gallery_layout, 'galleryRow', gallery_row, 'width', width, 'height', height
      ) order by sort_order, id) arr
      from public.photos where invitation_id = i.id group by folder
    ) grouped), '{}'::jsonb)
  )
  from public.invitations i
  where i.slug = p_slug
    and i.is_active
    and public.can_access_invitation(i.id, array['admin', 'admin_qr']);
$$;
grant execute on function public.get_invitation_draft(text) to authenticated;

-- Guest-facing RPC: sekarang membaca snapshot published_*, fallback ke live
-- selama admin tenant itu belum pernah publish.
create or replace function public.get_invitation(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('id', i.id, 'slug', i.slug, 'displayName', i.display_name),
    'content', coalesce(i.published_content, (select content from public.site_content where invitation_id = i.id)),
    'photos', coalesce(i.published_photos, (select jsonb_object_agg(folder, arr) from (
      select folder, jsonb_agg(jsonb_build_object(
        'id', id, 'path', storage_path, 'alt', alt,
        'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom,
        'galleryLayout', gallery_layout, 'galleryRow', gallery_row, 'width', width, 'height', height
      ) order by sort_order, id) arr
      from public.photos where invitation_id = i.id group by folder
    ) grouped), '{}'::jsonb)
  ) from public.invitations i where i.slug = p_slug and i.is_active;
$$;
grant execute on function public.get_invitation(text) to anon, authenticated;

-- Backfill: tenant yang sudah live sebelum migration ini langsung dianggap
-- "sudah dipublikasikan" dengan konten mereka saat ini — supaya banner
-- "belum dipublikasikan" tidak muncul dadakan untuk konten yang sudah lama
-- tayang.
update public.invitations i set
  published_content = (select content from public.site_content where invitation_id = i.id),
  published_photos = coalesce((select jsonb_object_agg(folder, arr) from (
    select folder, jsonb_agg(jsonb_build_object(
      'id', id, 'path', storage_path, 'alt', alt,
      'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom,
      'galleryLayout', gallery_layout, 'galleryRow', gallery_row, 'width', width, 'height', height
    ) order by sort_order, id) arr
    from public.photos where invitation_id = i.id group by folder
  ) grouped), '{}'::jsonb),
  published_at = now(),
  content_updated_at = now()
where i.is_active;
