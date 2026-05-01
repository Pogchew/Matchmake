-- Add multi-game scrim series support to post-game reviews.
-- Run this in the Supabase SQL editor if team_match_reviews already exists.

alter table public.team_match_reviews
  add column if not exists scrim_game_number integer not null default 1;

alter table public.team_match_reviews
  add column if not exists series_game_count integer;

alter table public.team_match_reviews
  drop constraint if exists team_match_reviews_scrim_game_number_check;

alter table public.team_match_reviews
  add constraint team_match_reviews_scrim_game_number_check
  check (scrim_game_number >= 1);

create unique index if not exists team_match_reviews_team_scrim_game_unique_idx
  on public.team_match_reviews(team_id, scrim_request_id, scrim_game_number)
  where scrim_request_id is not null;
