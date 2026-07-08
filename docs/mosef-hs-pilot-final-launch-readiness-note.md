# MOSEF / HS Pilot Final Launch Readiness Note

Prepared: 2026-07-02

Scope: Matchmake MOSEF / high-school fall pilot launch gate.

## Overall Status

Status: Conditional readiness with accepted launch exceptions.

This is not a clean green launch approval. The app has passed the final technical QA gates that were completed in the checklist, and the school-facing operating documents are largely drafted, but several production-readiness and owner-decision gates remain unresolved. The pilot can only proceed as a limited launch if the launch owner accepts the exceptions below and keeps the remaining items tracked to closure.

## Verified For This Gate

- Full production build passed with `npm run build`.
- Focused source lint passed with `npx eslint src`.
- Authenticated browser smoke passed for `/`, `/team`, `/requests`, `/calendar`, and `/org` after fixing the missing `useRef` import on the team page.
- Extractor UI QA passed for Valorant, League of Legends, Overwatch 2, Marvel Rivals, and Deadlock without saving match reviews or changing the screenshot review/save flow.
- Production RLS readbacks showed RLS enabled on checked app tables, no literal always-true policy predicates, and scoped anon/authenticated visibility in role simulations.
- School launch documents exist for privacy, terms, acceptable use, DPA, deletion/export, under-13 handling, no-sale/no-ads language, behavior reporting, admin removal, support process, onboarding, first team setup, first scrim posting, match review upload, feedback collection, abuse/report queue concept, dashboard concept, and launch success metrics.

## Accepted Launch Exceptions

The following gates were explicitly skipped/deferred by launch-owner instruction so the final launch gate could continue. They are not confirmed ready.

| Area | Current state | Launch risk | Required follow-up |
| --- | --- | --- | --- |
| Privacy, terms, and school docs | Drafts exist, but publication/signature decisions remain open. | Schools may receive documents with unresolved legal, contact, DPA, and approval details if published too early. | Fill or formally accept the items in `docs/privacy-terms-school-docs-readiness-checklist.md`. |
| Support owner and escalation path | Operating model exists, but final inboxes, owners, backups, hours, logs, and school contacts are not named. | Urgent school, safety, privacy, or support issues could be delayed or handled inconsistently. | Fill or formally accept the items in `docs/support-owner-escalation-readiness-checklist.md`. |
| Next/PostCSS audit finding | `npm audit` still reports Next's nested `postcss@8.4.31`; root `postcss` is patched. | Known moderate production-impacting advisory remains until Next ships or the app adopts a safe patched path. | Upgrade to a stable/backport Next release that bundles patched PostCSS, use a reviewed override, or document owner acceptance. |
| Production/dev Supabase separation | Local development still points at production project `urrnrcdxekhovsemeuly`, but the launch owner accepted deferring this for the narrow pilot on 2026-07-07. | Local QA can still create or mutate production data if used carelessly. | Avoid routine local QA against production; move local/dev to local Supabase, a free dev project, a branch, or staging before broader rollout. |
| Gemini free-tier operation | Local Gemini key works against `gemini-flash-lite-latest`, and the launch owner wants to stay on the Gemini API Free tier as long as possible. | Screenshot extraction can hit free-tier `429 RESOURCE_EXHAUSTED`, overload, or model limits during school use. | Keep pilot extraction volume narrow, rely on manual-entry fallback, monitor extraction failures, and enable paid billing only if quota blocks the pilot. |
| Supabase native backups | Backup status is not visible through the connector, and paid backup/PITR verification is deferred for the narrow pilot. | Free-tier or unverified backup status creates data-loss risk. | Before broader rollout, verify Dashboard backups/PITR or run regular `supabase db dump` exports to off-site storage. |

## Remaining Unresolved Checklist Items

This item is still unchecked in `MOSEF_HS_LAUNCH_TODO.md` and should stay visible after the final note:

- Confirm required environment variables are set in production.

This is not a cosmetic loose end. The production calendar feed route still returns a configuration `500`, so the deployed app is missing a required Production-scoped server env var or has not been redeployed after setting it.

## Launch Decision

If the pilot launches now, it should launch as a limited MOSEF / HS pilot under explicit exception handling:

- Limit the rollout to the smallest committed pilot group.
- Keep owner review tight during the first week.
- Do not expand beyond the pilot until the unresolved production env-var gate is closed and the accepted legal/docs, support, backup, quota, and data-separation exceptions are either resolved or formally carried forward with owner, date, scope, and follow-up.
- Record support, safety, privacy, extraction, and reliability issues in the configured restricted logs and weekly launch readout.

## Immediate Next Actions

1. Name the support inbox, reporting contact, support owner, backup support owner, incident owner, backup incident owner, business hours, restricted log locations, and school escalation contacts.
2. Fill the privacy/terms/DPA publication placeholders or record a formal counsel/school exception.
3. Add or verify `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production settings, then redeploy/promote and confirm a bogus calendar token returns `404 Calendar feed not found` instead of `500 Calendar feed is not configured`.
4. Monitor Gemini extraction usage during the pilot; stay on the Free tier unless repeated quota errors block school workflows.
5. Before broader rollout, create or designate a separate development/staging Supabase project, branch, or local Supabase stack and move local/dev workflows off production data.
6. Re-run the dependency audit once a safe Next/PostCSS patched path exists.

## Bottom Line

The app is technically much closer than it was, but the launch is still exception-based. The safest honest position is: proceed only as a narrow pilot with explicit owner acceptance of the open risks, not as a broad school-ready launch.
