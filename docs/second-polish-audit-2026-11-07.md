# Second audit of the requested TEST changes

7 November 2026. Target: Hummel Home TEST (`zethhummel-rgb/hummel-home`, database `ybizqfghnplcxlmlhvyn`). Application source reviewed: `11dda8d9dc87abd46070943b3f2af2aae5d09f23`. The published JavaScript and CSS matched the local production-style TEST build by SHA-256.

## Finding

One wording gap was found in the published About page: it still described the meal planner as dinner-only. Its description now covers breakfast, lunch, supper and snacks, and says that today's meals appear on Home. No application logic, layout or database change was required by this audit.

## Results by requested area

| Area | Result and evidence |
| --- | --- |
| Compact Home / Getting started | Compact typography measured in the browser. Checklist collapses on return both with and without existing events; expanding remains available. |
| Long household name | Ellipsis confirmed at 320px with an overflowing household name and no page-wide horizontal scrolling. |
| Event form | Main fields and family choices remain visible; optional controls expand. Save stays within the modal viewport at both ends of scrolling. A required repeat field hidden by collapsed options reopens correctly on save. |
| Duration / narrow fields | Start changes preserve duration; overnight, midnight, multi-day and DST cases checked. Narrow input bounds and background scrolling checked. |
| Unfinished changes | Event, grocery, to-do, feedback and profile-name dismissal protections checked. Event browser-unload handler verified; discarded drafts do not reappear. |
| Offline / sync | Queued additions and edits, duplicate detection, failed uploads, retry and conflict review checked. Another successful local save does not clear an existing server-sync error. |
| Filters | Active store chip, clear action and filtered list behavior checked; opening Filters does not focus a native select. |
| Search | Page grouping, collapsed new groups and retained expansion during query refinement checked. |
| Meal shopping | Compatible quantities combine, exact existing totals skip, and other existing quantities remain separate. Duplicate keep/discard choices checked. Real TEST database verification confirmed 2 kg + 2 kg = 4 kg and repeat submission skips the existing total. |
| Manual grocery duplicates | Add/keep/discard, offline queued duplicates, renaming to an existing item and adding a picked-up duplicate back checked. Editing an item does not warn about itself. Closing duplicate choices releases scroll/focus locks. |
| Signup / confirmation recovery | Invitation requirement, confirmation popup, resend cooldown/error, correct return URL, and change-email preservation/cleared passwords checked with intercepted requests. |
| Own name / household prefix | Own-name editing and draft protection checked in browser; actual TEST database confirmed task/event assignments remain attached after a name change. New-household payloads include one The prefix and reject a bare prefix. |
| Wording / public pages | Category/Staples naming, privacy explanations, one-way Google copying and deletion wording reviewed. The About meal-planning wording gap was corrected. |

## Fresh verification

- All 43 regression scripts passed again.
- The complete browser job was rerun against source identical to the deployed application: [fresh run, attempt 2](https://github.com/zethhummel-rgb/hummel-home/actions/runs/42398114610/attempts/2). It covers 36 configurations and 38 focused checks; its final job status and logs are the authoritative result.
- Twelve additional browser checks passed, covering the edge cases described above, with zero runtime exceptions.
- The actual TEST database verification ran under the authenticated role inside a transaction. All temporary fixtures and profile changes were rolled back.

Browser flows use the real compiled application with synthetic intercepted API responses, restricted networking and its same-origin offline service worker. They do not establish actual email delivery, physical iPhone native-keyboard/picker behavior, push delivery, or simultaneous real-device editing. Those remain hands-on checks. No real messages were sent, and live HH was not changed.
