# Requested polish follow-up — Hummel Home TEST

7 November 2026. This is the user's explicitly approved subset of the polish audit, plus duplicate-grocery choices, a signup confirmation popup, and the household-name prefix.

Target: `zethhummel-rgb/hummel-home`, Supabase `ybizqfghnplcxlmlhvyn`. HH production is outside this change. No database migration or real email delivery is required by this follow-up.

| Requested area | Result |
| --- | --- |
| Home | Smaller greeting and encouragement. Getting started collapses for households with events and on subsequent visits; users can expand it. Countdown/activity positions and square reminder checkboxes remain as corrected. |
| Top header | Existing ellipsis behavior retained for long household names. |
| Event editor | Main details and family choices stay visible. Repeat, notifications, countdown, location and notes are under More options. Save stays sticky. Invalid fields inside collapsed options reopen them. |
| Event duration and small screens | Existing elapsed-duration preservation, overnight/midnight handling, narrow stacked fields and background scroll lock retained. |
| Unfinished changes | Existing keep-editing/discard prompts and browser unload protection retained for event, grocery, to-do, feedback and own-name forms. Drafts are not persisted. |
| Offline/sync status | Existing dot, pending/error/conflict messages, Retry sync and Review changes retained. An uncertain insert is held for review rather than silently recreated. |
| Grocery filters | Existing active-store chip, filtered count and clear action retained. |
| Portal search | Existing expansion state survives query refinement; new groups start collapsed. |
| Meal ingredients | Compatible selected amounts combine; different units and unspecified amounts remain separate. Exact existing totals still skip. Other same-name existing groceries prompt before adding a separate amount; users can keep both, discard the duplicate additions from their selection, or review. Existing quantities are never overwritten. |
| Manual grocery duplicates | Add, rename and add-back check active groceries by case/space-normalized name, including queued offline additions. Keep both/Save anyway proceeds; discard leaves the original untouched; Back to editing/Escape keeps the draft. A normal edit to the same item does not warn about itself. |
| Account creation | Invitation-first signup retained. Successful signup requiring confirmation now opens Check your email again, identifies the address and explains that this is a separate confirmation email. |
| Email recovery | Existing resend cooldown, visible errors and different-email recovery retained. Invitation/name remain, passwords clear. |
| Own name / household name | Existing self-only name editing and assignment preservation retained. New-household naming displays The before the input and normalizes the saved name to one prefix; empty/bare prefixes are rejected. Existing households are not renamed. |
| Wording / public pages | Existing Category/Staples naming and updated About, Privacy and Terms explanations retained. |

## Validation

The production-style TEST build and all 43 regression scripts passed locally. Focused browser checks cover the new choices, signup recovery, household-name creation payloads, returning-family state, draft protection, duration, responsive fields, square checkboxes, search/filter state, offline adds/edits, failed sync and conflict review. All API calls use synthetic intercepted responses; no confirmation or feedback emails are sent.

The full matrix covers 36 combinations: 320/390/768/1280px, 1/4/8 family members, and blush/sage/coastal palettes, with 16 checks per combination. The local broad run was interrupted by automatic approval review over an unrelated external Visual Studio telemetry request. The matrix is therefore run by `.github/workflows/polish-browser.yml` on an isolated GitHub runner before merging. Its uploaded results are the authoritative complete browser record for this follow-up.

Browser fixtures deny external requests, mock Supabase responses, block WebSocket connections and apply a restrictive test-server CSP. The actual same-origin service worker remains enabled for offline-storage checks. Real iPhone keyboards/native pickers, actual multi-device sessions, delivered email and push delivery are outside these synthetic checks.

The existing TEST migration `polish_profile_names_and_meal_totals` was verified present. The earlier audit's database checks and migration history remain in `polish-audit-validation.md`.
