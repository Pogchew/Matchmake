# Matchmake Coach And Admin Onboarding Guide

Status: MOSEF / high-school pilot guide
Audience: coaches, esports leads, and school administrators
Scope: first-time setup and operating habits for Matchmake

This guide gives a coach or school admin the shortest safe path from account creation to the first usable Matchmake workspace. It is not a student conduct policy, legal notice, or incident-response plan.

## Before You Start

Have these ready before creating the workspace:

- The school or program name that should appear in Matchmake.
- The primary coach/admin who will own setup.
- The game title, mode, rank range, and region for each team.
- A roster list approved for school use.
- A school contact for safety, conduct, privacy, and escalation questions.
- The preferred support/reporting contact for Matchmake pilot issues.

If the school does not want optional roster profile links, leave those fields blank. Profile links are not required for team setup.

## Day 1 Setup

1. Go to `/signup` and create the coach/admin account.
2. Create the organization at `/org/new`.
   - Use the school, club, or program name students and opponents should recognize.
   - Pick `High School` as the organization type for MOSEF schools.
   - Choose the closest competitive region.
3. Create the first team at `/team/new`.
   - Enter the team name, game, mode, rank, location, and roster names.
   - Use coach-declared rank as the starting point. Update it when the team's level changes.
4. Open `/org` and confirm the organization dashboard shows the team, region, game, and quick actions.
5. Open `/team` and confirm Team Stats, roster management, and game history are visible for the team.

## Recommended First Practice Workflow

Use this order for the first real scrim cycle:

1. **Post or find a scrim.** Use **Find Scrims** to browse listings or **Schedule Scrim** / **Post Scrim** to create one for your team.
2. **Review requests.** Use `/requests` to accept, decline, cancel, or open chat for scrim requests.
3. **Check the calendar.** Use `/calendar` to review open, pending, and confirmed scrims by date.
4. **Keep chat practical.** Use scrim chat for scheduling details only: lobby information, time changes, map/mode expectations, and confirmation.
5. **After the match, save a review.** Use the team dashboard match-review workflow so Team Stats and Deep Stats can build from actual results.
6. **Review trends with students.** Use Team Stats and Deep Stats for coaching conversations, not discipline or public ranking.

## Roster And Link Expectations

Roster entries should be school-appropriate and easy to recognize. Do not add personal contact details, private account names, or unrelated profile links.

Optional roster profile links should:

- Use HTTPS.
- Point to a relevant game, ranking, league, tournament, or school-approved esports profile.
- Be approved by the coach or school before saving.
- Avoid personal social media, invite links, private messaging accounts, and pages that expose sensitive student information.

See `docs/profile-link-safety-guidance.md` for the full profile-link review checklist.

## Safety And Reporting

Before students use Matchmake, coaches/admins should know where reports go.

- Matchmake does not currently have a student-facing in-app report form.
- Students should report urgent or inappropriate behavior to their coach, school esports lead, parent/guardian, trusted adult, or the school's normal reporting channel.
- Coaches/admins should send platform-action requests to the Matchmake support/reporting contact designated for the pilot.
- Do not rely on Matchmake support for emergencies. Use school emergency procedures, 911, 988, or other required safety channels when appropriate.
- Keep sensitive student-safety information out of public tickets, group chats, and broad engineering channels.

For routine support intake, use `docs/mosef-support-contact-process.md`. For incident handling, use `docs/inappropriate-behavior-reporting-escalation.md`. For current owner/admin removal controls, use `docs/admin-removal-guidance.md`.

## Weekly Coach Checklist

Run this once per week during the pilot:

- Confirm upcoming scrims in `/calendar`.
- Clear old pending requests in `/requests`.
- Review roster names, ranks, and optional profile links.
- Check that saved match reviews are attached to the right team and game.
- Look for repeated bad-faith requests, unsafe chat, or profile/link issues.
- Record support needs or product feedback while details are fresh; use `docs/fall-pilot-feedback-collection-plan.md` for the pilot feedback cadence.

## Launch Limitations To Tell Coaches

Set these expectations clearly:

- Organization verification, production support contacts, and district-specific privacy terms may still need final owner approval before broad rollout.
- Matchmake is not an emergency service or a school discipline system.
- The current app does not provide a dedicated report queue.
- Some admin actions are owner-only and may require Matchmake support rather than a coach-facing control.
- Match review extraction can fail or require manual review, so coaches should keep source screenshots until the saved review looks correct.

## Success Criteria For First Week

The pilot workspace is ready when:

- The coach/admin account can sign in.
- The organization exists and has the correct school/program identity.
- At least one team exists with correct game, mode, rank, region, and roster.
- The coach/admin can explain how to post a scrim, review requests, check the calendar, and save a match review.
- The school knows the safety/reporting path and has a designated contact for Matchmake issues.
