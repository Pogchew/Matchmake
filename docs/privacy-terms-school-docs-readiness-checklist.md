# Privacy, Terms, And School Docs Readiness Checklist

Status: Blocked final launch gate checklist

This checklist summarizes the remaining decisions before the Matchmake school-facing privacy, terms, and school launch documents can be treated as publication-ready or signature-ready. It is not legal advice and does not replace counsel, school, or district review.

## Source Docs Checked

- `docs/school-facing-privacy-policy-draft.md`
- `docs/terms-of-service-draft.md`
- `docs/acceptable-use-policy-draft.md`
- `docs/school-district-data-privacy-agreement-template.md`
- `docs/school-data-deletion-export-process.md`
- `docs/under-13-coppa-handling.md`
- `docs/student-data-no-sale-no-ads.md`
- `docs/inappropriate-behavior-reporting-escalation.md`
- `docs/admin-removal-guidance.md`
- `docs/mosef-support-contact-process.md`
- `docs/coach-admin-onboarding-guide.md`
- `docs/first-team-setup-guide.md`
- `docs/first-scrim-posting-guide.md`
- `docs/match-review-upload-guide.md`
- `docs/fall-pilot-feedback-collection-plan.md`

## Current Coverage

The document set covers the main launch review areas:

- School-facing privacy framing, including public Scrim Board visibility, screenshot extraction, COPPA, FERPA, retention, security, and privacy request handling.
- Terms of Service framing for school-authorized use, under-13 gating, account rules, scrim/chat conduct, screenshot extraction, user content, service providers, acceptable use, enforcement, availability, and legal terms placeholders.
- Student/team behavior expectations through the AUP and school-first reporting process.
- District agreement template with FERPA school-official framing, COPPA, subprocessors, breach notice, access/correction/export/deletion, de-identified data, security, audit, term, and signature sections.
- Operational deletion/export, under-13/COPPA, no-sale/no-ads, admin removal, support/contact, onboarding, first-team setup, first-scrim posting, match-review upload, and pilot feedback procedures.

## Required Decisions Before Publication

### Identity And Contacts

- Fill in Matchmake legal entity or owner name.
- Fill in privacy contact email.
- Fill in support contact email.
- Fill in reporting contact email.
- Decide whether a business mailing address will be published.
- Name the privacy request tracker owner.
- Name the support process owner and backup owner.
- Name the incident response owner and backup owner.
- Confirm business hours and expected response windows.

### Pilot Commercial And Contract Terms

- Decide whether the pilot is free, paid, invoiced, covered by an order form, or governed by another written pilot agreement.
- Decide whether any separate school, district, MOSEF, or order-form terms override the generic Terms draft.
- Fill in limitation of liability language.
- Fill in indemnity language.
- Select governing law, venue, dispute process, and school/district exceptions.
- Confirm whether public schools require procurement-specific terms.

### Data Privacy Agreement Details

- Fill in school/district legal name and signer details per agreement.
- Fill in provider legal name and signer details.
- Add effective date and related agreement references.
- Confirm subprocessor list, including hosting, auth/database, model/extraction, monitoring/logging, support, and communication vendors actually used at launch.
- Decide material subprocessor change notice period and objection process.
- Decide security schedule, insurance, encryption, questionnaire, or evidence commitments.
- Decide breach notice deadline.
- Decide retention windows.
- Decide whether de-identified or aggregated analytics are allowed for district agreements.
- Decide term length, renewal, termination, and survival language.

### Under-13 And School Authorization

- Confirm with counsel and each participating school or district whether school authorization is sufficient for any under-13 access.
- Confirm whether under-13 users are fully excluded for launch or allowed only after written school authorization.
- Confirm whether any parent/guardian notice, consent, review, correction, deletion, or revocation workflow must be used.
- Confirm whether Matchmake should avoid collecting date of birth for launch or add an age-screening workflow.
- Confirm under-13 restrictions for chat, public listings, profile links, screenshots, and calendar links.

### Deletion, Export, And Retention

- Confirm final privacy request intake channel.
- Confirm request authentication and approval workflow for schools, parents/guardians, eligible students, coaches, and users.
- Confirm school export package scope.
- Decide whether two-party scrim chats are included in school export packages by default or only after school/legal approval.
- Decide whether deletion confirmations are email confirmations, signed PDFs, or DPA-specific certificates.
- Confirm backup retention and whether deleted data can persist in backups until normal rotation.
- Decide whether under-13/COPPA deletion targets are shorter than the launch deletion/export defaults.

### Reporting, Safety, And Escalation

- Publish the final reporting contact.
- Publish the final support contact.
- Name the approved restricted case-log location.
- Collect primary and backup school safety/esports contacts for every pilot school.
- Confirm Severity 0 emergency language with participating schools and counsel.
- Confirm legal and mandated-reporting ownership, including suspected child sexual exploitation handling.
- Train the Matchmake owner and school pilot contacts on `docs/inappropriate-behavior-reporting-escalation.md` and `docs/admin-removal-guidance.md`.

### Feedback Collection

- Create the actual pilot feedback form in the school-approved tool.
- Publish the form link to coaches/admins.
- Name the owner who reviews submissions.
- Confirm the feedback form does not collect student safety reports, discipline details, medical information, private contact details, or emergency information.

## Ready Criteria

The final launch gate can be checked off when:

- All bracketed publication placeholders in the source docs are filled, removed, or explicitly accepted as launch exceptions.
- Counsel or authorized school/district leadership has reviewed the final publication/signature set.
- The privacy, support, reporting, incident, and feedback owners are named.
- The privacy request tracker and restricted case-log locations are selected.
- Participating schools have supplied required escalation contacts.
- Any launch exceptions are documented with owner, date, scope, and follow-up requirement.

## Current Gate Result

As of 2026-07-02, the document set is strong enough for owner, counsel, and school review, but it is not publication-ready or signature-ready. The `Confirm privacy/terms/school docs are ready` TODO item should remain unchecked until the required decisions above are resolved or formally accepted as launch exceptions.
