# Matchmake Abuse And Report Queue Concept

Status: MOSEF / high-school pilot concept

Audience: Matchmake owners, incident response owners, support operators, and approved school/MOSEF coordinators

Related current surfaces: owner-only `/admin`, support inbox, restricted case log

Related docs:

- `docs/inappropriate-behavior-reporting-escalation.md`
- `docs/admin-removal-guidance.md`
- `docs/mosef-support-contact-process.md`
- `docs/acceptable-use-policy-draft.md`
- `docs/school-data-deletion-export-process.md`

## Purpose

The abuse/report queue should give Matchmake owners a restricted, auditable place to track platform conduct reports from intake through closure.

It should help operators answer:

- What conduct reports are new, urgent, waiting, or overdue?
- Which school, organization, team, scrim, message, review, profile, or user record is involved?
- Which reports need school safety escalation before any Matchmake platform action?
- Which reports require preservation before content removal or account restriction?
- Which admin actions were requested, approved, performed, and verified?
- Which cases can be summarized to MOSEF or a school without exposing unnecessary student details?

The queue is not an emergency service, school discipline system, legal case-management system, student-facing public complaint wall, or raw evidence vault. It coordinates platform response and links to the approved restricted records that already govern safety, privacy, and removals.

## Current Baseline

Matchmake does not currently provide a dedicated in-app report form or abuse queue.

Current operating pieces are:

- School-first reporting and Matchmake escalation in `docs/inappropriate-behavior-reporting-escalation.md`.
- Routine support intake in `docs/mosef-support-contact-process.md`.
- Owner-only inspection and moderation controls in `/admin`.
- Chat message removal, match review removal, scrim status changes, team removal, organization verification changes, and user membership clearing in the owner dashboard.
- Admin action history in `admin_activity_logs`.
- A required restricted case log outside the app until a dedicated queue exists.

The first abuse/report queue should replace scattered manual tracking, not weaken the current safety boundary. The existing school-first reporting path remains the source of truth for emergency and student-safety routing.

## Primary Users

### Matchmake Incident Owner

Owns triage, platform containment, evidence preservation decisions, and final case closure.

Needs:

- One list of open conduct reports.
- Severity, status, owner, next update, and overdue flags.
- Exact stable record IDs for platform context.
- Links to restricted evidence and school communications.
- A durable record of decisions and admin actions.

### Matchmake Support Operator

Receives reports through the support inbox or coach/admin contact path and routes them correctly.

Needs:

- A safe intake form with required fields.
- Clear separation between routine support and conduct/safety reports.
- Prompts that prevent over-collection of student details.
- Escalation routing when the report is urgent, privacy-sensitive, or outside support scope.

### School Contact

Owns school safety, student welfare, discipline, parent/guardian communication, and school policy response.

Needs:

- A case ID for coordination.
- A way to provide verified context without seeing unrelated cross-school data.
- Updates that do not disclose another student's private information.
- Platform actions recorded clearly enough for school follow-up.

### MOSEF Coordinator

May coordinate pilot health and school follow-up, but should not receive broad report details by default.

Needs:

- Aggregated counts and unresolved-blocker status when approved.
- School-level readiness impact, not raw messages or student details.
- A channel to ask the Matchmake incident owner for status.

## Queue Scope

### In Scope

- Inappropriate scrim chat.
- Harassment, bullying, threats, retaliation, or discriminatory conduct.
- Unsafe profile links, roster text, team names, logos, or public scrim listing content.
- Bad-faith scrim behavior that may require platform action.
- Match review notes or saved data used to shame, harass, mislead, or expose students.
- Reports that need message removal, scrim cancellation, team restriction, organization review, or user membership review.
- Reports connected to support, privacy, or data deletion requests where conduct context matters.

### Out Of Scope

- Immediate emergencies as the first response path.
- School discipline decisions.
- Legal advice, mandated reporting decisions, or Title IX/civil-rights determinations.
- Routine product bugs unless they expose students or enable abuse.
- Public feature requests or general feedback.
- Storing raw sensitive evidence that belongs in a restricted evidence location.

Out-of-scope reports can still create a queue entry for platform coordination, but the entry should link to the owning process and minimize copied details.

## Intake Sources

Phase 1 can use manual owner-created cases from:

- Published support/reporting inbox.
- Verified coach or school administrator request.
- MOSEF coordinator handoff.
- Internal owner discovery while reviewing `/admin`.
- Privacy or deletion request that reveals conduct context.
- Production monitoring that indicates abuse-like behavior, such as spam or repeated bad-faith actions.

Later phases can add an in-app report form, but only after the intake, privacy, role, and school-notification rules are approved.

## Minimum Case Fields

Every queue entry should have:

| Field | Purpose |
| --- | --- |
| Case ID | Stable identifier, such as `MM-ABUSE-0001` |
| Received at | Timestamp and time zone |
| Intake source | Support inbox, school contact, MOSEF handoff, owner review, or in-app report |
| Reporter role | Student, coach, school admin, parent/guardian, MOSEF coordinator, Matchmake owner, or unknown |
| School/org context | Affected organization IDs and school names when verified |
| Severity | Severity 0, 1, or 2 from the reporting escalation process |
| Status | Queue workflow state |
| Owner | Matchmake incident owner responsible for next action |
| Next update due | Timestamp for follow-up or review |
| Affected records | Stable IDs for user, team, org, scrim, message, review, or admin log rows |
| Report summary | Short neutral summary, not full sensitive evidence |
| Safety flags | Immediate danger, self-harm, exploitation, discrimination, doxxing, retaliation, privacy, legal hold |
| School contact status | Needed, contacted, waiting, school owns next step, or not applicable |
| Preservation status | Not needed, pending, complete, blocked, or prohibited |
| Platform action requested | None, investigate, remove message, cancel scrim, restrict user/team, preserve records, other |
| Platform action result | Action taken, no action, referred, waiting, or blocked |
| Related IDs | Support ID, privacy request ID, admin action ID, evidence location, or school case ID |
| Closure outcome | Substantiated, not substantiated, inconclusive, referred, duplicate, withdrawn, or resolved by school |
| Retention review date | Case-specific review date based on approved policy |

Do not store passwords, one-time codes, private student contact details, medical details, disciplinary records, or suspected child sexual abuse material in the queue.

## Status Model

Use a small status set that is easy to operate:

- New - received but not yet triaged.
- Triage - owner is classifying severity, school context, and immediate risk.
- Waiting on school - verified school contact owns the next response or context.
- Waiting on Matchmake - Matchmake is preserving, reviewing, or taking platform action.
- Escalated - moved to emergency, school safety, civil-rights, privacy, legal, or security owner.
- Action pending - approved platform action is waiting for operator execution.
- Verification pending - action was taken and needs record-level verification.
- Monitoring - case is contained but recurrence or retaliation should be checked.
- Closed - outcome recorded and next review/retention date set.

Cases should not be closed only because content was removed. Closure requires outcome, verification, notification decision, and retention/review date.

## Severity Model

Reuse the reporting escalation severity levels:

- Severity 0 - emergency or immediate safety concern.
- Severity 1 - urgent safety, civil-rights, exploitation, doxxing, retaliation, or repeated targeted conduct.
- Severity 2 - standard conduct violation, spam, isolated inappropriate chat, misleading listing, or bad-faith scrim behavior.

If severity is unclear, start higher until an incident owner reviews the facts.

The queue can show severity, but it must also show the emergency warning: Matchmake support is not monitored continuously and must not delay emergency or school-safety action.

## Workflow

1. Receive the report through an approved intake path.
2. Check whether anyone may be in immediate danger and route emergencies outside the queue first.
3. Create a case with the minimum required fields.
4. Assign severity, owner, next update time, and school-contact status.
5. Record stable Matchmake IDs and preserve authorized records before destructive action.
6. Link, do not copy, restricted evidence and school communications.
7. Review platform context in `/admin` or approved read-only database queries.
8. Decide whether Matchmake platform action is needed.
9. Execute approved admin actions under `docs/admin-removal-guidance.md`.
10. Verify the exact record-level effect and audit-log entry.
11. Notify the verified school contact or reporter only with information that can be shared.
12. Close or monitor the case with outcome, recurrence checks, and retention review date.

## Admin Dashboard Relationship

The abuse/report queue should sit beside the current owner dashboard, not replace it.

Recommended owner dashboard links:

- From **Chat & Reports**, create or link a case for a specific `scrim_messages.id`.
- From **Scrims**, create or link a case for a specific `scrim_requests.id`.
- From **Teams**, create or link a case for a specific `teams.id`.
- From **Users**, create or link a case for a specific `users.id`.
- From **Match Reviews**, create or link a case for a specific `team_match_reviews.id`.
- From **Audit Log**, show owner actions connected to a case ID.

Recommended queue indicators:

- Open Severity 0/1 cases.
- Cases overdue for next update.
- Cases waiting on school.
- Cases awaiting preservation before removal.
- Destructive actions pending verification.
- Cases reopened for recurrence or retaliation.

Do not show full case narratives or sensitive evidence in overview cards.

## Data Model Concept

A future in-app implementation can start with three restricted tables:

### `report_cases`

Stores the case header, severity, status, owner, summary, school/org context, timing, outcome, and retention review date.

### `report_case_links`

Stores links from a case to platform records such as users, organizations, teams, scrim requests, messages, match reviews, admin activity logs, support IDs, privacy request IDs, and external restricted evidence locations.

### `report_case_events`

Stores the timeline: intake, severity changes, owner assignment, school contact, preservation, admin action request, admin action completion, verification, notifications, escalation, monitoring, and closure.

The queue should not store broad copies of chat bodies or raw screenshots by default. It should store stable IDs and a restricted evidence pointer when preservation is approved.

## Access Rules

Initial access should stay Matchmake-owner-only.

Before any coordinator or school-facing queue view exists:

- Define role-specific permissions.
- Confirm what school contacts may see for their own organization.
- Keep cross-school reports hidden unless sharing is approved.
- Hide student emails, full chat bodies, private profile links, raw screenshots, raw model output, and sensitive case notes from summary views.
- Prevent ordinary organization users from seeing whether someone else reported them.
- Require owner review before exporting or sharing report summaries.

School contacts may need case status updates, but they should receive them through the approved communication path until school-specific in-app permissions are designed.

## Evidence And Privacy Rules

- Preserve the least amount of information needed for safety, platform enforcement, school coordination, legal obligations, and dispute handling.
- Prefer stable IDs, timestamps, URLs, actor IDs, and short neutral summaries over copied student content.
- Do not ask reporters to forward suspected child sexual abuse material.
- Do not copy sensitive evidence into public tickets, broad Slack/Discord channels, GitHub issues, or routine product-feedback docs.
- Keep support, safety, privacy, and admin-removal records linked but separate.
- Apply legal holds before deletion when required.
- Capture who preserved evidence, when, where it is stored, and who can access it.
- Record when evidence should be reviewed, deleted, or retained under the final school agreement.

## Metrics For MOSEF Readouts

MOSEF-facing readouts should use aggregated, low-detail metrics:

- New reports by severity.
- Open reports by status.
- Median time to first owner triage.
- Cases waiting on school versus Matchmake.
- Platform actions taken by type.
- Cases closed by outcome.
- Repeat incidents by organization or workflow area, shared only when approved.
- Overdue cases and unresolved blockers.

Do not include student names, message bodies, screenshots, private contact details, or sensitive allegations in routine MOSEF reports.

## Implementation Phases

### Phase 1: Manual Queue Template

- Use the restricted case log required by `docs/inappropriate-behavior-reporting-escalation.md`.
- Adopt the fields and statuses in this concept.
- Add case IDs to admin-removal completion records.
- Review the queue each school day during the first pilot weeks.

### Phase 2: Owner-Only In-App Queue

- Add restricted `report_cases`, `report_case_links`, and `report_case_events` tables.
- Add owner-only queue list, case detail, and create-case flow.
- Link existing `/admin` resources to cases by stable IDs.
- Add reason, case ID, and verification capture for destructive admin actions.

### Phase 3: In-App Report Intake

- Add report controls only where users can provide useful context without over-sharing.
- Route students to school/emergency channels for urgent safety issues.
- Require coach/admin or verified school context for platform action requests when appropriate.
- Create cases with stable record IDs and minimal free text.

### Phase 4: School Or Coordinator Views

- Add limited school-specific or coordinator views only after privacy, school, and access rules are approved.
- Show status and aggregate blockers, not cross-school sensitive details.
- Keep platform action controls owner-only unless a future governance model explicitly approves delegation.

## Deferred Decisions

- Final support/reporting inbox and staffed business hours.
- Restricted case-log storage location for Phase 1.
- Whether in-app student reporting is appropriate for the high-school pilot.
- Whether school contacts can view their own case statuses in-app.
- Whether MOSEF coordinators receive an in-app role or only aggregate readouts.
- Final retention periods and legal-hold procedures.
- Whether report tables should store encrypted evidence pointers, object storage paths, or external case IDs.
- How to suspend or disable Auth users if a case requires access restriction beyond current membership clearing.

## Ready Criteria

This concept is ready for pilot planning when:

- The incident owner, backup owner, reporting contact, and business hours are named.
- A restricted manual case log exists with the fields and statuses above.
- Operators know when to route to emergency, school safety, privacy, support, admin-removal, monitoring, or product-feedback processes.
- Current `/admin` moderation actions require a case or support reference for conduct-related destructive actions.
- MOSEF and school-facing summaries are limited to approved aggregate or school-specific information.
- The queue does not collect or expose more student information than needed for the response.
