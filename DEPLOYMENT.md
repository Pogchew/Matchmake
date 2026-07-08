# Matchmake Deployment Checklist

Use this checklist to deploy Matchmake to Vercel for the MOSEF / high-school pilot.

Current production Supabase project: `urrnrcdxekhovsemeuly` (`Matchmake`, `us-east-2`).

## 0. Resolve Launch Blockers

Do not treat a Vercel deployment as launch-ready until the current production-readiness blockers in `MOSEF_HS_LAUNCH_TODO.md` are resolved or explicitly accepted by the owner:

- Separate development/staging Supabase from production. Local `.env.local` currently points at production.
- Confirm production Vercel environment variables in Project Settings or with `vercel env ls production`.
- Confirm `GEMINI_API_KEY` billing, quota tier, and quota alerts in Google AI Studio or Google Cloud Console.
- Confirm Supabase backups or Point-in-Time Recovery status and retention in the Supabase Dashboard.

## 1. Confirm Local Environment

Create or confirm `.env.local` exists locally. For day-to-day development, prefer a non-production Supabase project once one exists.

```env
NEXT_PUBLIC_SUPABASE_URL=https://urrnrcdxekhovsemeuly.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-flash-lite-latest
```

Optional extractor controls:

```env
POSTGAME_EXTRACT_RATE_LIMIT_MAX_REQUESTS=20
POSTGAME_EXTRACT_RATE_LIMIT_WINDOW_MS=3600000
POSTGAME_EXTRACT_MAX_UPLOAD_BYTES=8388608
POSTGAME_EXTRACT_DEBUG_LOGS=false
```

Never commit `.env.local`. Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, Discord webhooks, auth tokens, cookies, or calendar feed tokens as `NEXT_PUBLIC_` variables.

## 2. Apply Or Verify Supabase Setup

For a fresh project, start with `database_schema.sql`, then apply feature SQL files only after reviewing their comments and current production need.

For the current MOSEF launch database, verify these repo SQL/runbook pieces are applied where the feature is enabled:

1. Core RLS and public Scrim Board access:
   - `rls_policies.sql`
   - `public_read_policies.sql`
   - `supabase_request_scrim_policy.sql`
   - `supabase_requests_policies.sql`
   - `supabase_scrim_chat.sql`
2. Match review and stats support:
   - `supabase_team_match_reviews.sql`
   - `supabase_team_match_reviews_game_number.sql`
   - `supabase_team_match_reviews_series_id.sql`
   - `supabase_team_match_reviews_match_type.sql`
   - `supabase_match_review_analytics_foundation.sql` if normalized analytics mirror tables are intentionally enabled.
3. Team/org/scrim feature columns and controls:
   - `supabase_team_roster_names.sql`
   - `supabase_scrim_games_count.sql`
   - `supabase_team_delete_policy.sql`
   - `supabase_org_logo.sql`
   - `supabase_calendar_feed_tokens.sql`
4. Owner/admin and launch analytics:
   - `supabase_admin_dashboard.sql`
   - `supabase_report_queue.sql`
   - Production migrations already applied for launch analytics: `add_launch_analytics_event_rpc` and `secure_launch_analytics_event_rpc`.

After applying SQL, run Supabase security advisors. The expected current non-blocking notices are `private.owner_accounts` RLS enabled with no policies and leaked password protection disabled; investigate any new RLS, grant, or security-definer warnings before launch.

## 3. Configure Calendar And Discord Features

The live calendar subscription route requires this Vercel server-side env var:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

The weekly Discord calendar digest is a Supabase Edge Function, not a Vercel route. Follow `docs/discord-weekly-calendar.md`:

```bash
supabase functions deploy weekly-discord-calendar
supabase secrets set DISCORD_SCRIM_WEBHOOK_URL="https://discord.com/api/webhooks/..."
supabase secrets set MATCHMAKE_APP_URL="https://your-production-domain"
```

Optional Supabase Edge Function secrets:

```bash
supabase secrets set DISCORD_SCRIM_LOOKAHEAD_DAYS="7"
supabase secrets set DISCORD_SCRIM_STATUS_FILTERS="confirmed,pending"
supabase secrets set DISCORD_SCRIM_GAME_FILTERS="Valorant,League of Legends"
```

Schedule the weekly function with `supabase_weekly_discord_calendar_cron.sql` only after a manual function invocation succeeds.

## 4. Verify The Build Locally

Run the source lint gate and production build:

```bash
npx eslint src
npm run build
```

`npm run lint` may scan generated `.claude/worktrees/**/.next` files in this workspace. Use `npx eslint src` as the launch source lint gate until generated worktree paths are excluded or removed.

For extractor changes, also run the focused API verifier:

```bash
npm run verify:postgame-extract-api
```

Set the script's optional auth/image env vars when validating a full authenticated extraction path.

## 5. Commit And Push

Confirm the remote before pushing:

```bash
git remote -v
```

Commit only intentional launch changes:

```bash
git add .
git commit -m "Prepare MOSEF launch deployment"
git push
```

Do not force push unless you intentionally want to overwrite remote history.

## 6. Configure Vercel

In Vercel, import or open the `Matchmake` project and keep the framework preset as Next.js.

Required Vercel production environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://urrnrcdxekhovsemeuly.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-flash-lite-latest
```

Optional Vercel production environment variables:

```env
POSTGAME_EXTRACT_RATE_LIMIT_MAX_REQUESTS=20
POSTGAME_EXTRACT_RATE_LIMIT_WINDOW_MS=3600000
POSTGAME_EXTRACT_MAX_UPLOAD_BYTES=8388608
POSTGAME_EXTRACT_DEBUG_LOGS=false
```

Keep `POSTGAME_EXTRACT_DEBUG_LOGS` unset or `false` in production unless an owner is actively debugging and has accepted the logging risk described in `docs/production-monitoring-logging-strategy.md`.

## 7. Deploy

Deploy from Vercel after the production env vars are saved. If Vercel protection or SSO is enabled on production aliases, use an authenticated browser/session for smoke testing protected routes.

After deployment, verify:

- `/login` loads.
- `/signup` creates a Supabase Auth user and organization.
- Protected pages redirect logged-out users to `/login`.
- Logged-in users can access `/`, `/org`, `/requests`, `/calendar`, `/team`, and `/scrims/[id]`.
- Owner accounts can reach `/admin`; non-owner accounts cannot.
- Scrim Board can fetch open scrim listings.
- Posting a scrim creates a new `scrim_requests` row and records a launch analytics event.
- Calendar subscription link creation works if `supabase_calendar_feed_tokens.sql` and `SUPABASE_SERVICE_ROLE_KEY` are configured.
- A post-game dashboard screenshot upload returns extracted data or a clear Gemini/API manual-entry error.
- Extraction success and failure both record coarse launch analytics events without raw screenshot/model data.
- Saved reviews appear in Team Stats and Deep Stats for the relevant team.

## 8. Post-Deploy Monitoring

Follow `docs/production-monitoring-logging-strategy.md` after every production deploy:

1. Confirm the Vercel deployment is ready.
2. Review Vercel Runtime Logs for the first hour after deploy.
3. Review Supabase logs for database/API/Auth errors.
4. Review Supabase Edge Function logs if the weekly Discord calendar function is deployed.
5. Review `/admin` activity for unexpected or failed owner actions.
6. Check launch analytics rows in `/admin` for signup, scrim posting, extraction success, and extraction failure signals.

If repeated signup, scrim posting, extraction, save, or cross-org access errors appear, pause launch-facing promotion until the issue is fixed or documented as a non-blocking owner-accepted risk.
