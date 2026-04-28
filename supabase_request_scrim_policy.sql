-- Matchmake MVP policy for requesting an open scrim.
-- Run this in the Supabase SQL Editor after the core schema and authenticated RLS policies.
--
-- This policy allows an authenticated user to update an open scrim into a pending
-- request only when the matched_team_id being set belongs to the user's org, the
-- scrim has not already been matched, and the user is not requesting their own
-- team's scrim. It also requires the challenger team and posting team to be
-- registered under the same game title.

drop policy if exists "Authenticated users can update scrim requests" on public.scrim_requests;
drop policy if exists "Authenticated users can request open scrims" on public.scrim_requests;
drop policy if exists "Authenticated users can retract pending scrim requests" on public.scrim_requests;
drop policy if exists "Authenticated users can edit their open scrim listings" on public.scrim_requests;

create policy "Authenticated users can request open scrims"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'open'
    and matched_team_id is null
    and exists (
      select 1
      from public.users requester
      where requester.id = auth.uid()
        and requester.org_id is not null
        and exists (
          select 1
          from public.teams posting_team
          where posting_team.id = public.scrim_requests.posting_team_id
            and posting_team.org_id <> requester.org_id
        )
    )
  )
  with check (
    status = 'pending'
    and matched_team_id is not null
    and matched_team_id <> posting_team_id
    and exists (
      select 1
      from public.users requester
      where requester.id = auth.uid()
        and requester.org_id is not null
        and exists (
          select 1
          from public.teams challenger_team
          where challenger_team.id = public.scrim_requests.matched_team_id
            and challenger_team.org_id = requester.org_id
            and challenger_team.game_title = public.scrim_requests.game_title
        )
        and exists (
          select 1
          from public.teams posting_team
          where posting_team.id = public.scrim_requests.posting_team_id
            and posting_team.org_id <> requester.org_id
            and posting_team.game_title = public.scrim_requests.game_title
        )
    )
  );

create policy "Authenticated users can edit their open scrim listings"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'open'
    and matched_team_id is null
    and exists (
      select 1
      from public.users owner
      join public.teams posting_team
        on posting_team.org_id = owner.org_id
      where owner.id = auth.uid()
        and owner.org_id is not null
        and posting_team.id = public.scrim_requests.posting_team_id
    )
  )
  with check (
    status in ('open', 'cancelled')
    and matched_team_id is null
    and exists (
      select 1
      from public.users owner
      join public.teams posting_team
        on posting_team.org_id = owner.org_id
      where owner.id = auth.uid()
        and owner.org_id is not null
        and posting_team.id = public.scrim_requests.posting_team_id
    )
  );

create policy "Authenticated users can retract pending scrim requests"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'pending'
    and matched_team_id is not null
    and exists (
      select 1
      from public.users requester
      join public.teams challenger_team
        on challenger_team.org_id = requester.org_id
      where requester.id = auth.uid()
        and requester.org_id is not null
        and challenger_team.id = public.scrim_requests.matched_team_id
    )
  )
  with check (
    status = 'open'
    and matched_team_id is null
  );
