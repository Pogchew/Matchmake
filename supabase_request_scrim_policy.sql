-- Matchmake MVP policy for requesting an open scrim.
-- Run this in the Supabase SQL Editor after the core schema and authenticated RLS policies.
--
-- This policy allows an authenticated user to update an open scrim into a pending
-- request only when the matched_team_id being set belongs to the user's org, the
-- scrim has not already been matched, and the user is not requesting their own
-- team's scrim. It also requires the challenger team and posting team to be
-- registered under the same game title.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.enforce_scrim_request_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_org_id uuid;
  old_posting_org_id uuid;
  old_matched_org_id uuid;
  new_matched_org_id uuid;
  listing_fields_unchanged boolean;
begin
  if actor_id is null or current_setting('request.jwt.claim.role', true) <> 'authenticated' then
    return new;
  end if;

  select app_user.org_id
  into actor_org_id
  from public.users app_user
  where app_user.id = actor_id;

  if actor_org_id is null then
    raise insufficient_privilege using message = 'Scrim update requires an organization membership.';
  end if;

  select posting_team.org_id
  into old_posting_org_id
  from public.teams posting_team
  where posting_team.id = old.posting_team_id;

  if old.matched_team_id is not null then
    select matched_team.org_id
    into old_matched_org_id
    from public.teams matched_team
    where matched_team.id = old.matched_team_id;
  end if;

  if new.matched_team_id is not null then
    select matched_team.org_id
    into new_matched_org_id
    from public.teams matched_team
    where matched_team.id = new.matched_team_id;
  end if;

  listing_fields_unchanged :=
    new.posting_team_id is not distinct from old.posting_team_id
    and new.game_title is not distinct from old.game_title
    and new.scheduled_at is not distinct from old.scheduled_at
    and new.games_count is not distinct from old.games_count
    and new.team_rank is not distinct from old.team_rank
    and new.opponent_rank_min is not distinct from old.opponent_rank_min
    and new.opponent_rank_max is not distinct from old.opponent_rank_max
    and new.expires_at is not distinct from old.expires_at;

  if old.status = 'open' and old.matched_team_id is null then
    if actor_org_id = old_posting_org_id
      and new.posting_team_id is not distinct from old.posting_team_id
      and new.matched_team_id is null
      and new.status in ('open', 'cancelled')
    then
      return new;
    end if;

    if actor_org_id <> old_posting_org_id
      and listing_fields_unchanged
      and new.status = 'pending'
      and new.matched_team_id is not null
      and new.matched_team_id <> old.posting_team_id
      and new_matched_org_id = actor_org_id
      and exists (
        select 1
        from public.teams challenger_team
        where challenger_team.id = new.matched_team_id
          and challenger_team.game_title = old.game_title
      )
    then
      return new;
    end if;
  end if;

  if old.status = 'pending' and old.matched_team_id is not null and listing_fields_unchanged then
    if actor_org_id = old_posting_org_id
      and (
        (new.status = 'confirmed' and new.matched_team_id is not distinct from old.matched_team_id)
        or (new.status = 'open' and new.matched_team_id is null)
      )
    then
      return new;
    end if;

    if actor_org_id = old_matched_org_id
      and new.status = 'open'
      and new.matched_team_id is null
    then
      return new;
    end if;
  end if;

  if old.status = 'confirmed'
    and old.matched_team_id is not null
    and listing_fields_unchanged
    and new.status = 'completed'
    and new.matched_team_id is not distinct from old.matched_team_id
    and actor_org_id in (old_posting_org_id, old_matched_org_id)
  then
    return new;
  end if;

  raise insufficient_privilege using message = 'Scrim update is outside the authenticated user organization.';
end;
$$;

drop trigger if exists enforce_scrim_request_update_scope on public.scrim_requests;

create trigger enforce_scrim_request_update_scope
  before update on public.scrim_requests
  for each row
  execute function private.enforce_scrim_request_update_scope();

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
