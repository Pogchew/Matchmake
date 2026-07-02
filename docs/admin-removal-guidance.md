# Matchmake Admin Removal Guidance

Status: MOSEF / high-school pilot operational draft  
Applies to: Matchmake owner administrators using `/admin`  
Related incident process: `docs/inappropriate-behavior-reporting-escalation.md`  
Related privacy process: `docs/school-data-deletion-export-process.md`  
Production schema verified: 2026-06-23 against Supabase project `urrnrcdxekhovsemeuly`

This runbook explains how to remove or restrict teams, users, scrims, and chat messages with the controls that exist today. Use the least destructive action that resolves the problem. It does not authorize an admin to bypass school approval, safety holds, privacy requests, or legal requirements.

## Current Control Matrix

| Resource | Owner dashboard action | What it does | What it does not do |
| --- | --- | --- | --- |
| User | **Clear membership** | Sets the app profile's `org_id` to `null` and `team_ids` to an empty array. | Does not disable or delete the Supabase Auth account, revoke sessions, delete the public profile, or remove the student from team roster JSON/arrays and captain/coach fields. |
| Team | **Remove** | Permanently deletes the team row and activates database cascades described below. | Does not delete the organization or Auth users. Array-based `team_ids` references are not foreign keys and are not cleaned automatically. |
| Scrim | Change **Status** | Changes workflow state. Use `cancelled` to close an active or inappropriate scrim; use `expired` only when the listing is stale. | Does not delete the scrim row. The dashboard has no scrim delete action. |
| Chat message | **Remove** | Permanently deletes one `scrim_messages` row. | Does not redact/edit the message, remove the sender, close the scrim, or preserve the message body in the admin audit log. |
| Match review | **Remove** | Permanently deletes one saved review and any database rows that reference it with `ON DELETE CASCADE`. | Does not remove the team or scrim. This control is adjacent to this runbook but may be needed when reported behavior appears in review notes. |
| Organization | **Unverify** | Removes the platform verification flag. | Does not remove or disable the organization. Organization termination follows the privacy deletion/export process. |

The dashboard is not a full case-management or evidence system. It currently loads bounded result sets, including the latest 250 chat messages and 250 reviews and up to 500 users, organizations, teams, and scrims. Use exact record IDs and an approved read-only database query when a record falls outside those views.

## Required Safeguards Before Any Action

1. Confirm the operator is a Matchmake owner and the request comes from an authorized school contact or an approved Matchmake incident owner.
2. Link the action to a report case ID, privacy request ID, or internal operations note.
3. Identify the exact user, team, scrim, or message by stable UUID. Do not rely only on a display name, team name, or partial text match.
4. Check for an emergency, student-safety investigation, legal hold, civil-rights/Title IX process, dispute, or pending access/export request.
5. Preserve the minimum authorized evidence before any destructive action. The audit log records that an action occurred, but it is not a copy of the deleted content.
6. Determine whether another school or team has an interest in the record, especially for scrims and chat shared by two organizations.
7. Choose the least destructive sufficient action: close a scrim before deleting it, remove one message before deleting a team, and clear school membership before considering Auth-account deletion.
8. Record the intended action, expected cascade, approver, operator, and planned verification.

For an urgent safety case, follow `docs/inappropriate-behavior-reporting-escalation.md` first. Platform removal must not delay emergency or school-safety action.

## User Guidance

### Remove School Access With Clear Membership

Use **Users → Clear membership** when a person should no longer access an organization's data but their Matchmake account may remain.

Before confirming:

- Verify the person's user ID, display name, email, organization, and teams.
- Ask the school whether the person should also be removed from roster display fields, captain/coach assignments, profile text, and external profile links.
- Preserve case evidence before changing membership.

The current action updates only `public.users.org_id` and `public.users.team_ids`. After it succeeds:

1. Confirm the user shows **None** for organization membership.
2. Review every affected team for the person's ID or name in `roster`, `roster_names`, `roster_profiles`, `captain_id`, and `coach_poc_id`.
3. Remove or correct those team fields through an approved team-management or database process. Clearing membership does not do this automatically.
4. Confirm the user can no longer read organization-scoped teams, requests, chat, or match reviews.
5. Record the action and verification in the case log.

### Disable Or Delete An Account

The owner dashboard cannot disable or delete a Supabase Auth account. Do not describe **Clear membership** as account deletion or suspension.

If an authorized request requires account disablement or deletion:

- Follow `docs/school-data-deletion-export-process.md` and use a server-side/admin Auth path; never put a service-role or secret key in client code.
- Review dependent data first. Production currently cascades Auth-user deletion to chat messages where the user is `sender_user_id` and match reviews where the user is `created_by`.
- Resolve ownership blockers and preservation requirements before deletion.
- Revoke/sign out sessions as part of a security removal. Supabase documents that deleting an Auth user does not by itself make an already-issued JWT invalid before expiration.
- Verify both the Auth account state and the public app-profile state afterward.

Deleting only `public.users` is also not a complete account deletion. Production prevents deleting an app user who is still an organization's `org_admin_id`; captain and coach foreign keys are set to `null` only when that app user row is actually deleted.

## Team Guidance

Use **Teams → Remove** only when the team itself must be permanently removed. A warning, roster correction, user membership change, scrim cancellation, or message removal is safer when it resolves the issue.

### Confirmed Production Effects

Deleting a team causes these deployed foreign-key actions:

- Scrims posted by the team are deleted (`scrim_requests.posting_team_id ON DELETE CASCADE`).
- Chat attached to those deleted scrims is deleted (`scrim_messages.scrim_request_id ON DELETE CASCADE`).
- Match reviews owned by the team are deleted (`team_match_reviews.team_id ON DELETE CASCADE`).
- Opponent-posted scrims remain but their `matched_team_id` becomes `null`.
- Messages in surviving opponent-posted scrims remain but their `sender_team_id` becomes `null` when it referenced the deleted team.
- Any installed analytics mirror rows with cascading review/team foreign keys may also be deleted; verify the deployed schema before relying on those optional tables.

The `users.team_ids` and `organizations.team_ids` columns are UUID arrays, not foreign keys. The current owner dashboard team action deletes only the team row, so stale IDs can remain in those arrays unless separately cleaned.

### Procedure

1. Record the team ID, organization ID, name, game, roster, and reason.
2. Inventory posted scrims, matched-opponent scrims, chat, reviews, and any storage/external artifacts.
3. Preserve authorized evidence and export school records when required.
4. Notify affected school contacts when appropriate, especially if two schools share a scrim or chat record.
5. Confirm that the cascade scope is acceptable; then use **Remove** and confirm the exact team shown in the dialog.
6. Re-query the team ID and all affected child records.
7. Remove the deleted team ID from `public.users.team_ids` and `public.organizations.team_ids` through an approved update.
8. Verify opponent-posted scrims remain only where intended and no longer expose the removed team as the matched opponent.
9. Check the public Scrim Board, authenticated organization views, calendar output, Team Stats, and Deep Stats as applicable.
10. Record counts removed, records retained, audit-log evidence, operator, and completion time.

Do not use team deletion as a shortcut for removing one student or one message.

## Scrim Guidance

The owner dashboard changes scrim status; it does not delete scrims.

### Close A Scrim

- Use `cancelled` when an active listing, request, or confirmed scrim must stop because of moderation, safety, scheduling, or school direction.
- Use `expired` only when the listing is stale and should age out.
- Do not mark a scrim `completed` merely to hide it; that state asserts the scrim was completed.
- Record the prior status and reason before changing it.

Changing an active scrim out of `pending` or `confirmed` also makes its chat unavailable under the current participant chat policy. The message rows remain preserved unless separately deleted.

After the status change:

1. Confirm the new status in the dashboard and audit log.
2. Confirm it no longer appears as an active/public listing when applicable.
3. Confirm participants can no longer access active chat for a cancelled/expired scrim.
4. Notify both participating school contacts when appropriate.

### Permanently Delete A Scrim

Permanent scrim deletion is not available in `/admin`. If an authorized privacy, safety, or legal process requires it, use the approved server/database workflow in `docs/school-data-deletion-export-process.md` with the exact scrim ID.

Production deletes all attached chat messages when a scrim request is deleted. Linked match reviews remain, but `team_match_reviews.scrim_request_id` becomes `null`. Preserve evidence and verify both effects before closing the request.

## Chat Message Guidance

Use **Chat & Reports → Remove** when one message violates policy and removing that exact content is sufficient.

Before confirming:

- Capture the message ID, scrim ID, sender user/team IDs, timestamp, text, and necessary surrounding context in the restricted case record.
- Confirm preservation is lawful and safe. Do not copy or forward suspected child sexual abuse material; follow the emergency/reporting process.
- Decide whether the scrim should also be cancelled or the user's school membership reviewed.

After confirming:

1. Verify the exact message ID no longer exists and no longer renders in the conversation.
2. Verify neighboring messages remain unless the approved scope covered them.
3. Confirm the admin activity log records the removal. The log intentionally records generic conversation activity, not the deleted body.
4. Record the reason, approver, operator, evidence location, and completion time in the case log.
5. Notify the verified school contact as allowed by the incident process, without disclosing another student's private information.

There is no message edit/redaction action. For several messages, verify and record each ID; do not delete an entire team or scrim solely to avoid itemized review.

## Read-Only Verification Queries

Run these with an approved read-only connection or SQL editor role. Replace placeholders with verified UUIDs. These queries do not perform removals.

```sql
-- User membership and remaining structured team references
select id, email, org_id, team_ids
from public.users
where id = '<user_id>';

select id, name, roster, roster_names, roster_profiles, captain_id, coach_poc_id
from public.teams
where captain_id = '<user_id>'
   or coach_poc_id = '<user_id>'
   or '<user_id>'::uuid = any(roster);

-- Team and affected relationship counts
select
  (select count(*) from public.teams where id = '<team_id>') as team_rows,
  (select count(*) from public.scrim_requests where posting_team_id = '<team_id>') as posted_scrims,
  (select count(*) from public.scrim_requests where matched_team_id = '<team_id>') as matched_scrims,
  (select count(*) from public.scrim_messages where sender_team_id = '<team_id>') as sender_messages,
  (select count(*) from public.team_match_reviews where team_id = '<team_id>') as reviews;

-- Scrim status, chat, and linked reviews
select id, status, posting_team_id, matched_team_id
from public.scrim_requests
where id = '<scrim_id>';

select count(*) as message_count
from public.scrim_messages
where scrim_request_id = '<scrim_id>';

select count(*) as linked_review_count
from public.team_match_reviews
where scrim_request_id = '<scrim_id>';

-- Exact message check
select id, scrim_request_id, sender_user_id, sender_team_id, created_at
from public.scrim_messages
where id = '<message_id>';
```

Do not paste report contents, student data, or destructive SQL into public tickets or broad chat channels.

## Completion Record

For every action, record:

- Case/request ID and authorization source.
- Resource type and exact UUIDs.
- Prior state and action taken.
- Expected and observed cascade or status effect.
- Preserved evidence location and retention/review date.
- School contacts notified.
- Operator, approver, timestamp, and verification evidence.
- Records intentionally retained and why.
- Follow-up needed for recurrence, retaliation, array cleanup, Auth state, storage, backups, or external systems.

## Current Limitations And Follow-Up

- No dashboard control suspends Auth access or revokes sessions.
- No dashboard control permanently deletes a scrim.
- User membership clearing does not clean team roster/captain/coach fields.
- Team deletion does not clean UUIDs stored in user/organization `team_ids` arrays.
- The admin log is an operational event log, not a complete evidence archive.
- The dashboard's bounded record lists are not an exhaustive database search.
- Destructive controls do not provide an undo workflow.

These limitations should inform future admin work: prefer explicit suspend/deactivate states, exact-ID case linking, pre-action impact previews, transactional cleanup of array references, and post-action verification rather than adding broader one-click deletes.

## References

- Supabase, Cascade Deletes: https://supabase.com/docs/guides/database/postgres/cascade-deletes
- Supabase, User Management: https://supabase.com/docs/guides/auth/managing-user-data
- Matchmake reporting/escalation process: `docs/inappropriate-behavior-reporting-escalation.md`
- Matchmake school data deletion/export process: `docs/school-data-deletion-export-process.md`

