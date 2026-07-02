# Matchmake Fall Pilot Feedback Collection Plan

Status: MOSEF / high-school pilot operational plan
Audience: Matchmake operators, MOSEF coordinators, coaches, esports leads, and school administrators
Prerequisite: the pilot support process exists and participating schools have named a primary contact

This plan defines how Matchmake should collect, triage, and act on feedback during the MOSEF / high-school fall pilot. It is a feedback collection plan and form specification, not a live hosted form.

Before student launch, Matchmake should create the actual form in the school-approved tool, publish the form link to coaches/admins, and name the owner who reviews submissions.

## Goals

Collect feedback that helps answer five launch questions:

- Can coaches set up organizations, teams, scrims, and match reviews without one-on-one help?
- Which workflows block real school use?
- Which parts of the app are confusing, slow, or too fragile for a season?
- Which trust, privacy, support, or safety expectations are unclear?
- What should be fixed before expanding beyond the first pilot schools?

The goal is not to gather broad student sentiment, collect disciplinary reports, or replace the support/contact process.

## Collection Channels

Use three channels:

- **Pilot feedback form.** Primary channel for structured coach/admin feedback after onboarding, first scrim, first match review, and end-of-month checkpoints.
- **Support log themes.** Product themes from `docs/mosef-support-contact-process.md` can feed the feedback tracker after sensitive details are removed.
- **MOSEF coordinator notes.** Coordinator observations can be summarized as school-level operational feedback, not student case notes.

Do not collect feedback through public issue trackers, student group chats, public Discord channels, or unapproved personal direct messages.

## Who Should Submit

Primary submitters:

- Coaches.
- School esports leads.
- School administrators supporting the pilot.
- MOSEF coordinators.

Optional submitters:

- Students may share product feedback through their coach or school-approved process if the school allows it.
- Parents/guardians should use the school-designated path for student-record or safety concerns.

Do not ask students to submit personal information, sensitive conduct reports, or private contact details through the product feedback form.

## When To Ask

Use a lightweight cadence:

- **After onboarding:** once the school has signed in, created an organization, and created the first team.
- **After first scrim post:** once the school has posted or requested one scrim.
- **After first match review:** once a coach has saved a match review from screenshot upload or manual entry.
- **Weekly during the first month:** one short pulse from the coach/admin.
- **End of pilot phase:** one longer retrospective before broader rollout decisions.

Avoid sending a new form after every minor action. Too many asks will lower response quality.

## Form Sections And Questions

Build the form with these sections.

### 1. Submitter Context

Required fields:

- School or organization name.
- Submitter role: coach, esports lead, administrator, MOSEF coordinator, other school staff.
- Contact email for follow-up.
- Which pilot checkpoint this feedback covers: onboarding, first team, first scrim, first match review, weekly pulse, end-of-pilot retrospective, other.

Optional fields:

- Game title.
- Team name.
- Matchmake route or page related to the feedback, such as `/team`, `/requests`, `/calendar`, or a team dashboard.

### 2. Quick Ratings

Use a five-point scale from strongly disagree to strongly agree:

- I could complete the workflow without one-on-one Matchmake help.
- The labels and instructions were clear.
- The workflow felt appropriate for a high-school esports program.
- I understood what information was public, school-visible, or private.
- I knew where to go for support or safety concerns.
- I would be comfortable using Matchmake again for the next scrim or match review.

### 3. Workflow Check

Use multiple choice plus one open text field:

- Which workflow did you use? Account setup, organization setup, team setup, roster editing, scrim posting, scrim requests, scrim chat, calendar, match review upload, Team Stats, Deep Stats, support process, other.
- Did anything block the workflow? No, minor confusion, needed workaround, could not complete.
- What was the blocker or confusing step?

### 4. Trust And Safety Check

Ask:

- Did any copy, field, or workflow make you unsure about student privacy or school expectations?
- Did you know how to report inappropriate behavior or unsafe content?
- Did any part of the workflow encourage sharing information that should stay private?

Include this instruction: do not include student safety reports, disciplinary details, medical information, private contact details, or emergency information in this form. Use the school's reporting process and `docs/inappropriate-behavior-reporting-escalation.md` for safety or conduct concerns.

### 5. Open Feedback

Ask:

- What worked well enough to keep?
- What should be fixed before the next school uses this?
- What would save the coach/admin the most time?
- What should Matchmake not build or not complicate?
- Any other product notes?

### 6. Follow-Up Permission

Ask:

- May Matchmake follow up with you about this feedback?
- If yes, what is the best school-approved contact method?
- Is this feedback okay to summarize anonymously in pilot planning notes?

## Data To Avoid

The feedback form should not collect:

- Student full names unless the school has approved that use and it is necessary.
- Student emails, phone numbers, home addresses, private handles, or private profile links.
- Passwords, one-time codes, auth tokens, API keys, calendar feed tokens, or Discord webhook URLs.
- Full chat logs, sensitive screenshots, discipline records, medical information, or emergency details.
- Legal requests for access, export, correction, deletion, or records retention.

If a submission includes sensitive material anyway, move it to the correct restricted support, safety, or privacy process and redact it from product-planning notes.

## Feedback Triage

Review submissions at least weekly during the first pilot month.

Use these categories:

- **Launch blocker:** prevents a school from signing in, setting up, posting scrims, managing requests, saving match reviews, or meeting safety/privacy expectations.
- **High friction:** workflow succeeds but requires extra explanation, workaround, or support.
- **Trust gap:** copy, visibility, privacy, or support expectations are unclear.
- **Bug:** reproducible product behavior that fails or contradicts the intended workflow.
- **Polish:** wording, layout, labels, or ergonomics that should improve but do not block launch.
- **Future idea:** valuable but outside the fall pilot path.
- **Not product feedback:** safety case, privacy request, support issue, or school policy matter that belongs in another process.

Each reviewed item should have:

- Feedback ID.
- Submission date.
- School or organization.
- Workflow area.
- Category.
- Severity.
- Owner.
- Decision: fix now, workaround, document, defer, decline, or route elsewhere.
- Follow-up note.

## Severity Guide

Use this severity model:

- **P0:** safety, privacy, cross-school data exposure, or emergency issue. Route immediately to the correct runbook.
- **P1:** blocks a core pilot workflow for a school. Same-week owner review required.
- **P2:** repeated friction, confusing copy, or workflow issue that affects multiple users but has a workaround.
- **P3:** single-school polish, enhancement idea, or non-blocking preference.

P0 feedback should not stay in the ordinary feedback tracker except as a redacted cross-reference.

## Monthly Readout

At the end of each pilot month, prepare a short internal readout:

- Number of submissions.
- Schools represented.
- Workflows represented.
- Top three blockers or friction points.
- Top three trust/safety/privacy concerns.
- Fixes completed.
- Workarounds documented.
- Decisions deferred with reasons.
- Recommended next-month focus.

Keep the readout school-appropriate. Avoid student names, private conduct details, raw screenshots, and sensitive records.

## Pre-Launch Setup Checklist

Before sending the first form:

- Choose the school-approved form tool.
- Create the form from the sections above.
- Turn off public response visibility.
- Confirm who can view responses.
- Add the no-sensitive-details instruction near the top of the form.
- Add the support and safety routing note near any open-text section.
- Create a restricted feedback tracker with the triage fields above.
- Name the feedback owner and backup owner.
- Publish the form link to coaches/admins through the MOSEF pilot launch materials.
- Add the feedback cadence to the coach/admin onboarding checklist.

## Ready To Use

The feedback plan is ready when:

- Coaches/admins know when to submit feedback.
- Feedback is separated from emergency, behavior, privacy, and support cases.
- The form asks about the core pilot workflows without collecting unnecessary student data.
- The owner can review submissions weekly.
- The next rollout decision can be tied to actual pilot evidence rather than anecdotes.
