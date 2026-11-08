# HH flow and older-user usability audit

November 8, 2026. Baseline: live HH dcf9ffe8ca235df2b61a290e2b2c79668f10cf88, with the same input-card source on TEST.

[Browser evidence and downloadable artifacts](https://github.com/zethhummel-rgb/hummel-home/actions/runs/42534864471)

## Verdict

The sampled core tasks work. HH still has usability problems that can make it harder for an older or less confident person to find a feature, read instructions, recover from mistakes, or understand the next step. Draft protection, enlarged-text layouts and invitation recovery should come first.

This is an audit, not a product release. No real household records, invitation emails or product screens were changed.

## Method and limits

- 108 functional journeys passed: 36 configurations in Chromium, Firefox and WebKit.
- Widths: 320, 390, 768 and 1280 CSS pixels. Families: 1, 4 and 8 profiles. Themes: blush, sage and coastal. Included owner/member accounts, empty/populated homes, long names and decimal quantities.
- Each engine recorded 541 screen-state observations. These are repeated task states, not 541 distinct features.
- Captured 72 simulated 200% text-enlargement samples: eight states at 320, 390 and 768 pixels in each engine.
- All engines found horizontal Home overflow in the 320 and 390 pixel enlarged-text samples. Screenshots also show crowded navigation and event fields.
- The selected text/background screening found zero contrast candidates and zero unnamed visible buttons. It excludes uncertain/image/opacity backgrounds, disabled text, placeholders, pseudo-elements and unvisited states. This does not establish WCAG conformance.
- All browser API requests used synthetic fixtures. Real email delivery, receipt of notifications, physical iPhone keyboard/VoiceOver, native device text settings and testing with older participants were outside this run.
- Code-review findings below are identified separately. Existing regression journeys do not cover every possible error or draft-loss path.

## Priority findings

### 1. High: protect drafts consistently

Staple edits can be cancelled or left without a dirty-change warning. Household name and family-profile drafts are not consistently connected to the Settings leave guard, which currently tracks own-profile and feedback drafts.

Evidence: source review of GroceryStaples.closeEditor, HouseholdProfiles onDraftChange, FamilySettings props and SettingsDialog guard.

Fix: share dirty/busy/leave protection across staple, household-name, family-profile and invitation inputs. Warn before abandoning changes; keep busy operations open.

### 2. High: fix enlarged-text reflow

At simulated 200% text on narrow Home screens, the encouragement line runs off-screen and bottom navigation labels run together. In the event editor, Starts/Ends and date/time controls crowd or truncate each other. A card can fit the page while its internal controls remain hard to read.

Evidence: senior-j1-home-text200.png, senior-j10-home-text200.png and senior-j10-event-form-text200.png in the browser artifacts. Two page-overflow samples per engine.

Fix: wrap Home text, let navigation labels/rows grow and stack event dates/times when text is enlarged. Preserve the compact normal-size layout. Follow with real browser zoom and device text-setting tests.

### 3. High: make invitation errors recoverable

Pending invitations have a trash icon, with no visible correction or resend action. Cancellation deletes immediately without confirmation. Retry email is offered only when the initial send was unsuccessful. The send control is a type=button action; the email input's native validation is not its submission gate. A well-formed misspelled domain can also pass ordinary email-format validation.

Evidence: source review of FamilySettings and InvitationDelivery.

Fix: show the complete recipient before sending; suggest common domain corrections without silently changing addresses; offer Correct address, Resend invitation and Cancel invitation. Confirm cancellation. Reissuing must retain ownership, expiry and rate-limit rules. Explain that a send handoff does not prove inbox delivery.

### 4. Medium: unify closing and saving

Swipe-close offers Save / Discard / Keep editing; X/Cancel uses a different discard prompt. Grocery, to-do and event saves close. Normal meal/note saves show a read view, while swipe-save closes.

Evidence: source review of InputCardHandle, useUnsavedChanges, MealDialogs and FamilyNotes, plus the existing successful browser tests for those separate paths.

Fix: one draft decision for every exit route. Make the intended post-save result clear through consistent behaviour or explicit Save / Save and close wording. Failed saves must preserve the draft.

### 5. Medium: improve essential text size

Form labels are commonly 13px, helper/status text 11–12px, and Home family names 10px. Good contrast alone does not make small text comfortable.

Evidence: computed browser measurements in journeys.json; quick-forms.css.

Fix: move important labels/help toward 14–16px, or add a saved larger-text preference with working reflow. Keep decorative details compact. There is no claim that WCAG requires a universal 16px font size.

### 6. Medium: make Settings, Help and actions discoverable

On phones, Settings is represented by initials, and Help is inside Settings. Several other actions rely on recognising pencil, trash and search icons. Accessible names help assistive technology but do not provide visible instructions.

Evidence: Household topbar, MoreMenu and SettingsDialog source.

Fix: add visible Settings and Help entries to More, keeping the avatar shortcut. Use visible Edit / Remove labels where practical, particularly grocery/staple controls.

### 7. Medium: enlarge frequent touch targets

Examples measured include a 34x34 Settings avatar, 28x28 calendar search/refresh controls and 34x34 Home add shortcuts. Main input-card Save controls already meet a 44px height goal.

Fix: enlarge the actual hit area while preserving small icon artwork. Aim for 44x44 on frequent controls and check spacing. Label-wrapped switches have a larger clickable label and should not be failed based only on the switch box. Sub-44px does not automatically mean a WCAG AA violation.

### 8. Medium: explain inactive controls

Save can be disabled without a nearby explanation. Unit is disabled before Quantity. Feedback needs both an area and a comment.

Evidence: QuantityFields, Feedback and editor source.

Fix: short instructions beside the control, such as Enter an item name to continue, Enter a quantity to add a unit, or Choose an area and write a comment. Associate instructions with the field.

### 9. Medium: show the active calendar filter visibly

The selected person's name is available through an accessible description/title; the visible filter button primarily uses an active dot. A user could think events disappeared.

Evidence: CalendarFilter source. Grocery filters already show the active store with a clear action.

Fix: a compact Showing: [person] summary and clear control, keeping the small Filter button and three calendar view buttons.

### 10. Medium: keep notifications from covering editors

A recent save toast can appear above an input card. Enlarged event screenshots show Added to your list across repeat fields.

Evidence: senior-j10-event-form-text200.png in Chromium and WebKit.

Fix: queue, reposition or hide background-page toasts while an editor is open. Active editor status should not obscure fields or Save.

### 11. Lower: simplify meal terminology and outcomes

Saved meals, favourites, planning a copy, moving and copying are distinct concepts. Existing tests correctly show that editing a plan leaves its saved recipe unchanged.

Fix: use one name for the saved-meal library and clear actions such as Plan this meal, Move to another day and Save to saved meals. Put a brief outcome beside the relevant action.

### 12. Lower: show/hide passwords

The sign-in and account forms do not have a visible show-password control.

Evidence: main.tsx source review.

Fix: add an accessible Show / Hide password button while retaining autocomplete and keyboard behaviour.

## What is already working

| Area | Evidence |
| --- | --- |
| Groceries | Add/edit and reload journeys pass. Focused checks cover offline changes, duplicates and sync-error retention. Active store filtering is visible. |
| To-dos | Assigned tasks, repeat intervals and notification values pass in relevant configurations. The visible Edit label is useful. |
| Calendar | Focused checks pass for the three views, remembered view, upcoming Agenda window, date boundaries, quarter-hour choices and editing. Larger-text layout remains outstanding. |
| Input cards | Centering, internal scrolling, page lock, swipe dismissal, invalid saves and failed-save retention pass. |
| Notes | Creating, reading, editing and draft retention pass for the main note editor. |
| Meals | Structured ingredients, saved-meal/planned-copy separation, duplicate decisions and quantity aggregation are covered. |
| Search | Cross-section results and collapsed categories work. Keep the user-requested grouping. |
| Account creation | Existing checks cover invitation requirements, separate email confirmation, resend cooldown/errors and changing email. They do not verify real inbox delivery. |
| Account/home deletion | Clear warnings and typed confirmation exist. Invitation cancellation lacks equivalent confirmation. |

## Recommended order

1. Draft protection, enlarged-text layouts and toast placement.
2. Invitation review, correction, resend and cancellation.
3. Consistent close/save choices, visible Settings/Help and comfortable hit areas.
4. Essential text, inactive-control explanations, filter summary and meal wording.
5. Repeat tests on a real iPhone and with a small group of older users.

For participant testing, observe sign-in from an invitation, grocery entry/correction, a repeating to-do, finding a person's event, planning a saved meal and recovering an invitation typo. Do not provide directions during the tasks. Record where help is needed before claiming HH is easy for older users.

## Reference points

W3C older-user guidance emphasizes perceivable information and understandable interactions. Text-resize guidance calls for usable content and functionality at 200% enlargement. Target Size (Minimum) uses 24x24 CSS pixels with exceptions; the stronger target-size criterion uses 44x44. This audit uses 44x44 as a comfort goal, not a blanket AA pass/fail rule.

- https://www.w3.org/WAI/older-users/developing/
- https://www.w3.org/WAI/WCAG22/Understanding/resize-text
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum
