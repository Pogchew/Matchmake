-- Matchmake post-game review dashboards for League of Legends and Valorant.
-- Run this in the Supabase SQL editor.

create table if not exists public.team_match_reviews (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  scrim_request_id uuid references public.scrim_requests(id) on delete set null,
  review_series_id uuid,
  scrim_game_number integer not null default 1 check (scrim_game_number >= 1),
  series_game_count integer,
  created_by uuid not null references auth.users(id) on delete cascade,
  game_title text not null,
  match_type text not null default 'scrim' check (match_type in ('scrim', 'match')),
  match_result text,
  final_score text,
  team_score integer,
  opponent_score integer,
  opponent_name text,
  map_or_mode text,
  played_at timestamptz,
  screenshot_url text,
  team_comp jsonb not null default '[]'::jsonb,
  opponent_comp jsonb not null default '[]'::jsonb,
  team_stats jsonb not null default '{}'::jsonb,
  opponent_stats jsonb not null default '{}'::jsonb,
  player_rows jsonb not null default '[]'::jsonb,
  opponent_rows jsonb not null default '[]'::jsonb,
  notes text,
  parser_status text not null default 'manual',
  parser_confidence numeric,
  manual_edit_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_match_reviews_team_id_played_at_idx
  on public.team_match_reviews(team_id, played_at desc);

create unique index if not exists team_match_reviews_team_scrim_game_unique_idx
  on public.team_match_reviews(team_id, scrim_request_id, scrim_game_number)
  where scrim_request_id is not null;

create unique index if not exists team_match_reviews_team_standalone_series_game_unique_idx
  on public.team_match_reviews(team_id, review_series_id, scrim_game_number)
  where scrim_request_id is null and review_series_id is not null;

alter table public.team_match_reviews enable row level security;

drop policy if exists "Users can read match reviews for teams in their org" on public.team_match_reviews;
drop policy if exists "Users can insert match reviews for teams in their org" on public.team_match_reviews;
drop policy if exists "Users can update match reviews for teams in their org" on public.team_match_reviews;

create policy "Users can read match reviews for teams in their org"
  on public.team_match_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users app_user
      join public.teams team
        on team.org_id = app_user.org_id
      where app_user.id = auth.uid()
        and team.id = public.team_match_reviews.team_id
    )
  );

create policy "Users can insert match reviews for teams in their org"
  on public.team_match_reviews
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1
      from public.users app_user
      join public.teams team
        on team.org_id = app_user.org_id
      where app_user.id = auth.uid()
        and team.id = public.team_match_reviews.team_id
    )
  );

create policy "Users can update match reviews for teams in their org"
  on public.team_match_reviews
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users app_user
      join public.teams team
        on team.org_id = app_user.org_id
      where app_user.id = auth.uid()
        and team.id = public.team_match_reviews.team_id
    )
  )
  with check (
    exists (
      select 1
      from public.users app_user
      join public.teams team
        on team.org_id = app_user.org_id
      where app_user.id = auth.uid()
        and team.id = public.team_match_reviews.team_id
    )
  );
