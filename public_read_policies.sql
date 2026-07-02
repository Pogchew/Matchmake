-- Limited public read policies for the unauthenticated Scrim Board.
-- Run this in Supabase after the core schema and RLS baseline.
--
-- Anonymous users should only see the public listing fields needed to render
-- open, unmatched scrim posts. Authenticated org workflows are
-- handled by the authenticated policies in the other policy runbooks.

revoke all on table public.users from anon;
revoke all on table public.organizations from anon;
revoke all on table public.teams from anon;
revoke all on table public.scrim_requests from anon;

grant select (
  id,
  name,
  verified_flag
) on table public.organizations to anon;

grant select (
  id,
  org_id,
  name,
  region,
  rank_tier,
  scrimgg_rating
) on table public.teams to anon;

grant select (
  id,
  posting_team_id,
  matched_team_id,
  game_title,
  scheduled_at,
  games_count,
  team_rank,
  opponent_rank_min,
  opponent_rank_max,
  status,
  expires_at
) on table public.scrim_requests to anon;

drop policy if exists "Anyone can read organizations for MVP preview" on public.organizations;
drop policy if exists "Anyone can read teams for MVP preview" on public.teams;
drop policy if exists "Anyone can read scrim requests for MVP preview" on public.scrim_requests;
drop policy if exists "Enable public read access" on public.scrim_requests;

drop policy if exists "Anon can read organizations with open scrims" on public.organizations;
drop policy if exists "Anon can read teams with open scrims" on public.teams;
drop policy if exists "Anon can read open scrim listings" on public.scrim_requests;

create policy "Anon can read organizations with open scrims"
  on public.organizations
  for select
  to anon
  using (
    exists (
      select 1
      from public.teams public_team
      join public.scrim_requests public_scrim
        on public_scrim.posting_team_id = public_team.id
      where public_team.org_id = public.organizations.id
        and public_scrim.status = 'open'
        and public_scrim.matched_team_id is null
    )
  );

create policy "Anon can read teams with open scrims"
  on public.teams
  for select
  to anon
  using (
    exists (
      select 1
      from public.scrim_requests public_scrim
      where public_scrim.posting_team_id = public.teams.id
        and public_scrim.status = 'open'
        and public_scrim.matched_team_id is null
    )
  );

create policy "Anon can read open scrim listings"
  on public.scrim_requests
  for select
  to anon
  using (
    status = 'open'
    and matched_team_id is null
  );
