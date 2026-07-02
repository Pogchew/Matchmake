# Matchmake School Data Deletion And Export Process

Status: Defined launch process for school/district and legal review

Last updated: 2026-06-18

This process defines how Matchmake should handle school, district, organization, parent/guardian, eligible-student, and user requests to access, export, correct, delete, or return school-controlled data. It is written for the current Matchmake Supabase data model and launch documents.

This is not legal advice. Counsel should review the final retention windows, request deadlines, authentication steps, and any state or district-specific requirements before publication or contract signature.

## Operating Principles

- Treat school-managed requests as school-controlled unless a signed agreement or law requires a direct response to a parent/guardian, eligible student, or individual user.
- Export requested records before destructive deletion whenever the school asks for return of data, contract termination support, or parent/eligible-student access support.
- Do not delete education records after Matchmake knows there is an outstanding access, inspection, review, dispute, safety, or legal preservation request covering those records.
- Delete or de-identify data when it is no longer needed for the school-authorized purpose, subject to school instructions, legal obligations, security needs, backup retention, and technical feasibility.
- Keep request records separate from deleted school data so Matchmake can prove what was requested, approved, completed, and confirmed.
- Use service-role or database-admin access for production export/deletion operations. Do not ask school staff or students to run SQL.

## Request Intake And Verification

Requests should go to `[privacy contact email]` or the support channel named in the final Privacy Policy and Data Privacy Agreement.

Required intake fields:

- Requester name, email, role, and organization.
- School/district name and Matchmake organization name.
- Request type: access, export, correction, deletion, return, account removal, organization termination, calendar-token rotation, or public-visibility review.
- Scope: entire organization, one team, one user, one student, one scrim, one match review series, one calendar token, or one public listing.
- Requested deadline and legal basis, if provided.
- Whether there is an active FERPA, COPPA, school investigation, legal hold, safety issue, or dispute that affects deletion timing.

Verification steps:

1. Confirm the requester is the organization administrator, an authorized school/district official, the privacy contact named in the school agreement, or another person authorized by the school.
2. If the requester is a parent/guardian or eligible student, route through the school unless the final agreement, law, or school instruction authorizes Matchmake to respond directly.
3. Confirm the affected organization ID, user IDs, team IDs, scrim request IDs, match review IDs, and any storage paths before exporting or deleting.
4. Log the request in the privacy-request tracker with request date, owner, scope, due date, status, and completion evidence.

## Response Targets

Default targets for launch:

- Acknowledge privacy requests within 5 business days.
- Complete routine school exports within 15 business days when scope is clear and no engineering work is required.
- Complete routine school deletion requests within 30 calendar days after approval and export, unless school instruction, legal hold, investigation, backup retention, or technical constraints require more time.
- Support FERPA access requests quickly enough for the school to satisfy the FERPA access window of no more than 45 days after request receipt, or any shorter state/local deadline that applies to the school.
- For COPPA-covered under-13 data, support school/parent review and deletion requests, prevent further use or collection when authorization is missing or revoked, and follow `docs/under-13-coppa-handling.md`.

If a deadline cannot be met, Matchmake should document why, notify the school contact, and provide an updated completion estimate.

## Current Data Inventory

Primary Supabase tables and fields:

| Area | Tables/fields | Export/deletion notes |
| --- | --- | --- |
| Users | `public.users`; Supabase Auth user records | Public profile row includes email, display name, account type, org/team IDs, linked game accounts, about text, external profile URLs, timestamps. Supabase Auth deletion requires admin tooling. |
| Organizations | `public.organizations` | Includes name, type, admin, school domain, region, verification flag, calendar feed token, team IDs, college outreach flag, optional logo URL. |
| Teams and rosters | `public.teams` | Includes org ID, team name, game title, mode, roster IDs, roster names, roster profiles, captain/coach IDs, rank, rating, region, timestamps. |
| Scrim listings and requests | `public.scrim_requests` | Posted scrims cascade when the posting team is deleted. If a deleted team was only the matched opponent, `matched_team_id` is set to null by the schema. |
| Scrim chat | `public.scrim_messages` | Messages cascade when the related scrim request is deleted. If a sender team is deleted, `sender_team_id` is set to null. If the auth user is deleted, sender-linked messages cascade. |
| Match reviews | `public.team_match_reviews` | Reviews cascade when the reviewed team is deleted. Scrim links are set null if the scrim request is deleted. Screenshot URLs may point to external/storage objects if that feature is enabled. |
| Calendar feeds | `organizations.calendar_feed_token`; calendar feed route | Token should be rotated or nulled for deactivation. Calendar apps may cache old feed copies outside Matchmake. |
| Organization logos | `public.organizations.logo_url`; `org-logos` storage bucket if enabled | Delete storage objects under the organization ID prefix and clear logo URL. |
| Screenshot extraction | `POST /api/postgame/extract` request handling | Current route processes uploads and returns structured data. It does not intentionally persist uploaded images unless a separate product flow stores a screenshot URL or review record. |
| Operational records | server logs, security logs, rate-limit counters, backups | Keep only as long as needed for security, debugging, abuse prevention, legal compliance, backup integrity, and dispute handling. |

## Export Package

For an organization export, prepare a zip folder named:

`matchmake-export-<organization-slug>-<yyyy-mm-dd>/`

Recommended files:

- `manifest.json`: export timestamp, requester, approver, organization ID/name, included scopes, excluded scopes, and operator contact.
- `organization.json`: organization record, logo URL, calendar token status, verification status, and settings.
- `users.json`: users whose `org_id` matches the organization, limited to fields needed for school records and support.
- `teams.json`: team metadata, roster names, roster profiles, captain/coach references, and public visibility fields.
- `scrim_requests.json`: scrims posted by organization teams plus scrims where organization teams are matched opponents.
- `scrim_messages.json`: messages from scrims included in scope, subject to school/legal review when messages include another organization's data.
- `team_match_reviews.json`: match review records for organization teams, including extracted player/stat rows.
- `calendar_feed.ics`: current calendar feed output when a calendar token is active and the school requests it.
- `public_visibility_review.csv`: fields currently visible on public Scrim Board listings for the school organization.
- `deletion_plan.md`: proposed deletion scope, records excluded from deletion, and reason for each exclusion.

Preferred formats:

- JSON for structured database records.
- CSV for school review spreadsheets when requested.
- ICS for calendar export.
- Markdown or PDF for the completion certificate.

Delivery requirements:

- Share exports only with verified school contacts.
- Use an encrypted file, expiring link, or other approved secure transfer method.
- Do not send exports to a student, parent/guardian, coach, or third party until the school authorizes that delivery or law requires it.
- Record delivery timestamp, recipient, file hash if available, and expiration date.

## Export Query Checklist

Before running destructive changes, collect IDs:

```sql
select id, name, org_admin_id, calendar_feed_token, logo_url
from public.organizations
where id = '<org_id>';

select id, email, display_name, org_id, team_ids, created_at, updated_at
from public.users
where org_id = '<org_id>'
order by created_at;

select id, name, org_id, game_title, roster_names, roster_profiles, created_at, updated_at
from public.teams
where org_id = '<org_id>'
order by created_at;
```

Export organization-related scrims:

```sql
with org_teams as (
  select id
  from public.teams
  where org_id = '<org_id>'
)
select sr.*
from public.scrim_requests sr
where sr.posting_team_id in (select id from org_teams)
   or sr.matched_team_id in (select id from org_teams)
order by sr.scheduled_at, sr.created_at;
```

Export chat for included scrims:

```sql
with org_teams as (
  select id
  from public.teams
  where org_id = '<org_id>'
),
org_scrims as (
  select sr.id
  from public.scrim_requests sr
  where sr.posting_team_id in (select id from org_teams)
     or sr.matched_team_id in (select id from org_teams)
)
select sm.*
from public.scrim_messages sm
where sm.scrim_request_id in (select id from org_scrims)
order by sm.scrim_request_id, sm.created_at;
```

Export match reviews:

```sql
with org_teams as (
  select id
  from public.teams
  where org_id = '<org_id>'
)
select tmr.*
from public.team_match_reviews tmr
where tmr.team_id in (select id from org_teams)
order by tmr.played_at desc nulls last, tmr.created_at desc;
```

## Deletion Modes

Use the least destructive mode that satisfies the request and the school agreement.

### Account Removal

Use when a person leaves a school program but the school wants team history retained.

Steps:

1. Export or review affected user data if requested.
2. Remove the user from rosters, captain/coach fields, and school-visible profile fields.
3. Set `public.users.org_id` to null or delete the profile row if approved.
4. Delete or disable the Supabase Auth user only if the school/user no longer needs access and no preservation duty applies.
5. Keep school-owned team, scrim, chat, and match review records unless the school requests broader deletion.

### Team Deletion

Use when a school retires one team but keeps the organization active.

Current app behavior supports authenticated org-scoped team deletion. The schema cascades:

- Posted scrim requests where `scrim_requests.posting_team_id` is the deleted team.
- Scrim messages attached to those deleted scrim requests.
- Team match reviews where `team_match_reviews.team_id` is the deleted team.

The schema does not fully erase all opponent-side traces:

- Scrim requests posted by another team keep the row and set `matched_team_id` to null if this team was the matched opponent.
- Scrim messages in opponent-owned scrims may remain unless the scrim request itself is deleted or a separate moderation/anonymization step is approved.

### Organization Termination

Use when a school or district ends Matchmake use.

Required sequence:

1. Confirm authority and scope.
2. Check for legal hold, school investigation, safety issue, active dispute, or outstanding FERPA/COPPA access request.
3. Export the organization package if requested or required.
4. Disable public surfaces: cancel open scrim listings, rotate/null `calendar_feed_token`, clear public logo URL, and delete logo storage objects if enabled.
5. Delete or anonymize school-owned records in this order:
   - `scrim_messages` attached to school-posted scrims or specifically approved scrims.
   - `team_match_reviews` for school teams.
   - `scrim_requests` posted by school teams.
   - School teams.
   - School organization.
   - Public user profiles or Supabase Auth users, if approved and not needed for request audit records.
6. Review opponent-owned scrims where school teams were only `matched_team_id`. Decide with counsel/school whether to leave the row with `matched_team_id` null, delete the row, or remove/anonymize school-identifying message fields.
7. Confirm no school records remain in public Scrim Board output, calendar feed output, org logo storage, or active app views.
8. Issue completion confirmation.

### Targeted Record Deletion Or Correction

Use when a school asks to remove a student from a roster, correct a profile, remove a chat message, delete a screenshot-linked review, or close a public listing.

For owner-dashboard control boundaries, cascade warnings, incident evidence handling, and post-action checks, also follow `docs/admin-removal-guidance.md`.

Steps:

1. Confirm the exact record and affected IDs.
2. Export the original record if the school asks for evidence or if the record is part of an investigation.
3. Apply the smallest update or deletion that satisfies the request.
4. Verify the record is no longer visible to unauthorized users or public views.
5. Document completion in the request tracker.

## Retention Windows For Launch

These are launch defaults for review, not final legal commitments:

| Data category | Default active retention | Deletion trigger | Notes |
| --- | --- | --- | --- |
| Account/profile data | While account or school organization is active | User leaves, school requests removal, or organization terminates | Keep minimal request/audit metadata separately when needed. |
| Organization/team/roster data | While organization/team is active | Team deletion, organization termination, or school correction request | Roster entries should be removed promptly when school says a student is no longer on the team. |
| Open scrim listings | Until expired/cancelled/completed or organization/team is deleted | School request, team deletion, or org termination | Public listings should disappear immediately after cancellation/deletion. |
| Scrim chat | While needed for active scrim coordination, school history, safety, disputes, or school records | School deletion request or org termination after preservation review | Chat may include two organizations, so deletion should consider both schools' interests. |
| Match reviews and extracted stats | While needed for team history, analytics, school records, disputes, or program review | School deletion request, team deletion, or org termination | If saved screenshot URLs exist, delete linked objects too. |
| Calendar feed tokens | While school wants feed active | Rotation/disable request or org termination | Third-party calendar clients may cache data after token disablement. |
| Uploaded extractor images | Not intentionally retained by current extractor route | Not applicable unless a separate storage flow is enabled | Saved extracted data lives in match review records. |
| Operational logs/rate limits | Limited period needed for security, abuse prevention, debugging, and legal compliance | Log retention schedule | Avoid using deleted school data from backups except for restoration, security, legal, or dispute needs. |
| Backups | Backup-provider schedule | Natural expiry or backup rotation | Do not restore deleted school data to active systems except for approved recovery/legal/security reasons. |

## Production Deletion Checklist

Before deletion:

- Verify requester authority and school instructions.
- Verify IDs and affected tables.
- Check preservation blockers.
- Export and securely deliver requested data.
- Confirm the school approved deletion after export, if export was requested.
- Create a deletion work note with exact SQL/admin actions planned.

During deletion:

- Use a transaction where practical.
- Prefer explicit ID lists over name/email matching.
- Disable public access surfaces first.
- Delete storage objects and external artifacts associated with the school scope.
- Apply database deletions or anonymization.
- Record row counts and object paths removed.

After deletion:

- Re-query affected tables by organization ID, team IDs, user IDs, scrim IDs, and storage prefixes.
- Check public Scrim Board results and calendar feed URL if a token existed.
- Check authenticated org-scoped views with a test/admin account where practical.
- Record completion date, operator, query evidence, excluded records, and backup/log caveats.
- Send the school a completion confirmation or certificate.

## Completion Confirmation Template

Subject: Matchmake data request completed for `[School/Organization]`

Body:

```text
Matchmake completed the requested [export/deletion/correction/return] for [School/Organization] on [date].

Scope completed:
- [organization/team/user/scrim/review IDs or plain-language scope]

Export delivered:
- [yes/no/not requested]
- [delivery method and date, if applicable]

Deletion or correction completed:
- [summary of records removed, deactivated, corrected, or retained]

Records not deleted:
- [none, or list records retained for legal hold, school instruction, backup rotation, dispute, security, or technical reason]

Backup/log note:
- Deleted data may remain in encrypted backups or operational logs until normal retention expiry, but Matchmake will not actively use it except for restoration, legal compliance, security, or dispute purposes.

Contact:
- [privacy contact email]
```

## Open Owner Decisions

Before publication or school signature, Matchmake still needs to decide:

- Final privacy contact and request tracker owner.
- Exact production backup retention period and log retention period.
- Whether organization termination deletes Supabase Auth users by default or only disables/removes organization access.
- Whether school export packages will include two-party scrim chats by default or only on school/legal approval.
- Whether deletion confirmations will be signed PDFs, email confirmations, or DPA-specific certificates.
- Whether counsel or a participating school/district requires shorter deletion targets for under-13/COPPA data than the launch defaults in this process.

## References Used

- U.S. Department of Education PTAC, Best Practices for Data Destruction: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/Best%20Practices%20for%20Data%20Destruction%20%282019-3-26%29.pdf
- U.S. Department of Education, FERPA access timing FAQ: https://studentprivacy.ed.gov/faq/how-long-does-educational-agency-or-institution-have-comply-request-view-records
- FTC, Complying with COPPA: Frequently Asked Questions: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC, Children's Online Privacy Protection Rule: A Six-Step Compliance Plan for Your Business: https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
