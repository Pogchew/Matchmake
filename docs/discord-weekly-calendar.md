# Matchmake Weekly Discord Calendar

This feature posts upcoming Matchmake scrims into a Discord channel.

There are two ways to use it:

- **Manual from Schedule:** open `/calendar`, choose **Export**, configure the Discord post, and send it to a webhook.
- **Automated weekly:** deploy the Supabase Edge Function and schedule it with Supabase Cron.

It uses a Supabase Edge Function:

```txt
supabase/functions/weekly-discord-calendar
```

The function is designed to be called manually for testing, then later by Supabase Cron.

## 1. Create A Discord Webhook

1. Open the Discord server.
2. Go to the channel where weekly scrims should be posted.
3. Open channel settings.
4. Go to **Integrations**.
5. Choose **Webhooks**.
6. Create a new webhook.
7. Copy the webhook URL.

Do not commit this URL to GitHub.

## 2. Set Supabase Secrets

Set these secrets in Supabase:

```bash
supabase secrets set DISCORD_SCRIM_WEBHOOK_URL="https://discord.com/api/webhooks/..."
supabase secrets set MATCHMAKE_APP_URL="https://your-vercel-domain.vercel.app"
```

Optional customization secrets:

```bash
supabase secrets set DISCORD_SCRIM_LOOKAHEAD_DAYS="7"
supabase secrets set DISCORD_SCRIM_STATUS_FILTERS="confirmed,pending"
supabase secrets set DISCORD_SCRIM_GAME_FILTERS="Valorant,League of Legends"
```

Leave `DISCORD_SCRIM_GAME_FILTERS` unset to include every game.
Leave `DISCORD_SCRIM_STATUS_FILTERS` unset to include confirmed scrims only.

Supabase Edge Functions already provide:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

The service role key is used only inside the Edge Function so the weekly job can read confirmed scrims regardless of user session.

## 3. Deploy The Edge Function

From the project root:

```bash
supabase functions deploy weekly-discord-calendar
```

## 4. Test Manually

Invoke it from the Supabase CLI:

```bash
supabase functions invoke weekly-discord-calendar
```

Or call the deployed function URL:

```bash
curl -X POST \
  "https://PROJECT_REF.functions.supabase.co/weekly-discord-calendar" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_OR_SERVICE_TOKEN"
```

Replace:

```txt
PROJECT_REF
YOUR_SUPABASE_ANON_OR_SERVICE_TOKEN
```

with values from your Supabase project.

## 5. Schedule Weekly With Supabase Cron

Run the SQL template in:

```txt
supabase_weekly_discord_calendar_cron.sql
```

The example schedule is every Monday at 9:00 AM UTC.

Depending on your Supabase project setup, you may need to enable:

```sql
pg_cron
pg_net
```

The SQL file intentionally uses placeholders for the project ref and function token so secrets are not committed.

## What Gets Posted

The Discord message includes:

- Matchmake Weekly Scrim Schedule
- Date range
- Game title
- Team vs team
- Scheduled time in UTC
- Number of games if available
- Scrim detail link if `MATCHMAKE_APP_URL` is configured
- Optional game/status filtering through Edge Function secrets

By default, only scrims with:

```txt
status = confirmed
scheduled_at >= now
scheduled_at < now + 7 days
```

are included. You can customize status, game, and lookahead window with the optional secrets above.

## Manual Schedule Tab Discord Posts

The in-app Schedule tab can send a customized Discord post without deploying Cron first.

From `/calendar`:

1. Select **Export**.
2. Open **Discord notification bot**.
3. Choose a window:
   - This week
   - Next 14 days
   - Next 30 days
4. Choose all games or one game.
5. Choose statuses:
   - pending
   - confirmed
6. Toggle scrim chat links on or off.
7. Paste the Discord webhook URL in the side panel.
8. Review the preview and click **Post now**.

Use **Disable webhook** to clear the in-app webhook field. To stop the recurring Supabase bot, remove or rotate the `DISCORD_SCRIM_WEBHOOK_URL` secret in Supabase.

The webhook URL is sent to the server route for the Discord POST and is not committed to the codebase.
