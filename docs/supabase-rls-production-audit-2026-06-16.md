# Supabase RLS Production Audit - 2026-06-16

Scope: audit the connected production Supabase project against the repo policy files for the MOSEF / high-school launch checklist. This is an audit only; no database policies were changed.

## Production Project Checked

- Project: `Matchmake`
- Project ref: `urrnrcdxekhovsemeuly`
- Region: `us-east-2`
- Database: Postgres `17.6.1.105`
- Status observed through Supabase connector: `ACTIVE_HEALTHY`

## Repo Policy Sources Reviewed

- `rls_policies.sql`
- `public_read_policies.sql`
- `supabase_request_scrim_policy.sql`
- `supabase_requests_policies.sql`
- `supabase_team_roster_names.sql`
- `supabase_team_delete_policy.sql`
- `supabase_team_match_reviews.sql`
- `supabase_match_review_analytics_foundation.sql`
- `supabase_scrim_chat.sql`
- `supabase_org_logo.sql`
- `supabase_calendar_feed_tokens.sql`

## Live Schema Snapshot

The Supabase connector reported RLS enabled on these live `public` tables:

- `public.users`
- `public.organizations`
- `public.teams`
- `public.scrim_requests`
- `public.scrim_messages`
- `public.team_match_reviews`

The connector did not report these repo-defined analytics mirror tables as present in production:

- `public.match_review_players`
- `public.match_review_team_stats`

Storage schema tables had RLS enabled, but `storage.buckets` reported `0` rows through the connector, so the repo-defined `org-logos` bucket/policies from `supabase_org_logo.sql` do not appear to be active in this production snapshot.

Supabase migration history returned an empty list. Treat the root SQL files as manual runbooks, not as a reliable applied migration ledger.

## Advisor Findings

Supabase security advisors reported active `rls_policy_always_true` warnings in production for these broad MVP policies:

- `public.users`
  - `Authenticated users can insert users` uses `WITH CHECK (true)`.
  - `Authenticated users can update users` uses `USING (true)` and `WITH CHECK (true)`.
- `public.organizations`
  - `Authenticated users can insert organizations` uses `WITH CHECK (true)`.
  - `Authenticated users can update organizations` uses `USING (true)` and `WITH CHECK (true)`.
- `public.teams`
  - `Authenticated users can insert teams` uses `WITH CHECK (true)`.
  - `Authenticated users can update teams` uses `USING (true)` and `WITH CHECK (true)`.
- `public.scrim_requests`
  - `Authenticated users can insert scrim requests` uses `WITH CHECK (true)`.
  - `Authenticated users can update scrim requests` uses `USING (true)` and `WITH CHECK (true)`.

The advisor also reported leaked password protection is disabled in Supabase Auth. That is outside RLS, but relevant for school launch hardening.

## Comparison Against Repo Intent

`rls_policies.sql` is still an MVP baseline and intentionally contains broad authenticated policies on `users`, `organizations`, `teams`, and `scrim_requests`. Production appears to still carry those broad policies.

Newer scoped files define narrower policies for specific workflows:

- `supabase_request_scrim_policy.sql` narrows scrim request, edit, and retract workflows.
- `supabase_requests_policies.sql` narrows requests page reads and request lifecycle updates by participant org.
- `supabase_team_roster_names.sql` narrows team updates by matching `users.org_id` to `teams.org_id`.
- `supabase_team_delete_policy.sql` narrows team deletes to authenticated users in the team org.
- `supabase_team_match_reviews.sql` narrows match review read/insert/update by team org.
- `supabase_scrim_chat.sql` narrows chat reads/inserts to active scrim participants.
- `supabase_org_logo.sql` and `supabase_calendar_feed_tokens.sql` narrow organization updates to `org_admin_id = auth.uid()`.

The live advisor warnings indicate at least some broad MVP policies remain active alongside or instead of the scoped policy files. The next launch task should replace those broad `true` policies with org-scoped policies, not just add more permissive policies beside them.

## Risks To Track Next

- Broad authenticated insert/update policies currently allow cross-org writes on core tables unless application code prevents them.
- Public read policy intent is unclear from the connector output because full policy definitions were not exposed by the available Supabase tools. The `public_read_policies.sql` file should not be applied for production unless intentionally limited.
- Production lacks an applied migration ledger, making policy drift harder to reason about.
- Analytics mirror tables from `supabase_match_review_analytics_foundation.sql` appear absent in production, so dashboard expectations may differ from repo intent.

## Follow-Up Query For Full Policy Export

Run this in Supabase SQL Editor or another trusted SQL channel when direct SQL access is available:

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;
```

Also export RLS-enabled table state:

```sql
select
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname in ('public', 'storage')
order by n.nspname, c.relname;
```
