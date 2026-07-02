# Matchmake MOSEF Admin Reporting Dashboard Concept

Status: MOSEF / high-school pilot concept

Audience: Matchmake owners, MOSEF coordinators, support operators, and launch decision-makers

Related current surface: owner-only `/admin`

## Purpose

The MOSEF admin reporting dashboard should give Matchmake operators and approved MOSEF coordinators a concise operating view of the fall pilot without exposing unnecessary student data.

The dashboard is not a student-facing report form, school discipline system, emergency service, or legal case-management tool. It should help operators answer:

- Which schools and organizations are active enough for pilot follow-up?
- Which teams are using the core scrim and match-review workflows?
- Which support, safety, privacy, or admin-removal issues need owner attention?
- Which launch metrics are strong enough to justify expanding the pilot?
- Which gaps still require manual review in Vercel, Supabase, support records, or restricted case logs?

## Current Baseline

The existing owner-only `/admin` surface already provides the first version of an operations dashboard:

- Owner access is gated by the `is_matchmake_owner` RPC.
- Overview cards show organization, team, user, open scrim, pending request, completed match, and review-success counts from bounded live queries.
- Navigation covers organizations, teams, users, scrims, chat/reports, match reviews, and audit log.
- The dashboard loads bounded record sets: up to 500 users, organizations, teams, and scrims; 250 messages; 250 reviews; and 150 admin activity rows.
- The activity log listens for new `admin_activity_logs` inserts and supports basic filters by people, scrims, messages, reviews, and system activity.
- Owner actions include organization verification changes, scrim status changes, chat message removal, match review removal, team removal, and user membership clearing.

The MOSEF reporting concept should build on that surface instead of creating a second unrelated admin product.

## Primary Users

### Matchmake Owner

Owns platform-level decisions, production access, data safety, admin actions, and final launch readiness.

Needs:

- Current pilot health at a glance.
- Exact records for support or admin action.
- A clear distinction between operational issues, safety reports, privacy requests, and product feedback.
- Evidence that destructive admin actions were approved, performed, and verified.

### MOSEF Coordinator

Coordinates schools and pilot feedback but should not automatically receive broad student-level or cross-school sensitive data.

Needs:

- School-level adoption and readiness summaries.
- Follow-up lists for schools that are blocked, inactive, or missing setup steps.
- De-identified or aggregated usage trends when possible.
- A way to ask Matchmake owners for investigation without seeing restricted details.

### Support Operator

Handles routine support intake and routes issues to safety, privacy, admin-removal, monitoring, or product-feedback processes.

Needs:

- Searchable context by school, organization, team, scrim, and workflow area.
- A queue of unresolved support follow-ups.
- Links to the correct runbook for safety, privacy, admin removal, and routine support.

## Dashboard Areas

### 1. Pilot Health Overview

Use the current `/admin` overview as the landing view, then make the pilot intent explicit.

Recommended widgets:

- Active schools and organizations.
- Active teams by game.
- Posted scrims and request status mix.
- Completed scrims and saved match reviews.
- Screenshot extraction outcomes, including successful, failed, and manual-review-required reviews.
- Open support, safety, privacy, and admin-removal follow-ups.
- Schools needing onboarding attention.

This item defines the concept only. The exact metric definitions and tracking implementation remain separate checklist work.

### 2. School Readiness View

Group pilot data by organization or school so operators can see where each school stands.

Recommended columns:

- School or organization name.
- Verification status.
- Primary coach/admin owner.
- Team count.
- Supported games represented.
- First team created.
- First scrim posted.
- First request sent or received.
- First match review saved.
- Last activity date.
- Current follow-up status.

Student names, emails, chat bodies, and raw screenshots should not appear in the school-readiness summary. Drill-down access should stay owner-only unless a school-specific sharing decision is approved.

### 3. Workflow Funnel

Show where schools drop off during onboarding and first use.

Recommended stages:

1. Account created.
2. Organization created.
3. Team created.
4. First scrim posted.
5. First request accepted or declined.
6. First confirmed scrim scheduled.
7. First match review saved.
8. First coaching insight reviewed.

The funnel should support school-level follow-up, not student ranking or public comparison between schools.

### 4. Support And Follow-Up Panel

The dashboard should surface routine operational follow-ups without becoming the restricted safety or privacy case log.

Recommended buckets:

- Onboarding help.
- Account or access issues.
- Scrim workflow issues.
- Match review or extraction issues.
- Calendar or Discord digest issues.
- Product feedback.
- Escalated to safety, privacy, admin removal, or monitoring.

Support rows should store short summaries, owner, next update date, status, and links to the relevant restricted record when one exists. Sensitive details should remain in the appropriate restricted process.

### 5. Admin Action Review

Use the existing audit log and admin-removal guidance as the foundation.

Recommended additions:

- Daily list of high-impact admin actions.
- Failed admin actions.
- Destructive actions awaiting verification.
- Organization verification changes.
- Scrim cancellations or expirations made by an owner.
- Removed messages or reviews.
- Cleared user memberships.

Each admin action should have a reason, operator, timestamp, affected record IDs, approval source, and post-action verification status.

### 6. Launch Metrics Snapshot

This should become the executive readout for whether the fall pilot is working.

Recommended categories:

- Adoption: schools, organizations, teams, games represented, active coaches/admins.
- Activity: scrims posted, requests sent, requests accepted, completed scrims.
- Match review usage: reviews saved, extraction attempts, manual-review rate.
- Support load: routine tickets, unresolved blockers, average time to response.
- Trust and safety: escalations, removals, unresolved privacy/safety issues.
- Reliability: repeated errors, extraction quota or overload events, blocked workflows.

The exact success thresholds are defined in `docs/fall-pilot-launch-success-metrics.md`.

## Data Sources

Initial implementation can use current production tables and logs:

| Need | Likely source |
| --- | --- |
| Schools and organizations | `organizations` |
| Teams and games | `teams` |
| Users and coach/admin ownership | `users`, organization ownership fields |
| Scrim posting and status | `scrim_requests` |
| Chat follow-up context | `scrim_messages` with restricted owner access |
| Match review and extraction state | `team_match_reviews` parser fields and manual-review flags |
| Owner/admin actions | `admin_activity_logs` |
| Launch analytics events | existing launch analytics events recorded through `admin_activity_logs` |
| Support follow-ups | support records from `docs/mosef-support-contact-process.md`, once the storage location is finalized |
| Safety/privacy/admin-removal cases | restricted case logs, referenced by case ID only in routine dashboard views |

## Privacy And Access Rules

Use the least sensitive view that answers the operational question.

- Keep the dashboard owner-only until role-specific MOSEF coordinator permissions are designed and approved.
- Prefer school-level aggregates over student-level rows for coordinator-facing views.
- Do not show full chat bodies, student emails, private roster links, raw screenshots, raw model output, or sensitive report details in overview widgets.
- Link to restricted case logs by stable case ID instead of copying sensitive details into the dashboard.
- Keep support, safety, privacy, and admin-removal workflows separated even when one incident touches multiple areas.
- Make destructive admin actions require confirmation, reason capture, and post-action verification.
- Avoid public rankings of schools or students based on activity metrics.

## Suggested Information Architecture

For the owner dashboard, keep the current navigation and add MOSEF-focused grouping:

- **Overview:** pilot health, needs-attention cards, recent activity.
- **Schools:** readiness state by organization.
- **Teams:** team setup and supported-game coverage.
- **Scrims:** posting volume, request status, stale items.
- **Reviews:** saved reviews, parser/manual-review state, extraction issues.
- **Support:** routine support follow-ups and escalation routing.
- **Admin Actions:** removals, verification changes, destructive-action verification.
- **Launch Metrics:** weekly pilot readout and expansion readiness.
- **Audit Log:** full owner activity history.

## Operating Cadence

During the first two pilot weeks:

- Review the dashboard once per school day.
- Check schools with no activity after onboarding.
- Check open or pending scrims older than 48 hours.
- Check reviews marked `Needs review`.
- Check failed extraction or support events after planned screenshot-upload sessions.
- Review admin actions and unresolved escalations before any weekly MOSEF readout.

Weekly:

- Produce a school-level readout for MOSEF coordination.
- Summarize blockers, support load, safety/privacy issues, extraction health, and readiness to expand.
- Avoid student names, raw messages, screenshots, private contact information, and sensitive incident details in the readout.

## Implementation Phases

### Phase 1: Documentation And Manual Readout

- Use this concept, existing `/admin`, support records, and monitoring logs.
- Produce a weekly manual pilot readout.
- Keep coordinator sharing aggregated and school-level.

### Phase 2: Owner Dashboard Enhancements

- Add a MOSEF-oriented school readiness view.
- Add metric cards with stable definitions.
- Add support-follow-up status fields once support storage is finalized.
- Add reason and case-link capture for high-impact admin actions.

### Phase 3: Coordinator View

- Add a limited MOSEF coordinator role only after privacy, school, and access expectations are approved.
- Show school-level adoption and follow-up status.
- Hide owner-only controls, sensitive records, full messages, emails, and destructive actions.

## Deferred Decisions

- Where routine support records live.
- Whether MOSEF coordinators get an in-app role or receive exported weekly readouts only.
- Launch-success dashboard implementation based on `docs/fall-pilot-launch-success-metrics.md`.
- Extraction-usage dashboard windows and historical query implementation.
- Abuse/report queue implementation based on `docs/abuse-report-queue-concept.md`.
- Whether safety/privacy case records should ever be represented in the app beyond restricted case IDs.
- Retention and export rules for dashboard snapshots and weekly readouts.

## Ready Criteria

This concept is ready for the MOSEF pilot planning stage when:

- Matchmake owners agree the existing `/admin` surface is the starting point.
- MOSEF coordinator visibility is limited to school-level or approved aggregate views.
- Support, safety, privacy, and admin-removal workflows remain separate.
- The next implementation items define concrete metrics, report-queue behavior, and launch-success thresholds without weakening privacy or school-safety boundaries.
