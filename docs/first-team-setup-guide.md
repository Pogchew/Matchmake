# Matchmake First-Team Setup Guide

Status: MOSEF / high-school pilot guide
Audience: coaches, esports leads, and school administrators creating their first team
Prerequisite: a coach/admin account and organization already exist

This guide covers only the first team setup flow. Use `docs/coach-admin-onboarding-guide.md` for the broader coach/admin launch checklist.

## What You Need Before Creating The Team

Prepare these details before opening Matchmake:

- Team name as it should appear to coaches and opponents.
- Game title.
- Team mode, such as 5v5, 4v4, 3v3, 2v2, or 1v1.
- Coach-declared rank tier.
- Team location: West Coast, Mid-West, or East Coast.
- Roster names approved for school use.
- Whether optional roster profile links are allowed by the school.

Do not collect personal phone numbers, personal social media links, private messaging handles, home addresses, school IDs, or other sensitive student information for team setup.

## Create The First Team

1. Sign in with the coach/admin account.
2. Confirm the organization exists. If `/team/new` says to create an organization first, go to `/org/new` and finish organization setup before continuing.
3. Go to `/team/new`.
4. Enter the **Team name**.
   - Use a name students, coaches, and opponent schools can recognize.
   - Avoid jokes, aliases, or names that could violate school conduct expectations.
5. Choose the **Game**.
   - Current options include Valorant, Call of Duty, Counter-Strike 2, League of Legends, Rocket League, Overwatch 2, Marvel Rivals, Deadlock, SSBU, and Honor of Kings.
6. Confirm the **Mode**.
   - Matchmake changes the default mode when the game changes.
   - Review it before saving, especially for Rocket League, Call of Duty, SSBU, and 6v6 games.
7. Add **Roster names** only as setup reference.
   - Player accounts are not created from this field.
   - Use school-approved display names or names the coach can identify.
8. Choose the **Rank tier**.
   - This is coach-declared at setup.
   - Pick the tier that best reflects the team's current competitive level, not the highest individual player's peak rank.
9. Choose the **Team location**.
   - Pick the closest region for scheduling and ping expectations.
10. Select **Create Team**.

After the team is created, Matchmake returns you to the organization/team workspace.

## Verify The Team

Open `/org` and confirm:

- The new team appears under the organization.
- Game, mode, rank, and region are correct.
- The organization dashboard quick actions are available.

Open `/team` and confirm:

- The correct team is selected.
- The team header shows the expected game, mode, rank, location, and rating.
- Team Stats are visible, even if they are empty before match reviews.
- Upcoming Scrims and Game History empty states make sense.
- Roster Management can be expanded.

If you manage more than one team, use the **Switch Team** selector on `/team` to verify the right team before editing roster or reviewing stats.

## Finish The Roster In Roster Management

The first team form is not the final roster editor. After creating the team:

1. Open `/team`.
2. Expand **Roster Management**.
3. Add or edit player names.
4. Set each player's rank when useful for coach review.
5. Leave profile links blank unless the school has approved them.
6. If using profile links, enter complete HTTPS links only.
7. Select **Save Roster**.
8. Confirm the page shows `Roster saved.`

Optional profile links should point only to a relevant game, ranking, league, tournament, or school-approved esports profile. Do not add personal social media, invite links, private messaging accounts, or pages that expose sensitive student information. Use `docs/profile-link-safety-guidance.md` for the full review checklist.

## Common Setup Mistakes

- **Creating a team before an organization exists.** Create the organization first, then return to `/team/new`.
- **Choosing the wrong game mode after changing the game.** Re-check mode before saving.
- **Using an aspirational rank.** Rank should describe the team today so scrim matches are realistic.
- **Treating roster names as student accounts.** Matchmake does not create student accounts from the roster field.
- **Adding personal links.** Optional roster profile links should be coach-approved and school-appropriate.
- **Forgetting to save Roster Management changes.** Editing a roster card is not complete until **Save Roster** succeeds.

## Ready For First Scrim

The team is ready for first-scrim work when:

- The team exists under the correct organization.
- Game, mode, rank, and location are correct.
- Roster names are coach-approved.
- Optional profile links are either blank or reviewed.
- The coach/admin can switch to the team on `/team`.
- The coach/admin knows where to post/find scrims, review requests, and check the calendar.

After this, use the first-scrim posting guide when it is added.
