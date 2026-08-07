-- Panel admin + konten dari Supabase (lihat docs/rencana-admin-panel.md).
-- Tiga lapisan:
--   1. site_content  — seluruh teks undangan dalam SATU baris JSONB (id=1).
--   2. photos        — katalog foto per folder + pan/zoom (focal/zoom), urutan eksplisit.
--   3. storage       — bucket 'photos' (public read), RLS tulis hanya untuk authenticated.
--   4. RPC get_invitation() — sekali panggil, tamu dapat teks + seluruh foto terurut.

-- ---------------------------------------------------------------------------
-- 3.1 Tabel site_content — seluruh teks dalam satu baris JSONB
-- ---------------------------------------------------------------------------
-- JSONB dipilih karena strukturnya bersarang dan berisi array berurutan
-- (loveStory, gift.accounts, dresscode.colors) — memecahnya jadi tabel
-- relasional menambah kerja tanpa manfaat (tidak ada yang perlu di-query
-- per-field). Satu baris (id=1) dijamin oleh check constraint.
create table if not exists public.site_content (
  id smallint primary key default 1,
  content jsonb not null,
  updated_at timestamptz not null default now(),
  constraint site_content_single_row check (id = 1)
);

-- ---------------------------------------------------------------------------
-- 3.2 Tabel photos
-- ---------------------------------------------------------------------------
create type public.photo_folder as enum (
  'cover', 'opening', 'closing',
  'bride', 'groom',
  'wfl',        -- We Found Love (dulu foto_slider_section_1)
  'event',      -- slider kartu event (dulu foto_slider_section_2)
  'gallery',
  'quote',      -- satu foto full-width 1:1
  'story'       -- foto per babak Our Story
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  folder public.photo_folder not null,
  storage_path text not null unique,   -- relatif terhadap bucket, mis. 'bride/01.webp'
  sort_order int not null default 0,
  focal_x numeric(5,2) not null default 50,   -- persen, untuk object-position
  focal_y numeric(5,2) not null default 50,
  zoom numeric(4,2) not null default 1,       -- 1.00 - 3.00
  alt text not null default '',
  width int,
  height int,
  created_at timestamptz not null default now(),
  -- Nilai pan/zoom dijamin wajar oleh basis data, bukan cuma oleh form admin —
  -- bug di JS tidak boleh menghasilkan foto yang di-zoom 9x.
  constraint photos_zoom_range check (zoom >= 1 and zoom <= 3),
  constraint photos_focal_x_range check (focal_x between 0 and 100),
  constraint photos_focal_y_range check (focal_y between 0 and 100)
);

create index if not exists photos_folder_order_idx
  on public.photos (folder, sort_order, id);

-- ---------------------------------------------------------------------------
-- 3.3 RLS
-- ---------------------------------------------------------------------------
alter table public.site_content enable row level security;
alter table public.photos       enable row level security;

-- Tamu (anon) hanya boleh membaca.
create policy "anon read content" on public.site_content
  for select to anon, authenticated using (true);
create policy "anon read photos" on public.photos
  for select to anon, authenticated using (true);

-- Hanya yang sudah login yang boleh menulis.
create policy "admin write content" on public.site_content
  for all to authenticated using (true) with check (true);
create policy "admin write photos" on public.photos
  for all to authenticated using (true) with check (true);

-- Supabase tidak lagi auto-expose tabel baru ke PostgREST — grant eksplisit
-- wajib, kalau tidak semua query anon/authenticated ditolak walau RLS lolos.
grant select on public.site_content to anon, authenticated;
grant select, insert, update, delete on public.photos to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage — bucket 'photos', public read, tulis hanya untuk authenticated
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "public read photos bucket" on storage.objects
  for select to anon, authenticated using (bucket_id = 'photos');

create policy "admin manage photos bucket" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos') with check (bucket_id = 'photos');

-- ---------------------------------------------------------------------------
-- 5. Sekali fetch — RPC get_invitation()
-- ---------------------------------------------------------------------------
create or replace function public.get_invitation()
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'content', (select content from public.site_content where id = 1),
    'photos', coalesce((
      select jsonb_object_agg(folder, arr) from (
        select folder,
               jsonb_agg(
                 jsonb_build_object(
                   'id', id, 'path', storage_path, 'alt', alt,
                   'focalX', focal_x, 'focalY', focal_y, 'zoom', zoom,
                   'width', width, 'height', height
                 ) order by sort_order, id
               ) as arr
        from public.photos
        group by folder
      ) t
    ), '{}'::jsonb)
  );
$$;

grant execute on function public.get_invitation() to anon, authenticated;
