-- Add agreed game count to scrim listings.
-- Run this in the Supabase SQL editor before deploying code that reads games_count.

alter table public.scrim_requests
  add column if not exists games_count integer not null default 3;

alter table public.scrim_requests
  drop constraint if exists scrim_requests_games_count_check;

alter table public.scrim_requests
  add constraint scrim_requests_games_count_check
  check (games_count >= 1 and games_count <= 10);
