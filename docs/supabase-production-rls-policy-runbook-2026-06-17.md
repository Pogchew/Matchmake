# Matchmake Production RLS Policy Runbook

Last verified: 2026-06-17

Production project: `urrnrcdxekhovsemeuly`

This is the handoff for the current production Supabase Row Level Security policy set used for the MOSEF / high-school launch path. It summarizes the live policy shape, the repo SQL files that define it, and the safest order for applying or re-applying the policies.

## Security Model

Supabase access has two layers: grants decide whether a role can reach a table or function through the Data API, and RLS decides which rows that role can read or mutate. Supabase also recommends RLS on all tables in exposed schemas such as `public`.

For Matchmake, production uses RLS as the row-access boundary:

- Authenticated users can read and mutate their own profile, their own organization, and teams in their organization.
- Authenticated users can see open scrim listings, requests where one of their teams participates, and the participating team/org metadata needed to render those request workflows.
- Authenticated scrim request updates are constrained by RLS policies and by `private.enforce_scrim_request_update_scope()`.
- Anonymous users can only read public Scrim Board listing fields for open, unmatched scrims and the posting team/org fields required to render those listings.
- Match reviews and scrim chat are not public. They are scoped to the user's organization or active scrim participation.
- Helper functions that need elevated policy reads live in the unexposed `private` schema, not in `public`.

## Current Live Policy Inventory

Production readback on 2026-06-17 showed RLS enabled on:

- `public.users`
- `public.organizations`
- `public.teams`
- `public.scrim_requests`
- `public.scrim_messages`
- `public.team_match_reviews`

Current live policies:

| Table | Role | Action | Policy |
| --- | --- | --- | --- |
| `users` | `authenticated` | `SELECT` | `Authenticated users can read own profile` |
| `users` | `authenticated` | `INSERT` | `Authenticated users can insert own profile` |
| `users` | `authenticated` | `UPDATE` | `Authenticated users can update own profile` |
| `organizations` | `anon` | `SELECT` | `Anon can read organizations with open scrims` |
| `organizations` | `authenticated` | `SELECT` | `Org members can read organizations in their org` |
| `organizations` | `authenticated` | `INSERT` | `Authenticated users can insert organizations` |
| `organizations` | `authenticated` | `UPDATE` | `Org members can update organizations in their org` |
| `teams` | `anon` | `SELECT` | `Anon can read teams with open scrims` |
| `teams` | `authenticated` | `SELECT` | `Authenticated users can read teams` |
| `teams` | `authenticated` | `INSERT` | `Authenticated users can insert teams` |
| `teams` | `authenticated` | `UPDATE` | `Authenticated users can update teams in their org` |
| `teams` | `authenticated` | `DELETE` | `Authenticated users can delete teams in their org` |
| `scrim_requests` | `anon` | `SELECT` | `Anon can read open scrim listings` |
| `scrim_requests` | `authenticated` | `SELECT` | `Authenticated users can read relevant scrim requests` |
| `scrim_requests` | `authenticated` | `SELECT` | `Authenticated users can read own org scrim requests` |
| `scrim_requests` | `authenticated` | `INSERT` | `Authenticated users can post scrims for their teams` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Authenticated users can request open scrims` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Authenticated users can edit their open scrim listings` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Authenticated users can retract pending scrim requests` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Posting org can accept inbound scrim requests` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Posting org can decline inbound scrim requests` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Matched org can cancel outbound scrim requests` |
| `scrim_requests` | `authenticated` | `UPDATE` | `Participant org can complete confirmed scrims` |
| `scrim_messages` | `authenticated` | `SELECT` | `Active scrim participants can read messages` |
| `scrim_messages` | `authenticated` | `INSERT` | `Active scrim participants can insert messages` |
| `team_match_reviews` | `authenticated` | `SELECT` | `Users can read match reviews for teams in their org` |
| `team_match_reviews` | `authenticated` | `INSERT` | `Users can insert match reviews for teams in their org` |
| `team_match_reviews` | `authenticated` | `UPDATE` | `Users can update match reviews for teams in their org` |

Current live private helpers:

- `private.current_user_org_id()`: security definer
- `private.current_user_team_ids()`: security definer
- `private.current_user_admins_org(uuid)`: security definer
- `private.enforce_scrim_request_update_scope()`: security definer trigger function
- `private.scrim_request_update_columns_guard(...)`: non-security-definer compatibility guard

Current live trigger:

- `public.scrim_requests` has `BEFORE UPDATE` trigger `enforce_scrim_request_update_scope`, executing `private.enforce_scrim_request_update_scope()`.

## Repo Policy Files

Apply or re-apply the production RLS policy set in this order:

1. `rls_policies.sql`
   - Enables RLS on core tables.
   - Creates the `private` schema helpers.
   - Replaces broad MVP authenticated policies with scoped user/org/team/scrim request policies.
2. `public_read_policies.sql`
   - Revokes broad `anon` grants on public board tables.
   - Grants `anon` column-level `SELECT` only for public Scrim Board fields.
   - Adds anon RLS policies for open, unmatched listings and their posting team/org.
3. `supabase_request_scrim_policy.sql`
   - Adds `private.enforce_scrim_request_update_scope()`.
   - Installs the `scrim_requests` update trigger.
   - Adds request, listing edit, and retract policies for open/pending scrims.
4. `supabase_requests_policies.sql`
   - Adds request-page read and state-transition policies for accept, decline, cancel, and complete.
5. `supabase_scrim_chat.sql`
   - Ensures `scrim_messages` exists, enables RLS, and limits chat reads/inserts to active pending/confirmed scrim participants.
6. `supabase_team_match_reviews.sql`
   - Ensures `team_match_reviews` exists, enables RLS, and scopes match review reads/inserts/updates to the user's organization.
7. `supabase_team_delete_policy.sql`
   - Adds the authenticated org-scoped team delete policy.

Do not re-apply old MVP policies that use `using (true)` or `with check (true)`.

## Safe Apply Procedure

1. Confirm the target project is production project `urrnrcdxekhovsemeuly`.
2. Capture pre-apply state:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

3. Apply the files in the order above. Prefer a transaction per file or a Supabase branch/staging project first when changing production.
4. If any file fails mid-transaction, roll it back and fix the SQL before continuing. Do not continue to later files after a failed baseline file.
5. Re-run the verification queries below before considering the apply complete.

If a committed production change must be reverted, re-apply the last known-good SQL from version control or a database backup. Do not roll back to permissive MVP policies just to restore access.

## Verification Queries

Run these after applying or re-applying policies.

Check RLS coverage:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'users',
    'organizations',
    'teams',
    'scrim_requests',
    'scrim_messages',
    'team_match_reviews'
  )
order by tablename;
```

Check policy inventory:

```sql
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'users',
    'organizations',
    'teams',
    'scrim_requests',
    'scrim_messages',
    'team_match_reviews'
  )
order by tablename, policyname;
```

Check for broad always-true policies:

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    lower(coalesce(qual, '')) = 'true'
    or lower(coalesce(with_check, '')) = 'true'
  )
order by tablename, policyname;
```

Check public board grants:

```sql
select table_name, grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('organizations', 'teams', 'scrim_requests')
  and grantee = 'anon'
order by table_name, column_name, privilege_type;
```

Check private helpers and update trigger:

```sql
select n.nspname as schema_name, p.proname as function_name, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
order by p.proname;

select trigger_name, event_object_table, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'scrim_requests'
  and trigger_name = 'enforce_scrim_request_update_scope';
```

Run Supabase security advisors after changes. On 2026-06-17, advisors reported no RLS always-true findings; the only remaining security warning was `auth_leaked_password_protection`.

## Focused Access QA

Use rollback transactions and `set local role authenticated` with a real non-admin test user when possible.

Minimum checks:

- Own profile is readable/updatable; another user's profile is not readable/updatable.
- Own organization and teams are readable/updatable; another organization's full team/roster rows are not readable.
- Anon can read only open, unmatched public Scrim Board rows and only the granted public columns.
- A posting org can cancel/edit open listings, accept/decline inbound pending requests, and complete confirmed scrims.
- A matched org can request open scrims, retract pending requests, and complete confirmed scrims.
- A non-participant org cannot update request metadata or read scrim chat.
- Match reviews are readable/updatable only for teams in the authenticated user's organization.

## Notes And Caveats

- Production still has some legacy broad table privileges for `anon`/`authenticated` on tables created before the current grant cleanup. RLS is enabled, and absent anon policies still deny row access, but future cleanup can further reduce table-level grants for defense in depth.
- Update policies require matching select visibility. If an update silently affects zero rows, first confirm the actor can select the row under the intended policy.
- The private security-definer helpers intentionally avoid recursive policy evaluation across `users`, `teams`, and `scrim_requests`. Keep them in the `private` schema.
- Repo SQL files are runbooks/manual apply files, not a complete Supabase migration history. Verify live `pg_policies`, grants, triggers, functions, and advisors after every production apply.

## Source References

- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API security docs: https://supabase.com/docs/guides/api/securing-your-api
- Supabase security-definer RLS helper note: https://supabase.com/docs/guides/troubleshooting/do-i-need-to-expose-security-definer-functions-in-row-level-security-policies-iI0uOw
