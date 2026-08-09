-- Per foto Galeri dapat memilih slotnya sendiri. Nilai ini dipakai satu sumber
-- oleh Foto admin, renderer undangan, dan Visual Editor.
alter table public.photos
  add column if not exists gallery_layout text not null default 'full'
  check (gallery_layout in ('full', 'half', 'third', 'twothirds')),
  add column if not exists gallery_row integer not null default 1
  check (gallery_row >= 1);

create or replace function public.get_invitation(p_slug text)
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
  ) from public.invitations i where i.slug = p_slug and i.is_active;
$$;

grant execute on function public.get_invitation(text) to anon, authenticated;
