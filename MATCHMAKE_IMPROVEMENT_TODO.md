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
