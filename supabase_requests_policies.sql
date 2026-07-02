-- Matchmake MVP policies for the Requests page workflow.
-- Run this in the Supabase SQL Editor after the core schema and base RLS policies.
--
-- These policies keep request workflow updates scoped to the authenticated
-- user's organization:
-- - posting org can accept or decline inbound pending requests
-- - matched/requesting org can cancel its outbound pending request

drop policy if exists "Authenticated users can read own org scrim requests" on public.scrim_requests;
drop policy if exists "Posting org can accept inbound scrim requests" on public.scrim_requests;
drop policy if exists "Posting org can decline inbound scrim requests" on public.scrim_requests;
drop policy if exists "Matched org can cancel outbound scrim requests" on public.scrim_requests;
drop policy if exists "Participant org can complete confirmed scrims" on public.scrim_requests;

create policy "Authenticated users can read own org scrim requests"
  on public.scrim_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users viewer
      join public.teams viewer_team
        on viewer_team.org_id = viewer.org_id
      where viewer.id = auth.uid()
        and viewer.org_id is not null
        and (
          viewer_team.id = public.scrim_requests.posting_team_id
          or viewer_team.id = public.scrim_requests.matched_team_id
        )
    )
  );

create policy "Posting org can accept inbound scrim requests"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'pending'
    and matched_team_id is not null
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
    status = 'confirmed'
    and matched_team_id is not null
    and private.scrim_request_update_columns_guard(
      posting_team_id,
      matched_team_id,
      game_title,
      scheduled_at,
      games_count,
      team_rank,
      opponent_rank_min,
      opponent_rank_max,
      status,
      expires_at,
      updated_at
    )
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

create policy "Posting org can decline inbound scrim requests"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'pending'
    and matched_team_id is not null
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
    status = 'open'
    and matched_team_id is null
    and private.scrim_request_update_columns_guard(
      posting_team_id,
      matched_team_id,
      game_title,
      scheduled_at,
      games_count,
      team_rank,
      opponent_rank_min,
      opponent_rank_max,
      status,
      expires_at,
      updated_at
    )
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

create policy "Matched org can cancel outbound scrim requests"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'pending'
    and matched_team_id is not null
    and exists (
      select 1
      from public.users requester
      join public.teams matched_team
        on matched_team.org_id = requester.org_id
      where requester.id = auth.uid()
        and requester.org_id is not null
        and matched_team.id = public.scrim_requests.matched_team_id
    )
  )
  with check (
    status = 'open'
    and matched_team_id is null
    and private.scrim_request_update_columns_guard(
      posting_team_id,
      matched_team_id,
      game_title,
      scheduled_at,
      games_count,
      team_rank,
      opponent_rank_min,
      opponent_rank_max,
      status,
      expires_at,
      updated_at
    )
  );

create policy "Participant org can complete confirmed scrims"
  on public.scrim_requests
  for update
  to authenticated
  using (
    status = 'confirmed'
    and matched_team_id is not null
    and exists (
      select 1
      from public.users participant
      join public.teams participant_team
        on participant_team.org_id = participant.org_id
      where participant.id = auth.uid()
        and participant.org_id is not null
        and (
          participant_team.id = public.scrim_requests.posting_team_id
          or participant_team.id = public.scrim_requests.matched_team_id
        )
    )
  )
  with check (
    status = 'completed'
    and matched_team_id is not null
    and private.scrim_request_update_columns_guard(
      posting_team_id,
      matched_team_id,
      game_title,
      scheduled_at,
      games_count,
      team_rank,
      opponent_rank_min,
      opponent_rank_max,
      status,
      expires_at,
      updated_at
    )
    and exists (
      select 1
      from public.users participant
      join public.teams participant_team
        on participant_team.org_id = participant.org_id
      where participant.id = auth.uid()
        and participant.org_id is not null
        and (
          participant_team.id = public.scrim_requests.posting_team_id
          or participant_team.id = public.scrim_requests.matched_team_id
        )
    )
  );
