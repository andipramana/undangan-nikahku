-- Static default template is intentionally independent from the live root and demo.
-- It stores a sanitized content snapshot plus photo metadata/path snapshots. The
-- Edge Function copies root Storage objects into templates/default/ at capture time.
create table if not exists public.invitation_templates (
  name text primary key check (name = 'default'),
  content jsonb not null,
  photos jsonb not null default '[]'::jsonb,
  source_root_updated_at timestamptz,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invitation_templates enable row level security;
create policy "root owner manages static invitation templates"
  on public.invitation_templates for all to authenticated
  using (public.is_root_owner()) with check (public.is_root_owner());
grant select, insert, update, delete on public.invitation_templates to authenticated;
