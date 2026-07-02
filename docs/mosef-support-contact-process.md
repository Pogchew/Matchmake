# Matchmake MOSEF Support And Contact Process

Status: MOSEF / high-school pilot operational guide
Audience: Matchmake operators, MOSEF coordinators, coaches, esports leads, and school administrators
Prerequisite: participating schools have named a primary and backup school contact

This process defines how MOSEF pilot users should get ordinary Matchmake support, how Matchmake should triage those requests, and when a request must move into a safety, privacy, or admin-removal workflow. It is not an emergency service, legal notice, or substitute for a school's student-safety process.

Before student launch, Matchmake must publish the final support inbox, business hours, backup owner, and pilot escalation contact in the launch materials. Until those are named, this process is ready as the operating model but should stay internal.

## Contact Paths

Use one clear intake path for routine pilot support:

- Coaches and school administrators send ordinary Matchmake support requests to the published pilot support inbox.
- MOSEF coordinators may summarize school-level issues and send them to the same support inbox, with affected school contacts copied only when appropriate.
- Students should start with their coach, school esports lead, parent/guardian, trusted adult, or school reporting channel. Students should not be told that Matchmake support is a monitored emergency line.
- Parents/guardians should use the school-designated contact first for school-controlled records unless the final school agreement says Matchmake should respond directly.
- Matchmake operators use an internal restricted support log to track requests, owners, status, and follow-up.

Do not route support through public GitHub issues, broad Discord channels, student group chats, or personal direct messages. Those channels are too easy to lose, over-share, or expose student information.

## What Belongs In Support

Routine support includes:

- Account access problems after normal school verification.
- Organization setup questions.
- Team setup, roster correction, rank, region, or profile-link questions.
- Scrim posting, request, cancellation, calendar, or chat workflow issues.
- Match review upload, extraction fallback, save, Team Stats, or Deep Stats questions.
- Bug reports with steps to reproduce.
- Product questions from coaches or MOSEF coordinators.
- Requests to clarify pilot limitations or launch readiness.

Use the matching guide when possible:

- First setup: `docs/coach-admin-onboarding-guide.md`
- Team setup: `docs/first-team-setup-guide.md`
- Scrim posting: `docs/first-scrim-posting-guide.md`
- Match review upload: `docs/match-review-upload-guide.md`
- Profile-link safety: `docs/profile-link-safety-guidance.md`

## What Does Not Belong In Routine Support

Some requests need a different workflow:

- Immediate danger, credible threats, self-harm risk, suspected exploitation, or emergency safety concerns go to emergency and school safety channels first. Then use `docs/inappropriate-behavior-reporting-escalation.md` for Matchmake platform support.
- Inappropriate chat, harassment, doxxing, discrimination, unsafe profile content, retaliation, or bad-faith team behavior follows `docs/inappropriate-behavior-reporting-escalation.md`.
- Platform removals, content removal, team removal, scrim status changes for moderation, user membership removal, or review/message removal follow `docs/admin-removal-guidance.md`.
- Access, export, correction, deletion, organization termination, or parent/guardian record requests follow `docs/school-data-deletion-export-process.md`.
- Production outage monitoring, repeated runtime errors, or log review follow `docs/production-monitoring-logging-strategy.md`.

When a request is mixed, start in support, assign one owner, and link the related safety, privacy, or admin-removal case rather than copying sensitive details into multiple places.

## Information To Include

Ask the requester to include only what is needed:

- Requester name, role, school or organization, and approved contact method.
- Affected Matchmake organization and team name.
- The user-facing route or page, such as `/team`, `/requests`, `/calendar`, or a team dashboard.
- Date, time, and time zone of the issue.
- Short description of what happened and what the requester expected.
- Browser and device type if the issue is visual or interaction-related.
- Stable record IDs or URLs when available, such as team, scrim request, or match review URLs.
- Screenshot only when it helps and only after cropping private messages, unrelated tabs, student contact details, or sensitive school information.
- Whether the issue blocks a scheduled practice, scrim, match review, or school launch milestone.

Do not ask for passwords, one-time codes, service-role keys, private student contact information, medical information, disciplinary details, or raw sensitive incident evidence in routine support.

## Severity And Response Targets

These are pilot operating targets, not guarantees.

### Priority 0 - Safety Or Privacy Escalation

Examples: immediate safety concern, suspected child exploitation, credible threat, cross-school data exposure, exposed secret, or request involving deletion/export under a legal or school deadline.

- Route immediately to the safety, privacy, or security owner.
- Acknowledge as soon as seen.
- Do not troubleshoot casually in ordinary support if the issue requires preservation, counsel, or school-safety handling.

### Priority 1 - School-Blocking Issue

Examples: coaches cannot sign in during onboarding, a school cannot create its first organization or team, scrim requests fail for an active scheduled match, match reviews cannot save for a required event, or repeated extractor failures block a planned workflow.

- Acknowledgement target: same business day.
- Initial workaround or next update target: same business day.
- Escalate to the production log owner if runtime errors repeat.

### Priority 2 - Routine Product Support

Examples: setup questions, one-off extraction fallback, calendar feed confusion, roster correction questions, non-urgent bug reports, or guide clarification.

- Acknowledgement target: within two business days.
- Initial answer, workaround, or triage target: within five business days.

### Priority 3 - Feedback Or Enhancement

Examples: feature ideas, copy suggestions, polish requests, reporting preferences, or non-blocking workflow improvements.

- Acknowledge when reviewed.
- Store for product planning through `docs/fall-pilot-feedback-collection-plan.md`.
- Do not promise implementation dates during the pilot unless the owner has approved the scope.

If the priority is unclear, start one level higher until the owner understands the risk.

## Support Workflow

1. **Receive.** Confirm the request arrived through the published support path or a verified school/MOSEF coordinator.
2. **Classify.** Choose support, safety, privacy, admin-removal, monitoring, or product-feedback routing.
3. **Create a support record.** Assign a support ID, received time, school, requester role, summary, priority, owner, status, and next update date in the restricted support log.
4. **Acknowledge.** Confirm receipt, support ID, current priority, and expected next update. Avoid promising a fix before the issue is understood.
5. **Gather minimum evidence.** Ask for the smallest useful reproduction steps, route, record IDs, and cropped screenshots.
6. **Check current guidance.** Link the relevant guide or runbook when the answer already exists.
7. **Investigate.** Use safe logs, source inspection, or a local reproduction path. Do not expose secrets or student records in broad channels.
8. **Respond.** Provide the answer, workaround, escalation path, or status update in plain coach/admin language.
9. **Verify.** Ask the coach/admin or MOSEF coordinator to confirm when the issue is resolved or no longer blocking.
10. **Close.** Record outcome, root cause category, documents linked, follow-up owner, and whether the issue should feed `docs/fall-pilot-feedback-collection-plan.md`.

## Status Labels

Use simple support status labels:

- New - received but not triaged.
- Waiting on Matchmake - Matchmake owner or operator is investigating.
- Waiting on school - the school or coach needs to provide context, confirm a setting, or try a workaround.
- Escalated - moved to safety, privacy, admin-removal, monitoring, or engineering owner.
- Workaround provided - requester has a practical path while a fix or decision is pending.
- Resolved - requester confirmed resolution or Matchmake verified the issue no longer occurs.
- Closed no response - requester did not respond after reasonable follow-up.

## Privacy And Record Handling

Support records may include student or school-controlled information, so keep them narrow.

- Store support records in an access-controlled support log.
- Keep support records separate from public issue trackers and broad product-planning notes.
- Record stable IDs and short summaries instead of full student data whenever possible.
- Redact screenshots before sharing outside the restricted support owner group.
- Do not paste full chat logs, raw screenshots, student emails, private profile links, or sensitive incident details into ordinary engineering tickets.
- If a support request becomes a safety or privacy case, move the sensitive details to the correct restricted case log and leave only a cross-reference in the routine support record.
- Apply retention windows approved in the final school agreement, privacy policy, and support operations plan.

## Coach-Facing Acknowledgement Pattern

Use concise messages that set expectations:

```
Thanks for sending this. I logged it as Support ID MM-0000 and marked it as Priority 2 routine support. We will check the team setup and follow up by the next support update window. Please do not send passwords, student private contact details, or sensitive incident evidence in this thread.
```

For safety or privacy issues, do not use the routine acknowledgement alone. Route to the correct runbook and include the relevant school/emergency direction.

## Pre-Launch Readiness

The support process is ready for MOSEF pilot use when:

- A final support inbox is published to participating coaches/admins.
- Business hours and backup coverage are named.
- A restricted support log exists with support ID, owner, status, priority, and next-update fields.
- Every pilot school has a primary and backup school/MOSEF contact.
- Operators know when to route to behavior escalation, admin removal, privacy requests, or monitoring.
- Support messages avoid secrets, sensitive student details, and public issue trackers.
- The coach/admin onboarding guide points users to the published support path before student launch.
