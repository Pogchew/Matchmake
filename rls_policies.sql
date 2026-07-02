-- Matchmake core Row Level Security policies.
-- Paste this into the Supabase SQL Editor after creating the core tables.
--
-- This file intentionally replaces the original MVP `true` policies. It keeps
-- signup/org bootstrap possible while scoping authenticated access to the
-- current user and their organization.
-- Apply the narrower scrim workflow policy files after this baseline so
-- request, accept, decline, cancel, and complete actions stay available.

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.teams enable row level security;
alter table public.scrim_requests enable row level security;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id
  from public.users
  where id = auth.uid()
$$;

create or replace function private.current_user_team_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(team_ids, '{}'::uuid[])
  from public.users
  where id = auth.uid()
$$;

create or replace function private.current_user_admins_org(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organizations org
    where org.id = target_org_id
      and org.org_admin_id = auth.uid()
  )
$$;

create or replace function private.organization_has_open_scrim(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teams public_team
    join public.scrim_requests public_scrim
      on public_scrim.posting_team_id = public_team.id
    where public_team.org_id = target_org_id
      and public_scrim.status = 'open'
      and public_scrim.matched_team_id is null
  )
$$;

create or replace function private.organization_participates_in_current_user_scrim(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teams visible_team
    join public.scrim_requests visible_scrim
      on visible_team.id in (
        visible_scrim.posting_team_id,
        visible_scrim.matched_team_id
      )
    where visible_team.org_id = target_org_id
      and (
        visible_scrim.posting_team_id = any(private.current_user_team_ids())
        or visible_scrim.matched_team_id = any(private.current_user_team_ids())
      )
  )
$$;

create or replace function private.team_has_open_scrim(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.scrim_requests public_scrim
    where public_scrim.posting_team_id = target_team_id
      and public_scrim.status = 'open'
      and public_scrim.matched_team_id is null
  )
$$;

create or replace function private.team_participates_in_current_user_scrim(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.scrim_requests visible_scrim
    where target_team_id in (
        visible_scrim.posting_team_id,
        visible_scrim.matched_team_id
      )
      and (
        visible_scrim.posting_team_id = any(private.current_user_team_ids())
        or visible_scrim.matched_team_id = any(private.current_user_team_ids())
      )
  )
$$;

create or replace function private.scrim_request_update_columns_guard(
  posting_team_id uuid,
  matched_team_id uuid,
  game_title text,
  scheduled_at timestamptz,
  games_count integer,
  team_rank text,
  opponent_rank_min text,
  opponent_rank_max text,
  status text,
  expires_at timestamptz,
  updated_at timestamptz
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select true
$$;

drop policy if exists "Authenticated users can read users" on public.users;
drop policy if exists "Authenticated users can insert users" on public.users;
drop policy if exists "Authenticated users can update users" on public.users;
drop policy if exists "Authenticated users can read own profile" on public.users;
drop policy if exists "Authenticated users can insert own profile" on public.users;
drop policy if exists "Authenticated users can update own profile" on public.users;

drop policy if exists "Authenticated users can read organizations" on public.organizations;
drop policy if exists "Authenticated users can insert organizations" on public.organizations;
drop policy if exists "Authenticated users can update organizations" on public.organizations;
drop policy if exists "Org members can read organizations in their org" on public.organizations;
drop policy if exists "Org members can update organizations in their org" on public.organizations;

drop policy if exists "Authenticated users can read teams" on public.teams;
drop policy if exists "Authenticated users can insert teams" on public.teams;
drop policy if exists "Authenticated users can update teams" on public.teams;
drop policy if exists "Authenticated users can update teams in their org" on public.teams;

drop policy if exists "Authenticated users can read scrim requests" on public.scrim_requests;
drop policy if exists "Authenticated users can insert scrim requests" on public.scrim_requests;
drop policy if exists "Authenticated users can update scrim requests" on public.scrim_requests;
drop policy if exists "Authenticated users can read relevant scrim requests" on public.scrim_requests;
drop policy if exists "Authenticated users can post scrims for their teams" on public.scrim_requests;

create policy "Authenticated users can read own profile"
  on public.users
  for select
  to authenticated
  using (id = auth.uid());

create policy "Authenticated users can insert own profile"
  on public.users
  for insert
  to authenticated
  with check (id = auth.uid());

create policy "Authenticated users can update own profile"
  on public.users
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      org_id is null
      or private.current_user_admins_org(org_id)
    )
  );

create policy "Org members can read organizations in their org"
  on public.organizations
  for select
  to authenticated
  using (
    org_admin_id = auth.uid()
    or id = private.current_user_org_id()
    or private.organization_participates_in_current_user_scrim(id)
  );

create policy "Authenticated users can insert organizations"
  on public.organizations
  for insert
  to authenticated
  with check (org_admin_id = auth.uid());

create policy "Org members can update organizations in their org"
  on public.organizations
  for update
  to authenticated
  using (
    org_admin_id = auth.uid()
    or id = private.current_user_org_id()
  )
  with check (
    org_admin_id = auth.uid()
    or id = private.current_user_org_id()
  );

create policy "Authenticated users can read teams"
  on public.teams
  for select
  to authenticated
  using (
    org_id = private.current_user_org_id()
    or private.team_participates_in_current_user_scrim(id)
  );

create policy "Authenticated users can insert teams"
  on public.teams
  for insert
  to authenticated
  with check (org_id = private.current_user_org_id());

create policy "Authenticated users can update teams in their org"
  on public.teams
  for update
  to authenticated
  using (org_id = private.current_user_org_id())
  with check (org_id = private.current_user_org_id());

create policy "Authenticated users can read relevant scrim requests"
  on public.scrim_requests
  for select
  to authenticated
  using (
    status = 'open'
    or posting_team_id = any(private.current_user_team_ids())
    or matched_team_id = any(private.current_user_team_ids())
  );

create policy "Authenticated users can post scrims for their teams"
  on public.scrim_requests
  for insert
  to authenticated
  with check (
    status = 'open'
    and matched_team_id is null
    and posting_team_id = any(private.current_user_team_ids())
  );
