# Matchmake Improvement TODO

This file tracks product, UX, dashboard, data, and QA work across Codex sessions.

Important constraint: Do not modify the extraction review flow. Do not add confidence badges, "Needs Review" pinned rows, character correction before save, extraction audit pages, or any new review step between extraction and saving.

## 1. P0 — Stats Dashboard Readability

- [x] Redesign match review first screen around a clear match story: result, score, opponent, map/mode, date, and key takeaway.
- [x] Move raw performance tables below summary visuals so they are secondary, not the primary dashboard experience.
- [x] Add coach-friendly insight cards for strengths, weaknesses, and first review priority.
- [x] Replace dense stat grids with fewer high-signal KPI cards per game.
- [x] Add reusable visual comparison components for team vs opponent metrics.
- [x] Add trend/sparkline components for recent performance across saved reviews.
- [x] Define a consistent stat formatting system for large numbers, percentages, ratios, and missing values.

## 2. P0 — Data Model and Analytics Foundation

- [x] Keep raw extraction JSON in `team_match_reviews` for auditability and backwards compatibility.
- [x] Design normalized player-level match review storage for queryable analytics.
- [x] Design normalized team-level match stat storage for trend and comparison queries.
- [x] Add migration SQL for normalized review player rows.
- [x] Add migration SQL for normalized review team stat rows if needed.
- [x] Update save logic to write both existing JSONB fields and normalized analytics rows.
- [x] Backfill normalized analytics data from existing `team_match_reviews` records.
- [x] Add indexes for team, game, player, role, character, played date, and review series.

Implementation note:
- Added `supabase_match_review_analytics_foundation.sql`.
- `team_match_reviews` remains the source of truth for review editing, extraction output, screenshots, notes, and backwards compatibility.
- `match_review_players` is a normalized mirror for per-player analytics, player trends, role trends, and character/agent/champion/hero usage.
- `match_review_team_stats` is a normalized key-value mirror for team/opponent stat trends and comparisons.
- Future app reads can gradually move aggregate dashboards to the normalized tables, but the current save/review flow should continue reading and writing the existing JSONB fields.
- Normalized rows are synced by an additive database trigger after insert/update, so the app does not need a new extraction or review step.

## 3. P1 — Dashboard Structure Cleanup

- [x] Split the large team dashboard page into focused components.
- [x] Move game dashboard configs out of `src/app/team/[id]/dashboard/page.js`.
- [ ] Move extraction-to-review mapping functions into dedicated utility modules.
- [x] Create a shared `GameDashboardShell` component.
- [ ] Create dedicated components for upload, overview, comparison, raw stats, and editing areas.
- [x] Keep save behavior unchanged while reorganizing code.
- [ ] Add focused tests for review payload building and game stat mapping.

Implementation note:
- Extracted pure dashboard presentation into `GameDashboardShell`, `ReviewDashboardTabs`, `GameSummaryCards`, and `MatchStorySummary`.
- Moved dashboard stat/config metadata into `src/lib/dashboard/game-dashboard-configs.js`.
- Upload, extraction, review editing, payload building, and save behavior intentionally remain unchanged in the page for this pass.
- Extraction-to-review mapping and focused payload/stat mapping tests are deferred because they touch fragile behavior outside pure dashboard structure.

## 4. P1 — Game-Specific Dashboards

- [x] Create a League of Legends dashboard layout focused on gold, damage, KDA, role contribution, game length, and champion comp.
- [x] Create a Valorant dashboard layout focused on round diff, ACS, KDA, first bloods, plants, defuses, and econ rating.
- [x] Create a Marvel Rivals dashboard layout focused on final hits, KDA, damage, blocked damage, healing, accuracy, and hero comp.
- [x] Create an Overwatch dashboard layout focused on eliminations, deaths, assists, damage, healing, mitigation, final blows, and objective kills.
- [x] Create a Deadlock dashboard layout focused on souls, souls per minute, KDA, player damage, objective damage, and healing.
- [x] Define which stats appear in each game's overview, players, comps, trends, and raw/edit sections.
- [x] Keep lower-priority games on the universal/manual dashboard until the five priority games are polished.

Implementation note:
- Added explicit priority stats, secondary/deep stats, comparison fields, and chart intent metadata for League of Legends, Valorant, Marvel Rivals, Overwatch, and Deadlock.
- Added `GameSpecificOverview` to render the priority game stat story in Compare/Deep Stats instead of crowding the simple overview scoreboard.
- Missing or unavailable stats render as `Not available`; no fake analytics are generated.
- Extraction, upload, review editing, and save behavior remain unchanged.

## 5. P1 — Visual Hierarchy and Readability

- [ ] Establish a dashboard hierarchy: summary band, primary insights, charts, secondary details, raw/edit controls.
- [ ] Reduce repeated card styling where sections should be full-width bands or unframed layouts.
- [ ] Standardize page headings, section headings, labels, stat values, and helper text.
- [ ] Improve spacing between dashboard modules for faster scanning.
- [ ] Make tabs and filters visually consistent across dashboard, team, calendar, and requests pages.
- [ ] Ensure mobile layouts keep key match summary and actions visible without dense tables first.
- [ ] Review dark mode contrast for stat cards, comparison bars, and warning states.

## 6. P1 — Team Page Analytics

- [x] Redesign team overview around team form and recent performance.
- [x] Add last 5 review record and average margin.
- [x] Add strongest and weakest recent stat indicators.
- [x] Add most-played character/agent/champion/hero composition.
- [x] Add top-performing map/mode when enough data exists.
- [ ] Add missing-review prompts for completed scrims without saved reviews.
- [ ] Add clearer links from team aggregate stats into individual match reviews.

Implementation note:
- Reworked the team stats Overview into a Review Summary with last 5 record, game-specific average margin, win rate, total record, most-played comp, strongest map/mode, and weakest stat trend.
- Uses saved `team_match_reviews` review data already loaded on the team page; missing stats render as empty/neutral states instead of invented values.
- Missing-review prompts and drill-down links remain future work.

## 7. P2 — Scrim Posting Flow

- [ ] Add a listing preview before publishing a scrim.
- [ ] Add posting templates such as "Tonight BO3", "VOD review scrim", and "ranked practice".
- [ ] Improve copy around opponent rank range and what kind of teams should request.
- [ ] Make game, team, rank, region, date, time, and games count easier to scan before submit.
- [ ] Add validation for unrealistic times, missing teams, and expired listings.
- [ ] Improve empty state for orgs without teams before posting.

## 8. P2 — Calendar and Requests Lifecycle

- [ ] Add a shared lifecycle model: Posted, Requested, Confirmed, Played, Review Missing, Reviewed.
- [ ] Show lifecycle status on request cards.
- [ ] Show lifecycle status on calendar day cards and selected-day scrim cards.
- [ ] Add clear next actions for each lifecycle state.
- [ ] Link completed scrims directly to the appropriate review dashboard.
- [ ] Highlight confirmed scrims without post-game reviews.
- [ ] Make request tabs communicate inbound, outbound, confirmed, and completed work more clearly.

## 9. P2 — Org Management Improvements

- [ ] Add org-wide program health stats.
- [ ] Show active teams, upcoming scrims, completed scrims, and missing reviews.
- [ ] Show most active game and most active team.
- [ ] Add response/status summary for open and pending scrims.
- [ ] Improve team grouping by game on the organization page.
- [ ] Add clearer owner-only messaging for logo and org-level settings.

## 10. P2 — MVP Scope and Messaging

- [ ] Mark League of Legends, Valorant, Marvel Rivals, Overwatch, and Deadlock as priority dashboard games.
- [ ] Clarify which games support screenshot extraction, basic manual review, or full analytics.
- [ ] Update empty states for unsupported or lower-priority games.
- [ ] Avoid implying full stat depth for games that only have basic/manual support.
- [ ] Review navigation labels so users understand where to post scrims, manage teams, review matches, and view calendar.
- [ ] Add concise onboarding copy for new organizations with no teams or scrims.

## 11. P3 — Advanced Coaching Features

- [ ] Add coach tags for recurring review themes.
- [ ] Correlate coach tags with wins, losses, maps, comps, and stat gaps.
- [ ] Add player profile trend pages.
- [ ] Add map/mode performance breakdowns by opponent rank.
- [ ] Add composition recommendations based on historical performance.
- [ ] Add exportable coach reports for a scrim series.
- [ ] Add team/player comparison views across time windows.

## 12. Final QA and Cleanup

- [ ] Verify dashboard readability on desktop, tablet, and mobile.
- [ ] Verify all five priority games display game-specific stats correctly.
- [ ] Verify old match reviews still render after data model changes.
- [ ] Verify new normalized analytics rows are written and backfilled correctly.
- [ ] Run production build and lint checks.
- [ ] Smoke test scrim posting, requests, calendar, team page, org page, and match review save flow.
- [ ] Review accessibility: keyboard navigation, focus states, labels, contrast, and responsive text fitting.
- [ ] Remove unused components, dead helpers, and stale dashboard code after migration.

## 13. P1 — Behavior-Preserving Codebase Cleanup

Working rules:

- Complete one unchecked item at a time. Do not combine extraction, dashboard, dependency, and tooling work in one change.
- Before moving code, add or extend focused coverage for the behavior being moved.
- For every completed item, run its focused checks, `npx eslint src scripts --max-warnings 0`, and `npm run build`, then add a short completion note beneath the item.
- Leave an item unchecked and record the blocker if its expected behavior cannot be verified locally.

### Tooling and verification baseline

- [x] Ignore `.claude/**` in `eslint.config.mjs` so `npm run lint` does not scan nested worktrees or their generated `.next` output.
  - Completed 2026-07-09: added the ignore; `npm run lint` now completes with no worktree/generated-output errors.
- [x] Add an `npm test` command that runs the existing post-game completion and fixture regression checks.
  - Completed 2026-07-09: `npm test` runs the deterministic field-completion assertions and five-game regression fixtures; live API/browser checks remain opt-in verification commands.
- [x] Add focused tests for shared scrim/date/formatting utilities before extracting them from page files.
  - Completed 2026-07-09: added deterministic UTC characterization coverage for scrim duration, initials, game-count labels, date/time inputs, and scheduled-time serialization. The new utility module is not wired into pages yet; page migration remains the next shared-helper task.
- [x] Add focused tests for game asset path/alias resolution before deduplicating it.
  - Completed 2026-07-09: added asset-stem and path tests for League, Valorant, Marvel Rivals, and Deadlock, including the existing Team/Dashboard Marvel alias difference. No page imports changed; the deduplication task must preserve each page's current variant.
- [ ] Add focused tests for extraction-to-review mapping and review-payload construction.
  - Deferred 2026-07-09: the mapping and payload helpers are private functions inside the JSX client page, so a deterministic Node test cannot import them without first completing the later mapping-extraction task. Existing screenshot verification checks raw extractor output rather than the page's mapping behavior. When that module is extracted, add these tests in the same change before replacing the page calls.
- [x] Set `outputFileTracingRoot` in `next.config.mjs` to this repository root and confirm the production build no longer selects the parent lockfile.
  - Completed 2026-07-09: configured the root relative to `next.config.mjs`; the production build now traces from this repository and no longer emits the parent-lockfile workspace warning.

### Shared helpers and assets

- [x] Extract the repeated scrim end-time, initials, game-count, and date formatting helpers into a small shared `src/lib` module; preserve all current page output.
  - Completed 2026-07-09: `src/lib/scrim-utils.js` now contains the shared behavior and tested detail, standard, and time-only display formats. The existing page calls remain untouched until the following migration task.
- [x] Replace the duplicated calls in Scrim Board, Scrim Detail, Team, Calendar, Requests, and Scrim Chat with the shared helpers.
  - Completed 2026-07-09: migrated all listed pages and the ICS generator to `src/lib/scrim-utils.js`, retaining their prior date-format and time-parser variants through named imports.
- [x] Extract League, Valorant, Marvel Rivals, and Deadlock asset aliases and image-path construction from the Team and Match Review pages into a shared game-assets module.
  - Completed 2026-07-09: both pages now use `src/lib/game-assets/asset-paths.js`; the Match Review page passes its existing dashboard Marvel variant, while the Team page retains its existing default variant.
- [x] Replace the dashboard's locally maintained Marvel Rivals hero options with the canonical game-assets source.
  - Completed 2026-07-09: the dashboard now imports the hero option list from `marvel-rivals-hero-assets.js`; its source data also drives the asset metadata and is covered by the asset test.

### Team page decomposition

- [ ] Extract pure Team Page analytics calculations and stat-formatting helpers from `src/app/team/page.js` without changing the rendered values.
  - [x] Extract and test the review-summary KPI calculation used at the top of Team Stats.
    - Completed 2026-07-09: moved `calculateReviewKpis` and its formatting helpers to `src/lib/dashboard/team-review-kpis.js`; Valorant and League regression cases now run in `npm test`.
  - [ ] Extract and test the aggregate/deep-stat calculation engine (`buildGameAggregateStats` and supporting helpers).
- [ ] Extract roster-profile validation and roster-management UI from `src/app/team/page.js` into focused modules/components.
- [ ] Extract Team Page review history and scrim list presentation components from `src/app/team/page.js`.
- [ ] Extract game-specific Team Stats and Deep Stats presentation components from `src/app/team/page.js`.
- [ ] Extract Team Page data loading and mutation handlers into a focused hook while retaining the same Supabase queries and error states.
- [ ] Verify the refactored Team Page on desktop and mobile: roster save, review history, Team Stats, Deep Stats, and team deletion.

### Match Review dashboard decomposition

- [ ] Move game-specific extraction-to-review mapping functions from `src/app/team/[id]/dashboard/page.js` into a tested server-safe utility module.
- [ ] Extract screenshot resizing/upload and extraction-status UI from the Match Review page into focused modules/components.
- [ ] Extract review editor fields and player-row editing components from the Match Review page.
- [ ] Extract comparison, overview, and game-specific presentation components that still live in the Match Review page.
- [ ] Extract Match Review data loading, save, and deletion handlers into a focused hook while retaining the same Supabase payloads and URL behavior.
- [ ] Verify the refactored Match Review flow for all five priority games: upload/manual fallback, edit, save, reload, comparison, and mobile layout.

### Extractor and API organization

- [ ] Split game-specific extraction prompts from `src/lib/postgame-extraction.js` into dedicated modules while preserving exact prompt selection.
- [ ] Split post-extraction normalization/completion rules from prompt definitions and extend fixture coverage for every moved game.
- [ ] Extract API image validation, reference-asset loading, Gemini request/retry logic, and response normalization from `src/app/api/postgame/extract/route.js` into focused server modules.
- [ ] Re-run extractor API verification and all regression fixtures after each extractor/API extraction.

### Dependency and runtime hygiene

- [ ] Update Next.js to the latest compatible 15.5 patch release and re-run lint, build, and extractor checks; do not use `npm audit fix --force`.
- [ ] Reassess the PostCSS audit finding after the controlled Next.js update and document the remaining status.
- [ ] Resolve the Node ESM warning from direct test imports without breaking the CommonJS Tailwind configuration.
