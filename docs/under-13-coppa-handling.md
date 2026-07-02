# Matchmake Under-13 And COPPA Handling

Status: Defined launch decision for school/district and legal review

Last updated: 2026-06-18

This document defines Matchmake's under-13 handling for the MOSEF / high-school launch. It is an operational and contract-readiness decision, not final legal advice. Counsel and each participating school or district should review the final workflow before any under-13 student uses Matchmake.

## Launch Decision

For the MOSEF / high-school pilot, Matchmake should not allow self-service use by children under 13.

Under-13 use is allowed only when all of the following are true:

- A school or district has specifically authorized Matchmake for the student's esports program in writing.
- Matchmake has provided the COPPA-required notice of its collection, use, and disclosure practices to the school or district.
- The school or district has confirmed the consent path before Matchmake collects personal information from the under-13 student.
- The use is limited to the school-authorized esports team coordination and match review purposes described in Matchmake's school documents.
- Matchmake and the school have confirmed how parent/guardian review, correction, deletion, and revocation requests will be handled.

If those conditions are not met, under-13 students should not create accounts, appear in rosters, use scrim chat, upload screenshots, or otherwise provide personal information in Matchmake.

## Current Product Posture

Matchmake is built for high school, collegiate, and amateur esports teams. The current app does not collect date of birth, does not run a self-service age gate, and does not include a parent-consent workflow.

For launch, Matchmake should avoid collecting date of birth unless counsel decides that an age-screening workflow is required. School approval, coach/admin onboarding, and contract terms should be the primary control for who may use school-managed organizations.

## Consent Paths

### School-Authorized COPPA Path

This is the preferred path if a school later needs under-13 access.

Before under-13 access starts:

1. Provide the school with the final Privacy Policy, Terms, Data Privacy Agreement, this under-13 handling document, and any subprocessor list.
2. Confirm the school is authorizing Matchmake for a school-authorized educational or esports program purpose.
3. Confirm Matchmake will not use under-13 personal information for targeted advertising, unrelated commercial profiling, sale, or unrelated marketing.
4. Confirm whether the school is consenting on behalf of parents/guardians or whether the school requires direct parent/guardian consent.
5. Confirm the school will make the notice available to parents/guardians where required or practical.
6. Record the school authorization, consent path, effective date, covered organization/team IDs, and any feature restrictions.

### Direct Parent/Guardian Consent Path

Matchmake should use this path only if the school or counsel decides school authorization is not enough for a specific deployment.

Do not launch direct under-13 self-service access until Matchmake has a verified parent/guardian notice and consent workflow, request handling process, and revocation/deletion workflow.

### No Valid Consent Path

If neither school authorization nor direct parent/guardian consent is in place, Matchmake should block, remove, or suspend under-13 access and avoid further collection of that child's personal information.

## Feature Limits For Under-13 Use

If under-13 access is later approved, enable only the features the school authorizes.

Recommended default limits:

- Accounts: school-managed account creation only; no self-service under-13 signup.
- Rosters: use only school-approved display names or gamer tags.
- Public Scrim Board: do not place under-13 personal details in public listing fields.
- Profile links: disable or prohibit optional external profile links for under-13 students unless the school explicitly approves them.
- Scrim chat: permit only for active scrim coordination under school/team supervision expectations.
- Screenshot extraction: allow only school-authorized scoreboard screenshots and prohibit unrelated personal information.
- Calendar links: treat calendar feed URLs as controlled school/team links and rotate them if shared too broadly.
- Logs and backups: keep only as long as needed for the specific operational, security, legal, or school-authorized purpose.

## Actual-Knowledge Response

If Matchmake learns that a user is under 13 and the required authorization or consent path is not already documented:

1. Preserve only the information needed to identify the account, school, organization, and request context.
2. Disable or remove the user's access while the school contact is notified and authorization is reviewed.
3. Stop further collection from that user.
4. Ask the school whether to export, correct, delete, or retain the data under the school process.
5. Delete or de-identify the child's personal information if no valid authorization or preservation basis applies.
6. Document the decision, school contact, data scope, action taken, and completion timestamp in the privacy-request tracker.
7. Do not reinstate access unless the required school or parent/guardian consent path is completed.

## Request Handling

Under-13 parent/guardian review, correction, deletion, or consent-revocation requests should generally be routed through the school for school-managed organizations, unless the final agreement, law, or school instruction requires Matchmake to respond directly.

Matchmake should support the school by:

- Identifying the affected user, team, roster, scrim, chat, match review, screenshot extraction, and calendar records.
- Exporting relevant records before deletion when the school requests return of data.
- Deleting or de-identifying records according to the deletion/export process.
- Confirming completion to the verified school contact.

## Launch Checklist

Before allowing any under-13 use:

- Finalize the published Privacy Policy, Terms, Acceptable Use Policy, Data Privacy Agreement, and deletion/export process.
- Fill in legal entity, privacy, support, and mailing-address placeholders.
- Confirm the consent path with counsel and the school/district.
- Confirm whether school consent is enough for the deployment or whether direct parent/guardian consent is required.
- Confirm under-13 feature restrictions, especially chat, public listings, profile links, screenshots, and calendar links.
- Confirm the request tracker owner and under-13 request response procedure.
- Confirm retention windows for under-13 data, logs, backups, and request records.
- Train school admins/coaches not to invite under-13 users unless the authorization path is complete.

## Official References

- FTC, COPPA FAQs: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- FTC, COPPA guidance for ed tech companies and schools: https://www.ftc.gov/business-guidance/blog/2020/04/coppa-guidance-ed-tech-companies-schools-during-coronavirus
- FTC, 2025 COPPA Rule amendments announcement: https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data
- U.S. Department of Education, protecting student privacy while using online educational services: https://studentprivacy.ed.gov/sites/default/files/resource_document/file/Student%20Privacy%20and%20Online%20Educational%20Services%20%28February%202014%29_0.pdf
