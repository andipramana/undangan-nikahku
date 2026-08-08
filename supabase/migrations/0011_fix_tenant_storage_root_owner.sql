-- Follow-up for an already-applied 0010 migration.
-- Root owner must retain access to legacy root photo paths as well as tenant paths.
drop policy if exists "tenant admins manage own photo objects" on storage.objects;
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
