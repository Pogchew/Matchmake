# Matchmake Fall Pilot Launch Success Metrics

Status: MOSEF / high-school pilot scorecard

Audience: Matchmake owners, MOSEF coordinators, support operators, and launch decision-makers

Related docs:

- `docs/mosef-admin-reporting-dashboard-concept.md`
- `docs/abuse-report-queue-concept.md`
- `docs/fall-pilot-feedback-collection-plan.md`
- `docs/mosef-support-contact-process.md`
- `docs/production-monitoring-logging-strategy.md`

## Purpose

This scorecard defines how Matchmake should judge whether the MOSEF / high-school fall pilot is working well enough to continue, fix, or expand.

The goal is not to prove broad market demand from a small pilot. The goal is to answer whether real schools can use Matchmake's core workflows safely and repeatedly with manageable support:

- Can schools onboard without constant one-on-one help?
- Can teams post and complete scrims?
- Can coaches save useful match reviews from screenshots or manual entry?
- Can Matchmake respond to support, privacy, and safety issues without losing track?
- Can the product operate without repeated launch-blocking errors?
- Can MOSEF receive a useful school-level readout without exposing sensitive student data?

## Decision Windows

Use three decision windows.

| Window | Timing | Decision |
| --- | --- | --- |
| Launch week | First 5 school days after pilot start | Verify that onboarding, support, and production monitoring are working. |
| First month | First 4 school weeks | Decide whether the pilot is viable enough to continue with the first schools. |
| Expansion review | After 6 to 8 school weeks | Decide whether to invite more schools or keep the pilot capped. |

Do not expand based on one strong demo or one enthusiastic school if support, safety, privacy, or reliability signals are unresolved.

## Scorecard States

Use three states for every metric:

- Green - strong enough for the current pilot stage.
- Yellow - usable, but requires owner attention before expansion.
- Red - blocks expansion or requires immediate remediation.

A single Red in safety, privacy, or reliability can override Green adoption metrics. Student safety and data protection are gate metrics, not tradeoffs against activity.

## North Star

The fall pilot is successful when at least three verified schools can complete a full scrim workflow and one match-review workflow, while Matchmake keeps support load, safety reports, privacy handling, and production reliability within the operating targets below.

Full workflow means:

1. School or organization is verified.
2. At least one team is created.
3. At least one scrim is posted or requested.
4. At least one scrim reaches `completed`.
5. At least one match review is saved by screenshot extraction or manual entry.
6. Any support, safety, privacy, or admin-removal issue has a tracked owner and next action.

## Core Success Thresholds

### Adoption

| Metric | Green | Yellow | Red | Source |
| --- | --- | --- | --- | --- |
| Verified participating schools | 3 or more verified schools active in the pilot | 2 verified schools active | Fewer than 2 verified schools active | `organizations`, support tracker |
| Active teams | 6 or more teams across verified pilot schools | 3 to 5 teams | Fewer than 3 teams | `teams` |
| Supported game coverage | 2 or more supported games represented by active teams | 1 supported game represented | No active supported-game teams | `teams.game_title` |
| Active coach/admin users | 3 or more coach/admin users complete a core workflow | 1 to 2 coach/admin users complete a core workflow | No coach/admin completes a core workflow | `users`, feedback/support tracker |

Active means the school, team, or user has used a core workflow during the decision window, not merely signed up.

### Scrim Activity

| Metric | Green | Yellow | Red | Source |
| --- | --- | --- | --- | --- |
| Posted scrims | 8 or more scrims posted by verified pilot schools | 3 to 7 posted scrims | Fewer than 3 posted scrims | `scrim_requests` |
| Completed scrims | 4 or more completed scrims | 1 to 3 completed scrims | No completed scrims | `scrim_requests.status` |
| Completion rate | 40% or more of posted scrims complete or have a documented school reason not to complete | 20% to 39% completion | Below 20% completion without a documented reason | `scrim_requests`, support tracker |
| Stale open/pending scrims | Fewer than 20% of active scrims stale for more than 48 hours | 20% to 40% stale | More than 40% stale | `/admin`, `scrim_requests.updated_at` |

Do not count cancelled scrims as product failure when the cancellation was school-directed, safety-related, or a healthy scheduling correction.

### Match Review And Extraction Usage

| Metric | Green | Yellow | Red | Source |
| --- | --- | --- | --- | --- |
| Saved match reviews | 4 or more saved reviews across at least 2 schools | 1 to 3 saved reviews | No saved reviews | `team_match_reviews` |
| Screenshot extraction attempts | 4 or more extraction attempts with coach review before saving | 1 to 3 attempts | No attempt after a planned review session | `admin_activity_logs`, `team_match_reviews` |
| Manual-review rate | 30% or lower need manual correction, excluding known bad screenshots | 31% to 60% need correction | More than 60% need correction or coaches cannot trust the draft | `team_match_reviews.manual_edit_required`, feedback |
| Fallback success | Coaches can manually save when extraction fails | Manual fallback needs operator help | Coaches cannot save a review after extraction fails | feedback/support tracker |

Extraction success should never be framed as official scoring accuracy. Coaches remain responsible for reviewing and correcting saved data.

### Support And Feedback

| Metric | Green | Yellow | Red | Source |
| --- | --- | --- | --- | --- |
| Priority 1 response | Same business day acknowledgement and next action for school-blocking issues | Missed once with documented follow-up | Repeated missed Priority 1 response or no owner | support tracker |
| Routine support response | Priority 2 issues acknowledged within 2 business days | One or two late acknowledgements | Repeated late or lost routine support | support tracker |
| Workflow blocker rate | No unresolved launch blocker older than 5 business days | One unresolved blocker with workaround | Any blocker prevents a school from using core workflows with no workaround | feedback/support tracker |
| Feedback coverage | Feedback from 3 or more schools or all active schools, whichever is smaller | Feedback from 1 to 2 schools | No structured feedback | feedback tracker |

Support success means issues are acknowledged, owned, routed, and either resolved or given a practical workaround. It does not require every product request to be built during the pilot.

### Trust, Safety, And Privacy

| Metric | Green | Yellow | Red | Source |
| --- | --- | --- | --- | --- |
| Emergency or Severity 0 reports | None, or routed immediately to school/emergency process with platform support tracked | One received and routed, but documentation incomplete | Any emergency report mishandled or treated as routine support | restricted case log |
| Severity 1 reports | Owned, tracked, and coordinated same business day | One late action with documented correction | Unowned, lost, or unresolved Severity 1 report | restricted case log |
| Privacy/data requests | Every request has owner, status, and next action | One request needs cleanup but is tracked | Lost request, missed deadline, or unsafe disclosure | privacy/support tracker |
| Sensitive-data handling | No raw screenshots, chat logs, private contact details, or incident narratives in broad docs/tickets | One corrected overshare | Repeated overshare or public exposure | support/review audit |
| Admin-removal verification | Conduct-related destructive actions have case/support reference and verification | One action missing follow-up verification | Destructive action without evidence preservation or owner approval | `/admin`, admin-removal log |

Any Red in this section means the pilot should not expand until the root cause is fixed and school expectations are reset.

### Reliability

| Metric | Green | Yellow | Red | Source |
| --- | --- | --- | --- | --- |
| Auth/onboarding errors | No repeated school-facing auth, signup, org, or team creation failures | One repeated class with workaround | Repeated blocker with no same-day workaround | Vercel/Supabase logs |
| Scrim workflow errors | No repeated posting, request, chat, or calendar failures during active use | One repeated non-blocking issue | Repeated failure blocks scheduled scrims | Vercel/Supabase logs |
| Extraction reliability | No repeated `500`, quota, overload, or timeout class during planned upload sessions | Repeated issue with manual fallback | Repeated issue prevents review workflow | Vercel logs, `admin_activity_logs` |
| Daily log review | Owner checks logs every school day during first two weeks | One missed check with catch-up | No regular log review while schools are active | monitoring checklist |
| Production deploy safety | Changed areas get smoke-tested after deploy | One deploy missing smoke notes | Deploy introduces unresolved school-facing failure | deployment notes |

Reliability is judged by school impact, not just raw error count.

## Expansion Gates

### Continue With Current Schools

Continue the pilot with current schools when:

- No Red trust/safety/privacy metric is open.
- No Red reliability metric is open.
- At least one school has completed the full workflow.
- Support has an owner, backup, and response cadence.
- Feedback from active schools identifies fixable issues rather than fundamental school-fit problems.

### Invite More Schools

Invite more schools only when:

- Adoption, scrim activity, support, trust/safety/privacy, and reliability are Green or Yellow with owned remediation.
- At least three verified schools have completed the full workflow or there is a documented reason why one workflow is not applicable.
- No Severity 0 or Severity 1 case is unresolved without a school/Matchmake owner.
- No privacy/data request is overdue or unowned.
- The owner can still review logs and support every school day, or monitoring/support coverage has been upgraded.

### Pause Expansion

Pause expansion when any of these are true:

- A Red safety, privacy, or reliability metric remains open.
- Coaches cannot complete setup, scrim posting, or match review without repeated one-on-one intervention.
- Support requests are being lost, delayed, or tracked outside the restricted process.
- Screenshot extraction failures prevent the match review workflow and manual fallback is not working.
- Schools are confused about what is public, school-visible, or private after onboarding.

## Weekly Readout Template

Use this short template for the owner or MOSEF pilot readout.

```md
# Matchmake MOSEF Pilot Readout - Week of YYYY-MM-DD

## Overall State

Green / Yellow / Red:
Decision: continue current pilot / fix before continuing / pause expansion / invite additional schools

## Metrics Snapshot

- Verified active schools:
- Active teams:
- Supported games represented:
- Posted scrims:
- Completed scrims:
- Saved match reviews:
- Extraction attempts:
- Manual-review rate:
- Open P1/P2 support items:
- Open Severity 0/1 conduct cases:
- Open privacy/data requests:
- Repeated production error classes:

## What Changed This Week

- Adoption:
- Scrims:
- Match reviews:
- Support/feedback:
- Trust/safety/privacy:
- Reliability:

## Risks And Owners

| Risk | State | Owner | Next action | Due |
| --- | --- | --- | --- | --- |

## Expansion Decision

Decision:
Reason:
Next review date:
```

## Data Source Map

| Metric family | Primary source | Backup/manual source |
| --- | --- | --- |
| Schools/orgs | `organizations` | support tracker |
| Teams/games | `teams` | onboarding notes |
| Scrims | `scrim_requests` | coach/admin confirmation |
| Match reviews | `team_match_reviews` | feedback/support tracker |
| Extraction usage | `admin_activity_logs` actions `extraction_completed` and `extraction_failed`; extracted saved reviews | Vercel logs for `/api/postgame/extract` |
| Support | restricted support log | support inbox |
| Feedback | restricted feedback tracker | MOSEF coordinator notes |
| Abuse/reports | restricted case log or future report queue | owner/admin notes |
| Admin actions | `/admin` activity log, `admin_activity_logs` | admin-removal completion record |
| Reliability | Vercel Runtime Logs, Supabase logs, Edge Function logs | manual smoke-test notes |

## Privacy Rules For Metrics

- Share school-level or aggregate metrics by default.
- Do not include student names, emails, chat bodies, private profile links, raw screenshots, raw model output, conduct narratives, medical details, disciplinary details, or private contact information in routine readouts.
- Use case IDs, support IDs, and privacy request IDs instead of sensitive descriptions.
- If a metric requires sensitive review, keep that review owner-only and summarize only the state, owner, and next action.
- Do not publicly rank schools or teams by activity.
- Treat small counts carefully when they could identify a student or incident.

## Known Gaps Before Live Automation

- Support, feedback, privacy, and abuse-case trackers still need final storage locations and owners.
- The current `/admin` dashboard uses bounded record loads; exact launch readouts may need read-only queries for complete historical windows.
- Launch analytics currently records a small set of events in `admin_activity_logs`; additional event coverage may be needed for request accepted/declined, support status, and feedback milestones.
- The scorecard needs final approval from the Matchmake owner and MOSEF pilot lead before it is used for expansion decisions.

## Ready Criteria

This metrics plan is ready for pilot use when:

- The Matchmake owner and MOSEF pilot lead agree on the Green/Yellow/Red thresholds.
- The support, feedback, privacy, and conduct trackers have owners and access rules.
- The owner can produce the weekly readout from `/admin`, restricted trackers, and production logs without exposing sensitive student data.
- Red safety, privacy, and reliability metrics are treated as expansion blockers.
- The next expansion decision is tied to this scorecard rather than anecdotes.
