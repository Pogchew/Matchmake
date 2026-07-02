# Matchmake School/District Data Privacy Agreement Template

Status: Draft template for school/district and legal review

Last updated: 2026-06-18

This template is intended for a school or district that wants a written student data agreement for Matchmake. Replace bracketed placeholders and have counsel review before signature.

## 1. Parties

This Data Privacy Agreement ("Agreement") is entered into by:

- School/District: `[school or district legal name]` ("School")
- Provider: `[Matchmake legal entity or owner name]` ("Matchmake" or "Provider")

Effective date: `[effective date]`

Related documents:

- Matchmake Terms of Service: `docs/terms-of-service-draft.md` or final published URL
- Matchmake School-Facing Privacy Policy: `docs/school-facing-privacy-policy-draft.md` or final published URL
- Matchmake Acceptable Use Policy: `docs/acceptable-use-policy-draft.md` or final published URL
- Statement of Work, order form, pilot agreement, or purchase document: `[if any]`

If this Agreement conflicts with the public Terms of Service or Privacy Policy for the School's student data, this Agreement controls for the School.

## 2. Purpose And Authorized Use

The School authorizes Matchmake to process School Data only to provide school-authorized esports team operations, including:

- Creating and managing school esports organizations and teams.
- Managing rosters, team metadata, and team profile information.
- Posting, requesting, accepting, declining, canceling, completing, and reviewing scrims.
- Coordinating scrim schedules.
- Supporting active scrim chat.
- Supporting match review and optional scoreboard screenshot extraction.
- Supporting optional calendar feeds or Discord calendar digests when enabled by the School or Provider.
- Providing security, support, debugging, auditing, and service maintenance.

Matchmake may not use School Data for any purpose outside this Agreement unless the School authorizes the use in writing or the use is required by law.

## 3. Definitions

"School Data" means information provided by or collected from the School, School users, students, coaches, staff, or school-authorized teams through Matchmake, including Personal Information and education-record information where applicable.

"Personal Information" means information that identifies or can reasonably be used to identify a student, parent/guardian, staff member, user, school, or team.

"Student Data" means School Data that relates to a student or student account, including roster information, gamer tags, chat messages, match review records, extracted match data, account information, and related metadata.

"De-Identified Data" means data from which direct and indirect identifiers have been removed or transformed so the data cannot reasonably identify an individual student, school user, or household, alone or in combination with other reasonably available information.

"Subprocessor" means a third party that processes School Data on behalf of Matchmake to provide, secure, maintain, or support Matchmake.

## 4. FERPA School Official Framework

To the extent Matchmake receives personally identifiable information from education records under FERPA's school official exception, Matchmake agrees that:

- Matchmake performs an institutional service or function for which the School would otherwise use employees or authorized contractors.
- The School has determined that Matchmake has a legitimate educational interest in the School Data needed to provide Matchmake.
- Matchmake is under the direct control of the School with respect to the use and maintenance of such School Data as described in this Agreement.
- Matchmake will use School Data only for authorized purposes under this Agreement.
- Matchmake will not redisclose personally identifiable information from education records except as authorized by the School, permitted by FERPA, or required by law.

The School remains responsible for its FERPA annual notice, directory information designations, consent processes, and determinations about whether Matchmake use fits the School's FERPA framework.

## 5. COPPA And Under-13 Users

For the MOSEF / high-school pilot, Matchmake should not allow self-service use by children under 13.

Before Matchmake is used by children under 13, the School and Matchmake must confirm in writing:

- That the School specifically authorizes under-13 use for the covered organization, team, or program.
- Whether the School is providing consent on behalf of parents/guardians or whether direct parent/guardian consent is required.
- That Matchmake has provided the COPPA-required notice of its collection, use, and disclosure practices.
- The review, correction, deletion, and consent-revocation process for under-13 users.
- Any additional limitations on features, data collection, chat, roster visibility, screenshots, public listing fields, calendar links, or profile links.

Until those steps are complete, children under 13 should not create accounts, appear in rosters, use scrim chat, upload screenshots, or otherwise provide personal information in Matchmake. The detailed operational workflow is documented in `docs/under-13-coppa-handling.md`.

## 6. Data Elements

School Data may include the categories listed in Appendix A. Matchmake will collect only the School Data reasonably needed to provide and protect the service.

The School should identify any data categories that are not authorized for collection or display before launch.

## 7. Ownership And Control

As between the School and Matchmake, the School retains ownership and control of School Data. Matchmake receives only the limited rights needed to provide, secure, support, maintain, and improve Matchmake as authorized by this Agreement.

Matchmake does not obtain ownership of School Data, Student Data, or education records.

## 8. Prohibited Uses

Matchmake will not:

- Sell Student Data or School Data.
- Rent, trade, license, or otherwise disclose Student Data or School Data to advertisers, ad networks, data brokers, or similar third parties.
- Use Student Data for targeted advertising or behavioral advertising.
- Use Student Data for retargeting.
- Build unrelated commercial profiles about students.
- Use Student Data or Student Data metadata to build advertising or marketing profiles.
- Use Student Data to market or advertise products or services to students, parents/guardians, or households.
- Disclose Student Data to data brokers or advertisers.
- Use School Data to train or fine-tune a model unless separately authorized in writing by the School.
- Attempt to re-identify De-Identified Data or permit subprocessors to do so.
- Redisclose School Data except as authorized by this Agreement, by the School, or by law.

The student-data commitments are documented in `docs/student-data-no-sale-no-ads.md`. If any public policy, order form, integration terms, or service-provider terms conflict with this Section, this Section controls for School Data unless the School expressly agrees otherwise in writing.

## 9. Service Providers And Subprocessors

Matchmake may use subprocessors only as needed to provide, secure, host, authenticate, process, monitor, or support the service.

Current expected subprocessors and integrations are listed in Appendix B.

Matchmake will require subprocessors that process School Data to use School Data only for the services they provide to Matchmake, maintain appropriate confidentiality and security protections, and not use School Data for their own advertising, marketing, sale, data-broker, model-training, or unrelated commercial purposes unless the School expressly authorizes a different use in writing.

Matchmake will notify the School of material changes to subprocessors when required by the signed School agreement or applicable law. Publication placeholder: `[insert notice period and objection process if required by district procurement rules]`.

## 10. Security Safeguards

Matchmake will maintain administrative, technical, and physical safeguards designed to protect School Data against unauthorized access, disclosure, alteration, and destruction.

Current safeguards include:

- Supabase authentication.
- Row Level Security policies that scope private records by user, organization, team, and active scrim participation.
- Limited unauthenticated access to public Scrim Board fields.
- Server-side service role usage where needed for server-only routes.
- Upload size limits and file validation for screenshot extraction.
- Rate limiting for screenshot extraction.
- Production log gating to avoid raw extractor/model payload logging by default.
- Access limited to personnel or systems with a need to provide, secure, support, or maintain the service.

Publication placeholder: `[insert any additional security schedule, SOC report language, insurance requirements, encryption standards, or district-required controls]`.

## 11. Security Incidents And Breach Notice

Matchmake will notify the School without unreasonable delay after confirming unauthorized access, acquisition, disclosure, or use of School Data that compromises the security, confidentiality, or integrity of School Data.

Notice should include, to the extent known:

- The nature of the incident.
- The categories of School Data involved.
- The users, schools, or organizations reasonably believed to be affected.
- Measures taken or planned to contain and remediate the incident.
- Recommended steps for the School or affected users.
- A contact for follow-up.

Publication placeholder: `[insert required breach notice deadline, such as 24/48/72 hours, if required by district or state law]`.

## 12. Access, Correction, Export, And Parent/Eligible Student Rights

Matchmake will reasonably support the School in responding to lawful requests to access, inspect, correct, export, or delete School Data maintained in Matchmake.

Parent/guardian and eligible-student requests should generally be routed through the School so the School can verify identity, authority, and FERPA applicability.

Matchmake will not knowingly respond directly to a parent/guardian or eligible student in a way that bypasses the School's FERPA process, unless required by law or separately authorized by the School.

The detailed operational export/deletion process remains a separate launch checklist task.

## 13. Data Retention, Return, And Deletion

Matchmake will retain School Data only while needed to provide the service, comply with School instructions, meet legal obligations, resolve disputes, maintain security, or complete backup and audit processes.

Upon School request or termination, Matchmake will reasonably support:

- Export of School Data in a usable format.
- Deletion or deactivation of accounts, organizations, teams, scrims, chat, match reviews, calendar tokens, and related records.
- Rotation or disabling of calendar feed tokens.
- Certification or written confirmation of deletion where feasible.

Backups and logs may persist for a limited period according to Matchmake backup, security, and legal retention practices, but Matchmake will not actively use deleted School Data from backups except for restoration, legal compliance, security, or dispute purposes.

Publication placeholder: `[insert retention windows after the deletion/export process is defined]`.

## 14. De-Identified And Aggregated Data

Matchmake may use De-Identified Data or aggregated data to operate, secure, analyze, and improve the service, provided the data cannot reasonably identify a student, user, household, school-controlled record, or small group in context.

Matchmake will not attempt to re-identify De-Identified Data and will require any authorized recipient of De-Identified Data to agree not to re-identify it.

De-Identified Data and aggregated data may not be used to target advertising or marketing to students, parents/guardians, households, schools, or school communities.

Publication placeholder: `[confirm whether de-identified/aggregated analytics are allowed for district agreements]`.

## 15. Public Fields And Directory Information

Matchmake includes limited public Scrim Board fields so teams can find opponents. Public fields may include limited organization, team, and open scrim listing information.

The School is responsible for deciding whether any roster names, gamer tags, profile links, team participation, or similar information may be treated as directory information under the School's policies and notices.

If the School does not authorize a data element for public display, the School should not enter it into public listing or profile fields and should notify Matchmake of any needed restrictions before launch.

## 16. Student Communications And Moderation

Matchmake provides active scrim chat and other team coordination features. The School remains responsible for supervising student use according to School policies.

Matchmake may preserve, restrict, remove, or disclose records when needed to:

- Enforce Terms or the Acceptable Use Policy.
- Support a School investigation.
- Protect users or the service.
- Comply with law or legal process.

The School should define its reporting and escalation process before student launch.

## 17. Changes To Service Or Agreement

Matchmake will not materially change how it collects, uses, or discloses School Data without providing notice to the School as required by this Agreement or applicable law.

Changes to public Terms, Privacy Policy, or Acceptable Use Policy do not reduce Matchmake's obligations under this signed Agreement unless the School agrees in writing.

## 18. Audit And Documentation

Upon reasonable request, Matchmake will provide available documentation about:

- Data categories collected.
- Authorized purposes.
- Subprocessors.
- Security safeguards.
- Public visibility controls.
- Deletion/export capabilities.

Publication placeholder: `[insert any district-required audit, questionnaire, or evidence process]`.

## 19. Legal Compliance

Each party will comply with laws applicable to that party and its role, which may include FERPA, COPPA, PPRA, state student privacy laws, breach notification laws, consumer protection laws, and school procurement requirements.

The School is responsible for its own notices, consents, directory information decisions, school official determinations, parent/eligible-student rights processes, and local policy compliance.

Matchmake is responsible for using School Data according to this Agreement, maintaining appropriate safeguards, and supporting School requests described in this Agreement.

## 20. Term And Termination

This Agreement begins on the effective date and continues until terminated according to the related order form, pilot agreement, or written notice process.

Upon termination, Matchmake will follow Section 13 for return, deletion, and retention of School Data.

Publication placeholder: `[insert term length, renewal, termination notice, and survival language]`.

## 21. Signatures

School/District:

Name: `[authorized signer name]`

Title: `[title]`

Signature: `______________________________`

Date: `______________________________`

Provider:

Name: `[authorized signer name]`

Title: `[title]`

Signature: `______________________________`

Date: `______________________________`

## Appendix A: Expected School Data Categories

Expected categories include:

- Account data: email, display name, user ID, account type, organization/team membership, optional profile text, external profile URLs, and linked game account information if entered.
- Organization data: name, type, school domain, region, verification status, organization administrator, team IDs, calendar feed token, and optional logo.
- Team data: team name, game title, mode, region, rank tier, rank verification type, roster names, roster profile links/data, captain/coach references, ScrimGG rating, and no-show count.
- Scrim data: posting team, matched team, game title, scheduled time, game count, rank preferences, status, expiration time, and workflow updates.
- Chat data: active scrim message body, sender user ID, sender display name, sender team ID, scrim request ID, and timestamp.
- Match review data: game title, match type, match result, score, opponent name, map/mode, played date/time, team/opponent compositions, team/opponent stats, player rows, opponent rows, notes, parser status, parser confidence, and manual-review flags.
- Screenshot extraction data: uploaded scoreboard screenshots sent for extraction, optimized image payload sent to the configured model provider, extracted player names/gamer tags, characters, scores, stats, maps, dates, and manual-review metadata.
- Technical/security data: authentication cookies, theme preference, rate-limit counters, operational logs, error logs, request status, and security/audit data.

## Appendix B: Expected Subprocessors And Integrations

Expected subprocessors/integrations include:

- Supabase: authentication, database, storage if enabled, and backend infrastructure.
- Google Gemini or configured model provider: optional scoreboard screenshot extraction.
- Vercel or configured hosting provider: application hosting and serverless/runtime infrastructure.
- Calendar applications: only when a School or organization creates and shares a calendar subscription link.
- Discord: only if the optional Discord digest integration is configured.
- Logging, monitoring, security, or support providers: `[list before publication if used]`.

## Appendix C: Publication Checklist

Before using this template:

- Fill in legal entity names, contacts, effective date, related agreements, and signer details.
- Review `docs/under-13-coppa-handling.md` with counsel and participating schools/districts.
- Confirm the deletion/export process and retention windows.
- Confirm subprocessors and whether screenshots, logos, calendar links, Discord digest, and paid plans are enabled in production.
- Confirm whether de-identified/aggregated analytics are allowed.
- Confirm breach notice deadline and security evidence requirements.
- Align with the final Privacy Policy, Terms of Service, and Acceptable Use Policy.
- Review against applicable state student privacy laws and district contract requirements.
- Have counsel review before signature.

## Official References Used For This Template

- U.S. Department of Education PTAC, Responsibilities of Third-Party Service Providers under FERPA: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/Vendor%20FAQ.pdf
- U.S. Department of Education PTAC, Protecting Student Privacy While Using Online Educational Services: Model Terms of Service: https://studentprivacy.ed.gov/resources/protecting-student-privacy-while-using-online-educational-services-model-terms-service
- U.S. Department of Education PTAC, Protecting Student Privacy While Using Online Educational Services: Requirements and Best Practices: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/Student%20Privacy%20and%20Online%20Educational%20Services%20%28February%202014%29_0.pdf
- FTC, COPPA FAQs, including COPPA and Schools: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC, 2025 COPPA Rule amendments announcement: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- U.S. Department of Education, Model Terms of Service guidance: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/TOS_Guidance_Mar2016.pdf
