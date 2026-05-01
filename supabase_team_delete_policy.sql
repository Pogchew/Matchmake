-- Allow authenticated org owners to delete teams in their own organization.
-- Run this in the Supabase SQL editor to enable the Delete Team action.
--
-- Existing schema cascades:
-- - public.scrim_requests.posting_team_id references teams(id) on delete cascade
-- - public.team_match_reviews.team_id references teams(id) on delete cascade
--
-- matched_team_id on scrim_requests is set null by the core schema.

drop policy if exists "Authenticated users can delete teams in their org" on public.teams;

create policy "Authenticated users can delete teams in their org"
  on public.teams
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.users owner
      where owner.id = auth.uid()
        and owner.org_id = public.teams.org_id
    )
  );
