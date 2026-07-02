# Matchmake Production Monitoring And Logging Strategy

Status: MOSEF / high-school pilot operational draft

Last updated: 2026-06-25

This runbook defines the basic monitoring and logging strategy for the MOSEF / high-school launch. It uses the logging surfaces Matchmake already has today, avoids adding a new vendor dependency before launch, and defines when to upgrade to a dedicated error-monitoring service.

## Current Baseline

Matchmake runs on Vercel with Next.js API routes and Supabase. The current baseline is:

- Vercel Runtime Logs for app route, API route, and server-side errors.
- Supabase Dashboard logs for database and Edge Function failures, including the weekly Discord calendar function.
- The owner-only `/admin` activity log for high-risk administrative actions.
- Sanitized extractor logs in `POST /api/postgame/extract`; raw model payloads, raw screenshot data, and verbose extraction debug logs must stay behind the existing `POSTGAME_EXTRACT_DEBUG_LOGS=true` or local development gate.

This is acceptable for launch only if an owner checks the logs on a fixed cadence and after each production deploy. It is not a replacement for a longer-term error tracking tool with alerting.

## What To Monitor

Treat these as launch-critical signals:

| Area | Signal | Where to check | Escalation |
| --- | --- | --- | --- |
| Auth and onboarding | Signup, login, profile, org creation, or team creation errors | Vercel Runtime Logs; Supabase Auth logs | Same day during pilot onboarding |
| Scrim operations | Scrim posting, request accept/decline, status update, chat load/send, calendar feed errors | Vercel Runtime Logs; Supabase logs | Same day if schools are actively scheduling |
| Screenshot extraction | `quota_exhausted`, `model_overloaded`, `parse_failed`, Gemini failures, upload validation spikes, or unexpected `500` errors | Vercel Runtime Logs for `/api/postgame/extract`; Gemini billing/quota console for quota issues | Same day for repeated school-facing failures |
| Match review saving | Failed save, review series update, Team Stats, or Deep Stats load errors | Vercel Runtime Logs; Supabase table logs if available | Same day if teams cannot save reviews |
| Discord calendar digest | Missing env vars, Supabase query errors, webhook failures | Supabase Edge Function logs; Discord webhook response code in function logs | Next business day unless it blocks a school event |
| Admin actions | Team/message/review/user-removal failures or unexpected admin activity | `/admin` activity log; Vercel Runtime Logs | Immediate review for safety or privacy actions |

## Log Hygiene Rules

Logs must help debug production issues without exposing student data unnecessarily.

- Do not log `GEMINI_API_KEY`, Supabase service-role keys, auth tokens, cookies, calendar feed tokens, Discord webhooks, or signed URLs.
- Do not log uploaded screenshots, raw screenshot OCR/model payloads, raw Gemini responses, or full saved match-review payloads in production.
- Do not add student email addresses, full chat message bodies, roster profile links, or school privacy request details to routine operational logs.
- Prefer stable context fields such as route name, status code, error code, request phase, team ID, organization ID, scrim ID, review ID, duration in milliseconds, and retry/fallback state.
- Use `console.warn` for degraded but recovered behavior, and `console.error` for failed requests or work that needs operator review.
- Keep user-facing responses generic when errors involve secrets, model providers, database details, or account state.

## Launch Cadence

Before MOSEF pilot launch:

1. Open the latest production Vercel deployment and review runtime logs for errors from the last 24 hours.
2. Open Supabase logs for project `urrnrcdxekhovsemeuly` and review recent database/API/Auth errors.
3. Open Supabase Edge Function logs for the weekly Discord calendar function and confirm there are no repeated webhook or query failures.
4. Review `/admin` activity for unexpected or failed owner actions.
5. Record any unresolved error class in the launch readiness notes with owner, severity, and next action.

After each production deploy:

1. Confirm the deployment is ready.
2. Review Vercel Runtime Logs for errors during the first hour after deploy.
3. Run the relevant smoke test for the changed area.
4. If errors repeat, pause launch-facing promotion until the cause is understood or documented as non-blocking.

During the first two pilot weeks:

- Check production errors at least once each school day.
- Check extraction errors after any planned screenshot-upload testing with schools.
- Check Supabase Edge Function logs after each scheduled Discord calendar digest.
- Keep a short incident note for repeated failures, even when they are recovered by manual-entry fallback.

## Severity Guide

| Severity | Examples | Required response |
| --- | --- | --- |
| P0 | Students or coaches cannot sign in; cross-org data exposure; destructive admin action fails midway; secrets appear in logs | Stop affected launch activity, preserve evidence, fix or roll back before continuing |
| P1 | Repeated scrim posting/request failures; repeated extraction `500` or quota failures; match reviews cannot save | Same-day owner review and fix or documented workaround |
| P2 | Intermittent recovered errors, single extraction fallback, missing optional Discord digest, non-blocking dashboard warning | Track and address before broad rollout |

## Upgrade Path

The basic launch setup relies on manual review of Vercel and Supabase logs. Move to a dedicated monitoring setup when one of these is true:

- More than one school is actively piloting at the same time.
- The support owner cannot check logs every school day.
- Extraction failures need automatic alerting by error type.
- The app needs retention, search, or dashboards beyond the Vercel/Supabase consoles.

Preferred upgrade order:

1. Enable Vercel Web Analytics and Speed Insights for privacy-friendly usage and performance baselines.
2. Configure a Vercel Log Drain or native Marketplace integration on a Pro/Enterprise plan.
3. Add Sentry or an equivalent error tracker for release-aware frontend and server exception grouping.
4. Add alerts for repeated extractor failures, signup failures, scrim posting failures, and production `500` spikes.

Do not add new third-party monitoring that receives student data until the Privacy Policy, DPA subprocessors list, and school-facing disclosures are updated.

## Owner Checklist

- Production log owner: `[assign before launch]`
- Backup log reviewer: `[assign before launch]`
- Daily pilot log-check time: `[assign before launch]`
- Escalation contact for school-impacting failures: `[assign before launch]`
- External monitoring vendor decision: `[defer until school/disclosure review or multi-school rollout]`
