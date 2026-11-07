# HH polish audit fixes — TEST only

7 November 2026. This change addresses the 15 findings in `HH_Family_Polish_Audit_2026-11-07.pdf`.

Target: [Hummel Home TEST](https://zethhummel-rgb.github.io/hummel-home/), repository `zethhummel-rgb/hummel-home`, Supabase project `ybizqfghnplcxlmlhvyn`. No changes were deployed to HH production.

| Finding | Implemented change | Verification |
| --- | --- | --- |
| 01 Event duration changes unexpectedly | Moving the start time or date preserves elapsed duration, including overnight and multi-day events. Midnight end dates remain correct when editing. | Date/DST unit checks and browser time/date changes |
| 02 Unfinished forms close without warning | Event, grocery, to-do, feedback and profile-name forms ask whether to keep editing or discard. Successful saves close normally. Browser unload protection is included; drafts are not permanently stored. | Close button, Escape, backdrop, Settings Done and name-edit checks |
| 03 Online indicator conceals pending changes | The small green/red connection dot remains. A compact banner reports pending sync, failures with Retry, and conflicts with Review changes. Cache errors no longer clear server-sync errors. | Offline edit, simulated failed upload, retry, shared-data verification |
| 04 Date/time inputs clip at 320px | Flexible grid sizing; narrower phones use one column. Background scrolling is locked while editing. | 320/390/768/1280px layouts and input bounds |
| 05 Meal ingredient amounts are not combined | Matching names and units are totalled across selected meals. Different units and unspecified amounts remain separate. Review shows existing quantities; exact matching totals are skipped. Other existing quantities are unchanged. | Decimal/unit/limit database tests; client response checks; browser 2 L + 2 L = 4 L; hosted retry check |
| 06 Invitation requirement appears too late | Signup explains invitation-only access before account creation, with household/new-home code choices. An invitation is required. | Signup UI and blocked empty-code request |
| 07 Confirmation email has no recovery actions | Resend with cooldown and visible errors; change-email action retains invitation and name and clears passwords. | Intercepted signup/resend calls, redirect verification, rate-limit failure |
| 08 Event form is too long | Basic details and people stay visible; repeat, reminders, countdown, location and notes live under More options. The save action remains within reach. | New/edit form journeys and compact layout screenshots |
| 09 Small touch targets | Larger grocery checkmark, edit and delete targets; taller to-do action targets. Grocery controls are 44px at 390px; edit/delete narrow to 40px on the smallest layout. | Measured browser bounds |
| 10 Active store filter is hidden | Visible store-filter chip, filtered count and one-tap clear below the compact Staples/Filters row. | Filter, close panel, inspect chip, clear |
| 11 Search sections collapse while typing | Stable page keys preserve expanded categories as the query changes. New categories still start collapsed. | Query refinement after expanding a section |
| 12 Members cannot correct their name | Edit own name in Settings. Self-only column permission and row policy; atomic legacy task/event assignment updates; stable event IDs; duplicate/reserved names and transfer state checked. | Synthetic access tests and hosted transaction under authenticated role |
| 13 Public explanations are out of date | About reflects all meal sections; privacy explains offline records and feedback; terms clarify one-way Google copying and self-service deletion. | Source review against current implementation |
| 14 Inconsistent wording | Category and Staples labels agree across the relevant controls and tutorials; event/grocery/to-do editor headings state their action. | Form journeys and copy review |
| 15 Home hierarchy competes with daily use | Smaller greeting and encouragement; Today appears before countdowns and updates; returning families see a collapsed setup checklist. Compact wrapping family names remain at the top. | Home layouts across household sizes and long names |

The small-phone household name also now truncates with an ellipsis instead of crowding the connection indicator.

## Validation coverage

- 36 browser configurations: 4 viewport widths × 3 family sizes (1, 4, 8) × 3 palettes. Includes long names, owner/member roles, empty/populated groceries and whole/decimal/unspecified amounts. Each performs 16 checks across Home, Groceries, To Do, Calendar, Notes, Meals, Search and Settings.
- Focused browser regressions cover draft dismissal, duration, filter visibility, search expansion, name editing, offline sync and recovery; separate runs cover signup and meal totals.
- Existing regression suite: 41 scripts, plus staging isolation and the new polish suite. Affected meal client/database checks were rerun after the combined-result fix. The publishing workflow runs the complete suite again.
- Hosted TEST migration `polish_profile_names_and_meal_totals` applied successfully. The hosted verification runs with the authenticated role, checks name/assignment preservation and ingredient aggregation/retry, then rolls back every fixture and profile change.
- Supabase security advisories were compared before and after: no new advisories. Existing private server-only tables have informational RLS-without-policy notices. Existing [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; this change does not alter the authentication plan/settings.

Browser journeys run the actual built TEST application with synthetic intercepted API responses. They are not real multi-device sessions or email-delivery tests. Hosted SQL separately verifies the database behavior. Physical iPhone keyboard/native-picker behavior, delivered email and device push notifications remain manual checks. TEST keeps external integrations disabled.

## Repeating the checks

Run from the repository root after installing the pinned dependencies. Build with `VITE_APP_ENV=test`. Run `npm run test:polish`, the existing test scripts, and the browser scripts below. Playwright must be available in the environment; optionally set `HH_PLAYWRIGHT_MODULE` and `HH_CHROMIUM_EXECUTABLE` to installed paths. `HH_POLISH_OUTPUT` selects the results directory (default `artifacts/polish`).

```text
node scripts/polish-browser/journeys.cjs
node scripts/polish-browser/focused.cjs
node scripts/polish-browser/signup.cjs
node scripts/polish-browser/meals.cjs
```

`scripts/verify-polish-hosted.sql` is explicitly for the fictional TEST household and rolls back its work. Do not run it against production. A future HH promotion needs both the reviewed database changes and the client changes together; it is not part of this deployment.
