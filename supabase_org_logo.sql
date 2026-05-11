-- Organization logo support for Matchmake.
-- Run this in the Supabase SQL editor, then use the /org page to upload a logo.

alter table public.organizations
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-logos',
  'org-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read organization logos" on storage.objects;
drop policy if exists "Org members can upload organization logos" on storage.objects;
drop policy if exists "Org members can update organization logos" on storage.objects;
drop policy if exists "Org owners can upload organization logos" on storage.objects;
drop policy if exists "Org owners can update organization logos" on storage.objects;

create policy "Public can read organization logos"
on storage.objects
for select
using (bucket_id = 'org-logos');

create policy "Org owners can upload organization logos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'org-logos'
  and exists (
    select 1
    from public.organizations org
    where org.org_admin_id = auth.uid()
      and split_part(storage.objects.name, '/', 1) = org.id::text
  )
);

create policy "Org owners can update organization logos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'org-logos'
  and exists (
    select 1
    from public.organizations org
    where org.org_admin_id = auth.uid()
      and split_part(storage.objects.name, '/', 1) = org.id::text
  )
)
with check (
  bucket_id = 'org-logos'
  and exists (
    select 1
    from public.organizations org
    where org.org_admin_id = auth.uid()
      and split_part(storage.objects.name, '/', 1) = org.id::text
  )
);

drop policy if exists "Org members can update own organization logo" on public.organizations;
drop policy if exists "Org owners can update own organization logo" on public.organizations;
drop policy if exists "Authenticated users can update organizations" on public.organizations;
drop policy if exists "Org owners can update organizations" on public.organizations;

create policy "Org owners can update organizations"
on public.organizations
for update
to authenticated
using (
  org_admin_id = auth.uid()
)
with check (
  org_admin_id = auth.uid()
);
