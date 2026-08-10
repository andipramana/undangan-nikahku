-- Migration 0013 (gallery_photo_layout) tercatat "applied" di histori Supabase
-- CLI, tapi DDL-nya (ALTER TABLE photos ADD COLUMN gallery_layout/gallery_row)
-- ternyata tidak pernah benar-benar berlaku di database live — ditemukan saat
-- debugging bug galeri/Our Story (2026-08-10) dan lagi saat mencoba capture
-- default template snapshot (kolom dirujuk get_invitation()/admin photos.js/
-- Edge Function provision-invitation, semua akan gagal tanpa kolom ini).
--
-- IF NOT EXISTS pada kedua ADD COLUMN membuat ini aman dijalankan berulang
-- meski sebagian sudah ada.
alter table public.photos
  add column if not exists gallery_layout text not null default 'full'
  check (gallery_layout in ('full', 'half', 'third', 'twothirds')),
  add column if not exists gallery_row integer not null default 1
  check (gallery_row >= 1);

-- get_invitation() juga perlu dipastikan versi TERBARU (dari 0013) yang
-- menyertakan galleryLayout/galleryRow di payload foto — definisikan ulang
-- di sini supaya tidak bergantung pada migration 0013 yang historinya
-- meragukan. create or replace aman dijalankan berulang.
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
