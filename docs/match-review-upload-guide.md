# Matchmake Match Review Upload Guide

Status: MOSEF / high-school pilot guide
Audience: coaches, esports leads, and school administrators saving match results
Prerequisite: at least one team exists and the match or scrim has been played

This guide covers saving a match review from a post-game screenshot or manual result record. Use `docs/first-scrim-posting-guide.md` first if the school has not posted or completed its first scrim yet.

## Before You Upload

Have these details ready before opening the review form:

- The correct Matchmake team.
- The opponent name.
- The game number if the scrim or match used a series.
- The match date and approximate played time.
- A clear post-game scoreboard screenshot or a trusted result record.
- Any map, mode, duration, score, or stat details that may not be visible in the screenshot.

Use a screenshot that shows the scoreboard clearly. Crop out unrelated windows, browser tabs, direct messages, private chat, student contact information, and anything that is not needed to record the match result.

## Open The Review Form

1. Sign in with the coach/admin account.
2. Open **Teams**.
3. Select the team that played the match.
4. In **Team Stats**, select **Add Match Review**.
5. Confirm the browser opens the team dashboard at a URL shaped like `/team/team-id/dashboard?new=true`.

If the match came from a scheduled scrim flow, use the team dashboard or the scrim workflow that links to the review. The saved review should still be checked against the correct team, opponent, game, and date before the screenshot source is discarded.

## Upload A Screenshot

1. In **Upload Post-Game Screenshot**, select **Upload Image**.
2. Choose the cleanest scoreboard screenshot available.
3. Wait while Matchmake prepares and extracts visible scoreboard stats.
4. If the upload takes a long time, wait for the status message before trying again. Large or reference-heavy screenshots can take longer.
5. If extraction fails, retry with a tighter crop of the scoreboard or enter the stats manually.

The extractor is a helper, not the official record. Coaches should treat extracted fields as draft data until they have reviewed the form.

## Review And Edit Extracted Data

After extraction, Matchmake fills the review form and shows a message that the stats were extracted into the current game review. Before saving:

- Open **Review & Edit Extracted Data**.
- Select **Show editable fields** if the fields are collapsed.
- Confirm **Review Type** and **Result**.
- Confirm the score or kills fields.
- Confirm the map, mode, objective, or duration fields when they appear.
- Confirm the **Opponent** name.
- Confirm **Played At**.
- Review **Our Rows** and **Opponent Rows**.
- Correct player names, characters, agents, heroes, roles, and visible stats.
- Use **Swap Teams** if the extractor placed the school roster on the opponent side.
- Remove coach notes or source notes that should not be stored in the review.

Pay special attention to any row that displays `Needs review`, **Review hero**, low confidence, missing values, or obvious team-grouping problems. Do not save a review while those fields are still misleading.

## Save The Review

1. After checking the fields, select **Save Game 1 Review** or the matching save button for the current game.
2. Wait for the saved-review confirmation.
3. If the match has multiple games, add or select the next game in the series and repeat the upload or manual-entry process.
4. For an existing saved review, use the update button only after confirming the changes are intentional.

Matchmake clears the screenshot preview after a successful save. Keep the source screenshot or result record outside Matchmake until the saved review has been verified.

## Verify The Saved Review

After saving:

- Confirm the review remains on the correct team dashboard.
- Confirm the saved game number is correct.
- Confirm the opponent, result, score, map/mode, played date, and player rows are correct.
- Return to **Teams** and check that **Team Stats** includes the saved review.
- Open the team's deeper stats view when available and confirm the review contributes to the expected trends.
- If the review was tied to a scrim, confirm it lines up with the intended scrim and opponent.

Do not use match review notes for student discipline, medical information, private contact details, or emergency reporting. Use the school's reporting process and `docs/inappropriate-behavior-reporting-escalation.md` for safety or conduct concerns.

## When Upload Or Extraction Fails

Use this order:

1. Retry once with a clearer or more tightly cropped scoreboard screenshot.
2. If the app says the screenshot is too large, crop or resize the screenshot and try again.
3. If extraction is overloaded, timed out, or messy, enter the fields manually from the source record.
4. If the review will affect standings, eligibility, or a school decision, verify it against the original screenshot or official match record before relying on it.
5. Record the issue through `docs/mosef-support-contact-process.md` if the same failure repeats.

Do not upload unrelated screenshots just to test the extractor during a live school workflow. Test data should stay separate from real team history.

## Common Upload Mistakes

- **Wrong team.** Start from the team that played the match, not another team in the organization.
- **Wrong game in a series.** Check the selected game number before saving.
- **Screenshot includes private information.** Crop to the scoreboard before upload.
- **Extractor grouped teams backward.** Use **Swap Teams** and re-check the result.
- **Unreviewed character or hero fields.** Confirm visible characters, agents, heroes, champions, or roles before saving.
- **Saving draft extraction as official data.** Review every important field before selecting the save button.
- **Discarding the source too early.** Keep the source screenshot until Team Stats and the dashboard show the expected saved review.

## Ready For Saved History

The match review is ready when:

- The review is saved under the correct team.
- The opponent, date, result, score, game number, and map/mode are accurate.
- The player rows and opponent rows match the visible source or trusted manual record.
- Any `Needs review` or low-confidence fields have been corrected or intentionally left blank.
- Team Stats reflects the saved match.
- The coach/admin knows where the source screenshot or official result record is stored if the review needs to be checked later.
