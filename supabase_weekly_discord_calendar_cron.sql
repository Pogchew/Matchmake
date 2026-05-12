-- Matchmake weekly Discord calendar cron setup
-- Runs the Supabase Edge Function every Monday at 9:00 AM UTC.
--
-- The Edge Function can be customized with Supabase secrets:
--   DISCORD_SCRIM_LOOKAHEAD_DAYS="7"
--   DISCORD_SCRIM_STATUS_FILTERS="confirmed,pending"
--   DISCORD_SCRIM_GAME_FILTERS="Valorant,League of Legends"
--
-- Replace these placeholders before running:
--   PROJECT_REF
--   FUNCTION_AUTH_TOKEN
--
-- Function URL format:
--   https://PROJECT_REF.functions.supabase.co/weekly-discord-calendar
--
-- FUNCTION_AUTH_TOKEN can be an anon token if the function is deployed with normal JWT
-- verification and the token is allowed to invoke it. Some setups may use a service token.
-- Do not commit real tokens.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'matchmake-weekly-discord-calendar',
  '0 9 * * 1',
  $$
  select
    net.http_post(
      url := 'https://PROJECT_REF.functions.supabase.co/weekly-discord-calendar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer FUNCTION_AUTH_TOKEN'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- To view the scheduled job:
-- select * from cron.job where jobname = 'matchmake-weekly-discord-calendar';
--
-- To remove the job:
-- select cron.unschedule('matchmake-weekly-discord-calendar');
