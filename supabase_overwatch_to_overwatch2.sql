-- Rename any legacy Overwatch rows to Overwatch 2.
-- Run this once in the Supabase SQL Editor if your database has old Overwatch data.

UPDATE public.teams
SET game_title = 'Overwatch 2', updated_at = now()
WHERE game_title = 'Overwatch';

UPDATE public.scrim_requests
SET game_title = 'Overwatch 2', updated_at = now()
WHERE game_title = 'Overwatch';

UPDATE public.team_match_reviews
SET game_title = 'Overwatch 2', updated_at = now()
WHERE game_title = 'Overwatch';
