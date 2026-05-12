-- Matchmake live calendar subscription feed support.
-- Run this in Supabase SQL Editor before using Subscribe Calendar.
--
-- The feed URL uses an unguessable token stored on the organization.
-- Rotating or clearing calendar_feed_token disables old subscribed calendar links.

alter table public.organizations
  add column if not exists calendar_feed_token text;

create unique index if not exists organizations_calendar_feed_token_unique_idx
  on public.organizations(calendar_feed_token)
  where calendar_feed_token is not null;

-- If you already ran supabase_org_logo.sql, this policy should already exist.
-- Keep the owner-only organization update policy in place so only org owners can
-- create, rotate, or disable calendar feed tokens.
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
