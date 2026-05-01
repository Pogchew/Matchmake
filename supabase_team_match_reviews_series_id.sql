-- Add standalone match review series support.
-- Run this in the Supabase SQL Editor if team_match_reviews already exists.

alter table public.team_match_reviews
  add column if not exists review_series_id uuid;

create unique index if not exists team_match_reviews_team_standalone_series_game_unique_idx
  on public.team_match_reviews(team_id, review_series_id, scrim_game_number)
  where scrim_request_id is null and review_series_id is not null;
