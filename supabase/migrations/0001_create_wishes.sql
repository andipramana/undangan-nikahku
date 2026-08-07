create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  attendance text not null check (attendance in ('hadir', 'tidak_hadir', 'ragu')),
  guest_count int not null default 1,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.wishes enable row level security;

create policy "public can insert wishes"
  on public.wishes for insert
  to anon
  with check (true);

create policy "public can read wishes"
  on public.wishes for select
  to anon
  using (true);
