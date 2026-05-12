# Matchmake Live Calendar Subscription Feed

Matchmake supports a live `.ics` subscription feed for Google Calendar, Outlook, and other calendar apps.

Unlike a downloaded `.ics` file, the subscription URL is dynamic. Calendar apps periodically re-fetch it, so newly scheduled or updated scrims appear after that app refreshes external calendars.

## Setup SQL

Run:

```txt
supabase_calendar_feed_tokens.sql
```

This adds `organizations.calendar_feed_token` and an index for fast token lookup.

## Server Environment

The feed route uses the Supabase service role key on the server only:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Do not expose this as `NEXT_PUBLIC_`.

## In-App Flow

From `/calendar`:

1. Open **Export**.
2. In **Subscribe Calendar**, click **Create Link**.
3. Copy the generated URL.
4. In Google Calendar or Outlook, add it as a subscribed calendar URL.

Use **Rotate** if the link should be replaced.
Use **Disable** to stop the old link from working.

## Refresh Timing

Matchmake returns live calendar data whenever the URL is fetched.

Google Calendar and Outlook decide how often to refresh subscribed calendars. They may not update instantly, but the feed itself is always generated from the latest Matchmake scrim data.
