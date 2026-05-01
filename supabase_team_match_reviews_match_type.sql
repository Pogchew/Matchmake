-- Add scrim/match labeling to post-game reviews.
-- Run this in the Supabase SQL Editor if team_match_reviews already exists.

alter table public.team_match_reviews
  add column if not exists match_type text not null default 'scrim';

alter table public.team_match_reviews
  drop constraint if exists team_match_reviews_match_type_check;

alter table public.team_match_reviews
  add constraint team_match_reviews_match_type_check
  check (match_type in ('scrim', 'match'));

update public.team_match_reviews
set match_type = 'scrim'
where match_type is null;
