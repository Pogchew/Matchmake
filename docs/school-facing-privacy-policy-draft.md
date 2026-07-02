# Matchmake School-Facing Privacy Policy Draft

Status: Draft for school/district and legal review

Last updated: 2026-06-18

This draft is written for high school esports programs evaluating Matchmake. Replace bracketed placeholders before publication.

## Overview

Matchmake helps school esports teams organize teams, post and request scrims, coordinate scrim schedules, communicate with active scrim opponents, and review post-game match data. We design Matchmake to support school-authorized esports activities, not advertising, data brokerage, or unrelated commercial profiling.

This policy explains what information Matchmake collects, how we use it, when we share it, and what controls schools, parents, guardians, and users may request.

Controller/contact placeholder:

- Operator: `[Matchmake legal entity or owner name]`
- Contact: `[privacy contact email]`
- Mailing address: `[business mailing address, if applicable]`

## Who This Policy Is For

This policy is intended for:

- Schools, districts, coaches, and esports program administrators.
- Students and team members using Matchmake through a school or team.
- Parents or guardians reviewing a school-approved esports tool.

Matchmake is intended for high school, collegiate, and amateur esports teams. For the MOSEF / high-school pilot, Matchmake should not allow self-service use by children under 13. Under-13 use is allowed only when a school or district has specifically authorized it in writing, the required COPPA notice and consent path has been confirmed, and use is limited to the school-authorized context described in `docs/under-13-coppa-handling.md`.

## Information We Collect

We collect information needed to provide the Matchmake service.

### Account Information

- Email address.
- Display name.
- Password/authentication data handled through Supabase Auth.
- Account type and organization/team membership.
- Optional profile text, external profile URLs, or linked game account information if a user or school chooses to add them.

### School, Organization, And Team Information

- Organization name, type, school domain, region, verification status, and organization administrator.
- Team name, game title, mode, region, rank tier, coach/captain information, roster names, roster profile links, ScrimGG rating, and no-show count.
- Organization calendar subscription token if a school enables the calendar feed.
- Organization logo if that feature is enabled in the production environment.

### Scrim And Scheduling Information

- Scrim posting team, matched team, game title, scheduled time, requested game count, rank preferences, status, expiration time, and related updates.
- Calendar feed data generated from scheduled scrims when an organization creates a subscription link.
- Discord digest data if a school or operator configures the optional Discord calendar notification integration.

### Chat And Communication Information

- Messages sent in active scrim chat.
- Sender user ID, display name, sender team ID, message body, scrim request ID, and timestamp.

### Match Review And Screenshot Extraction Information

- Match review records, including game title, match result, score, opponent name, map or mode, played date/time, team and opponent compositions, team and opponent stats, player rows, notes, parser status, parser confidence, and manual-review flags.
- Optional screenshot URL if a saved review uses one.
- Uploaded scoreboard screenshots submitted to `POST /api/postgame/extract` for extraction. The extractor validates file type and size, optimizes the image, sends the image to the configured Gemini model for extraction, and returns structured match data to the app. Matchmake does not intentionally save the uploaded image in this API route unless a separate product flow stores or links the screenshot.
- Extracted player names, gamer tags, hero/champion/agent choices, scores, stats, and related match details visible in the screenshot.

### Technical And Security Information

- Authentication cookies used to keep users signed in.
- Theme preference in local browser storage.
- Rate-limit counters for screenshot extraction.
- Operational logs, error logs, request status, and security/audit information needed to operate, debug, and protect the service.

## How We Use Information

We use information to:

- Create and manage user accounts, organizations, and teams.
- Let coaches/admins manage rosters and team metadata.
- Let teams post, request, accept, decline, cancel, complete, and review scrims.
- Show public Scrim Board listings with limited public fields for open, unmatched scrims.
- Restrict private organization, roster, chat, and match review data using authentication and row-level access controls.
- Provide screenshot extraction and match review workflows.
- Generate optional calendar feeds or Discord digests when configured.
- Protect the service, prevent misuse, rate-limit expensive extraction requests, investigate bugs, and maintain security.
- Respond to school, parent/guardian, or user support requests.

## No Sale, Advertising, Or Commercial Profiling Of Student Data

Matchmake will use student data only to provide, secure, support, maintain, and improve the school-authorized Matchmake service.

Matchmake will not:

- Sell student data.
- Rent, trade, license, or otherwise disclose student data to advertisers, ad networks, data brokers, or similar third parties.
- Use student data for targeted advertising, behavioral advertising, or retargeting.
- Use student data or student metadata to build advertising, marketing, or unrelated commercial profiles.
- Use student data to market or advertise products or services to students, parents/guardians, or households.
- Allow service providers or subprocessors to use student data for their own advertising, marketing, sale, data-broker, model-training, or unrelated commercial purposes unless a school expressly authorizes a different use in writing.

These commitments are also documented in `docs/student-data-no-sale-no-ads.md`.

## Public And School-Controlled Visibility

Some information is visible outside a user's own organization so that the scrim marketplace can function:

- Public Scrim Board listings may show limited information about open, unmatched scrim requests, including game, date/time, game count, rank preferences, posting team public fields, and posting organization public fields.
- The current production public-read policy is intentionally limited to public board fields for organizations, teams, and open scrim requests.

Private or school-scoped information includes:

- User email addresses.
- Full user profiles.
- Full rosters and roster profile details.
- Organization admin data and internal organization/team metadata.
- Scrim chat messages.
- Match review records and extracted player/stat rows.

Schools should review whether player names, gamer tags, roster names, and participation in esports activities are considered directory information under their local FERPA notices before making any roster or team information public.

## How We Share Information

We share information only as needed to provide and protect Matchmake:

- With school-authorized users in the same organization or active scrim workflow, according to Matchmake's access controls.
- With other teams through limited public/open scrim listings or active scrim workflows.
- With service providers that host, secure, authenticate, analyze, or process the service, such as Supabase for authentication/database infrastructure and Google Gemini for screenshot extraction when that feature is used.
- With calendar applications when an organization creates and shares a calendar subscription link.
- With Discord only if the optional Discord digest integration is configured by the operator or school program.
- When required by law, legal process, or to protect the rights, safety, and security of users, schools, Matchmake, or others.

We do not share student personal information with advertisers, ad networks, or data brokers.

## COPPA And School Authorization

The FTC explains that, in the educational context, schools can consent on behalf of parents for collection of student personal information only when the service is used for a school-authorized educational purpose and not for another commercial purpose. The FTC also says the operator must give the school notice of its collection, use, and disclosure practices, and that schools and operators should consider review, deletion, security, retention, and FERPA obligations.

Matchmake's intended school use is school-authorized esports team coordination and match review. Under-13 students should not create accounts, appear in rosters, use scrim chat, upload screenshots, or otherwise provide personal information in Matchmake unless the school authorization and consent path in `docs/under-13-coppa-handling.md` is complete.

If Matchmake learns that a user is under 13 without the required authorization or consent path, Matchmake should stop further collection from that user, disable or remove access while the school contact is notified, and support export, deletion, or de-identification through the school data deletion/export process.

## FERPA And School Records

FERPA may apply when a school or district uses Matchmake and Matchmake stores information from education records or information maintained on behalf of the school. Schools should determine whether Matchmake is used under FERPA's school official exception or another applicable basis.

Where Matchmake handles information on behalf of a school:

- Matchmake will use the information only for the school-authorized service purposes described in this policy and applicable agreements.
- Matchmake will not redisclose school-provided student information except as described in this policy, directed by the school, or allowed/required by law.
- Matchmake will support school requests to access, correct, export, or delete school-controlled information, subject to technical and legal limits.

Schools remain responsible for their own FERPA notices, directory information designations, and parent/eligible-student rights processes.

## Student And Parent/Guardian Controls

Requests should generally go through the school or team administrator when the account is school-managed.

Schools, parents/guardians, eligible students, or users may request:

- Access to personal information associated with an account or school organization.
- Correction of inaccurate account, roster, team, or match review information.
- Deletion of account, roster, chat, scrim, or match review information, subject to school instructions, legal obligations, backup retention, and technical feasibility.
- Disabling or rotating organization calendar subscription links.
- Help reviewing what data is visible publicly or across organizations.

Contact `[privacy contact email]` for privacy requests.

## Data Retention

Matchmake keeps information while it is needed to provide the service, support school esports operations, maintain records requested by a school, comply with legal obligations, resolve disputes, and protect the service.

Expected retention pattern:

- Account, organization, and team data is kept while the account or organization is active.
- Scrim, chat, and match review data is kept while needed for team history, analytics, disputes, or school program records.
- Calendar feed tokens remain active until rotated or disabled.
- Operational logs are kept for a limited period appropriate for debugging, security, and abuse prevention.
- Uploaded screenshots processed through the extractor API are not intentionally stored by that route, but extracted data may be saved into match review records if the user chooses to save it.

Before publication, Matchmake should finalize a specific deletion/export process and retention windows for school-controlled records.

## Security

Matchmake uses technical and organizational safeguards intended to protect personal information, including:

- Supabase authentication.
- Row Level Security policies that scope private records by user, organization, team, and active scrim participation.
- Limited unauthenticated access to public Scrim Board fields.
- Server-side service role usage for server-only routes where needed.
- Upload size limits and file validation for screenshot extraction.
- Rate limiting for screenshot extraction.
- Production log gating to avoid raw extractor/model payload logging by default.

No online service can guarantee perfect security. Schools and users should protect account credentials and promptly report suspected unauthorized access.

## International, State, And District Requirements

This draft is written for U.S. school launch review and references COPPA and FERPA. State student privacy laws and individual district contract requirements may impose additional obligations, especially for K-12 student data, targeted advertising, profiling, onward disclosure, breach notice, retention, and deletion.

Before publication or district signature, Matchmake should review this policy with counsel against the states and districts where it will be offered.

## Changes To This Policy

Matchmake may update this policy as the product, legal requirements, or school launch scope changes. Material changes affecting school-controlled student information should be communicated to affected school administrators before they take effect when practical.

## Official References Used For This Draft

- FTC, COPPA guidance for ed tech companies and schools: https://www.ftc.gov/business-guidance/blog/2020/04/coppa-guidance-ed-tech-companies-schools-during-coronavirus
- FTC, COPPA FAQs, COPPA and Schools: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC, 2025 COPPA Rule amendments announcement: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- U.S. Department of Education, FERPA regulations and parent/eligible student rights: https://studentprivacy.ed.gov/ferpa
- U.S. Department of Education, Directory Information: https://studentprivacy.ed.gov/content/directory-information
- U.S. Department of Education, Protecting Student Privacy While Using Online Educational Services: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/Student%20Privacy%20and%20Online%20Educational%20Services%20%28February%202014%29_0.pdf
- U.S. Department of Education, Model Terms of Service guidance: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/TOS_Guidance_Mar2016.pdf

## Publication Checklist

Before publishing this policy:

- Fill in the operator legal name, privacy contact, and mailing address.
- Review `docs/under-13-coppa-handling.md` with counsel and each participating school/district before any under-13 access.
- Review `docs/student-data-no-sale-no-ads.md` and confirm no other policy, order form, or integration terms conflict with those student-data commitments.
- Confirm the data deletion/export process and retention windows.
- Confirm the service provider/subprocessor list.
- Confirm whether organization logos, Discord digest, calendar subscriptions, and screenshot URLs are enabled in production.
- Review against applicable state student privacy laws and district contract requirements.
- Have counsel review the final policy text.
