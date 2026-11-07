# Full TEST audit: three browser engines

7 November 2026. Target: Hummel Home TEST, repository `zethhummel-rgb/hummel-home`, Supabase project `ybizqfghnplcxlmlhvyn`. Live HH is outside this change.

## Findings and corrections

1. Event family-selection labels inherited a vertical layout. The checkbox, colour marker and name now share a horizontal row, with a minimum 44px row height. Long names may wrap inside their row.
2. Long household names could spill out of the desktop/tablet sidebar. They now truncate within the available space; the logo keeps its size.
3. The desktop/tablet sidebar covered part of the yellow TEST banner. The banner now occupies the space beside the sidebar, and remains full-width on phones.

These are CSS corrections. The Home section order, countdown placement, compact family strip, square reminder checkboxes, forms, data and database schema are unchanged.

## Verification scope

- Chromium, Firefox and WebKit: 36 configurations per engine, combining 320/390/768/1280px widths, 1/4/8 people and three colour themes. Journeys include long names, owner/member roles, empty/populated data, whole/decimal/unspecified quantities, recurring/all-day/timed events, family notes, saved meals, search and Settings.
- Each journey has 18 assertions, including the two new navigation/banner checks. Each engine also runs 51 focused checks covering draft protection, event duration, narrow fields, sticky Save, duplicate groceries, offline queues, sync failures/conflicts, signup confirmation/recovery, household naming and meal totals.
- Screenshots are retained with the CI artifacts. Visual review identified the three layout corrections above.
- The 43 existing regression scripts were rerun. Hosted TEST verification separately checked name changes preserving task/event assignments, combined ingredient quantities and retry deduplication under the authenticated database role. Every temporary fixture/profile change was rolled back.
- The public-page reference check found all 36 relative page/asset references present. Published application assets were compared by SHA-256 with the tested build.

## Browser test isolation

The first WebKit run exposed a harness limitation: requests after service-worker takeover bypassed Playwright routing and the synthetic token was rejected. No successful database write occurred through that invalid token. Synthetic API responses now come from the loopback test server, with fetch destinations redirected only in the harness and a same-origin connection policy. The real compiled app and its real offline service worker remain in use. Application authentication and server access rules were not weakened.

The initial Chromium and Firefox runs passed. The final rerun with the fixes and corrected harness is the authoritative result; see the recorded workflow below.

## Limits

Browser API responses are synthetic. Hosted SQL checks are separate from browser journeys. This does not verify actual invitation/confirmation/feedback email delivery, device push delivery, physical iPhone keyboards/native pickers, or simultaneous edits on two real devices. Those remain hands-on checks. WebKit automation is not a substitute for testing the installed iPhone app.

The build still reports a large main JavaScript chunk (about 840 kB minified / 231 kB gzip). This is a performance follow-up, not a measured loading failure. No bundle restructuring was included in this polish pass.

A local rerun was stopped by automatic approval review because unexpected Visual Studio telemetry was detected. Verification continued through isolated GitHub Actions; the blocked local rerun is not counted as passed.

## Final run

- [Final browser run](https://github.com/zethhummel-rgb/hummel-home/actions/runs/42405010796): Chromium, Firefox and WebKit all passed. Each completed 36 journeys with 648 assertions plus 51 focused checks: 108 journeys, 153 focused checks and 2,097 recorded checks overall. No runtime exceptions were recorded in the tested flows. Page-overflow and event-field bounds checks passed.
- Tested source: `55af0392ea637d6f585bbc63f78d6b96decf89af`. Merged application: `46ca5b327a98454edb1115bfeb2f7cbef40cb27e`, with the same tree.
- [TEST publishing run](https://github.com/zethhummel-rgb/hummel-home/actions/runs/42405477918): all 43 regression scripts, build and deployment passed.
- Final Chromium and WebKit screenshots were inspected, including the corrected family-selection rows and desktop/tablet sidebar/banner.
- Live HH remained at `001bce1721916bc98783350f1f918c4c68da97da`.
- Published TEST verification completed at 19:19 UTC: JavaScript, CSS and About HTML matched the tested build by SHA-256. JavaScript: `c8b14045eaa95699b786f61496ed2666fd3a90924e5eb3071b757ce4d649e34b`; CSS: `a97ba3fc804c1f1a13b4fce62a1b0415d74328f780e85f38df77fa63983a8582`.
