# Optional Profile Link Safety Guidance

Status: MOSEF / high-school pilot guidance for school, coach, and Matchmake review. This is an operational safety document, not legal advice.

## Current Product Scope

Matchmake currently supports an optional `profile_url` for each roster entry in `public.teams.roster_profiles`. The schema also contains `public.users.external_profile_urls`, but the current app does not provide a user-facing editor or renderer for that field.

Production access verification on June 24, 2026 confirmed that:

- Anonymous users cannot select either `teams.roster_profiles` or `users.external_profile_urls`.
- Authenticated team reads are limited by row-level security to teams in the user's organization.
- A rollback role simulation returned one same-organization team, zero cross-organization teams, and zero cross-organization roster profile values.
- Roster profile links are not selected or displayed by the public Scrim Board.

These controls limit current exposure, but they do not make every linked destination appropriate for students.

## Allowed Links

Optional roster links should:

- Be approved by the student's coach or school before entry.
- Use HTTPS.
- Point to a relevant game account, ranking service, league, tournament, or school-approved esports profile.
- Show only information the student and school are authorized to share.
- Use an account the student is authorized to represent.

Examples include an official publisher profile, a school-approved competitive ranking page, or a tournament roster page used to verify eligibility or rank.

## Links That Should Not Be Added

Do not add links that:

- Lead to personal social media, personal contact pages, private messaging accounts, invite links, or unrelated personal sites.
- Expose a student's email, phone number, home address, precise location, schedule, school ID, private account activity, or other sensitive information.
- Contain offensive, sexual, violent, discriminatory, harassing, threatening, or otherwise school-inappropriate content.
- Promote gambling, cheating, account selling, unsafe downloads, credential collection, malware, or impersonation.
- Include embedded usernames or passwords in the URL.
- Require bypassing a privacy warning, age gate, login control, or other access restriction.
- Belong to another person or misrepresent identity, rank, team membership, or eligibility.

Students should not be required to create a new public account solely to provide a profile link unless the school has reviewed and approved that requirement.

## Product Safeguards

The roster editor:

- Treats profile links as optional.
- Accepts complete HTTPS URLs only.
- Rejects URLs longer than 500 characters or URLs containing embedded sign-in information.
- Opens valid links in a new tab with `noopener noreferrer` protections.
- Does not render an existing invalid or non-HTTPS value as a clickable link.
- Explains the school-approved purpose and prohibited personal-link categories next to the input.

URL validation does not inspect destination content, verify account ownership, detect later changes to a page, or establish that a link is school-approved. Matchmake does not currently maintain a domain allowlist or automated link-reputation scanner.

## Coach And School Review

Before saving or periodically reviewing roster links, the coach or school administrator should confirm:

1. The student is authorized to share and represent the linked account.
2. The destination is relevant to the team's game, rank, league, tournament, or school esports activity.
3. The page does not reveal prohibited personal or sensitive information.
4. The linked content meets school conduct, directory-information, age, and privacy expectations.
5. The link still resolves to the expected destination and has not changed ownership or content.

Schools may prohibit all optional profile links for the pilot. Leaving the field empty does not block roster participation or other Matchmake features.

## Removal And Escalation

Remove a link promptly if it is no longer needed, becomes inaccurate, changes ownership, exposes personal information, or violates school or Matchmake rules. Preserve only the minimum evidence needed for an investigation; do not redistribute sensitive linked content.

Use `docs/inappropriate-behavior-reporting-escalation.md` for unsafe-content reports and `docs/admin-removal-guidance.md` for removal and incident-record steps. School safety or emergency concerns should follow the school's established emergency process.

## Related Documents

- `docs/acceptable-use-policy-draft.md`
- `docs/school-facing-privacy-policy-draft.md`
- `docs/school-district-data-privacy-agreement-template.md`
- `docs/inappropriate-behavior-reporting-escalation.md`
- `docs/admin-removal-guidance.md`
