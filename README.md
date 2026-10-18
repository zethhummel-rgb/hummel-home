# Hummel Home

Independent family website. React + Vite frontend on GitHub Pages, with a dedicated Supabase project for email/password authentication and household data.

## Current setup

- Supabase organization: Hummel Home (`gxqjolzkbcrdbatkbigc`).
- Dedicated project: `ybizqfghnplcxlmlhvyn`.
- Schema applied as migration `20261018010629_household_accounts`.
- No shared database, authentication users, server keys, or integration with JGC.
- `src/config.ts` contains only the browser-safe publishable project key. Never put a service-role key in this repository.
- The earlier ChatGPT-hosted concept is a separate deployment. These files do not change it.

## Publish

1. Repository: https://github.com/zethhummel-rgb/hummel-home (`main`, public source).
2. GitHub Pages deployment is included in `.github/workflows/pages.yml`; pushing to `main` builds and deploys once Pages is enabled.
3. In repository Settings > Pages, select **GitHub Actions** as the source. Hosting private repositories depends on your GitHub plan; the static application source may be public without exposing household records. Household records require account authentication and database membership policies.
4. Set Supabase Authentication > URL Configuration > Site URL to the final deployed URL, including `/hummel-home/` if hosted as a GitHub project site. Add that exact URL to Redirect URLs for confirmation and password recovery. Do not use a wildcard unless necessary.
5. Configure Supabase custom SMTP for reliable signup and password-reset emails to family members. Supabase's default mail service may restrict recipients and rate-limit delivery; this has not been configured or verified.
6. Confirm Email should remain enabled. Use strong project password settings (the app requires at least 12 characters for new/reset passwords).
7. Verify signup, email confirmation, recovery, and invitation acceptance using real email inboxes before relying on the site.

Newer pushes supersede older queued deployments in the `pages` concurrency group, so an obsolete run cannot hold up the latest site version.

## Family accounts

- First user signs up, confirms their email, signs in, and creates the household.
- Owner opens the avatar > Your household, enters an invitee's email and generates a link.
- Share the invitation link yourself. The app sends no invitation email.
- Invitee signs up using that exact email, confirms it, then joins through the link.
- Invitations expire after 7 days, work once, and can be revoked before use.
- Members share groceries and tasks; only the owner manages calendar settings and invitations.
- Holt can be represented before having an account, with orange as his default calendar colour. An account can be invited later; existing Holt tags resolve to that account.
- Avatar → Your calendar colour lets each account choose a palette or custom colour. Only that account can update its colour; current household members can read it. Colour choices refresh across devices with household data.
- Events can tag multiple people. Tagged people appear as coloured dots in home events, agenda cards, details, and search results. Everyone resolves to the current family, including Holt. Person filters on Home and Calendar include Everyone events for each person. Event tags are display metadata and never grant account or calendar access.

## Calendar

A native month view and agenda now live inside Hummel Home. Household members can create, edit, and delete shared events without leaving the site. Includes all-day and multi-day events, Eastern time, locations, notes, family assignments, upcoming home-screen events, and optimistic edit conflict detection.

### Current Google status

The household owner configured Google OAuth and confirmed a successful connection. The dedicated family calendar contains the imported hockey schedule; native household events remain preserved. Only this family calendar is used, not the Google account’s other calendars.

### One-time Google setup

1. Create a separate **Hummel Home** Google Cloud project. Enable **Google Calendar API**.
2. Configure an OAuth consent application and the scope `https://www.googleapis.com/auth/calendar.app.created`. This creates an app-owned secondary calendar; it does not read the account’s other calendars.
3. Create a **Web application** OAuth client with this exact authorized redirect URI:
   `https://ybizqfghnplcxlmlhvyn.supabase.co/functions/v1/google-calendar/callback`
4. Store the client credentials in this Supabase project’s Edge Function Secrets as `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET`. Never paste the secret into chat, source, GitHub, or browser code.
5. If the Google application is in Testing, add the owner’s Google account as a test user. Calendar refresh tokens in Testing can expire after seven days; production consent configuration is required for ongoing use and Google may impose verification requirements.
6. In Hummel Home, the household owner chooses **Calendar → Connect Google Calendar** and approves the connection. This explicit action creates a dedicated family calendar in Google, imports existing native events, and authorizes household members to manage that one calendar through the website.
7. Verify connect/return, event create/edit/delete, refresh, token renewal, and revoked-permission behavior with the actual Google account before relying on synchronization.

Refresh tokens are encrypted in Supabase Vault. OAuth state is hashed, short-lived, and single-use, with PKCE. The server checks current household membership for every API action and only targets the server-selected family calendar. Calendar creation/import occurs only after the owner explicitly connects; event mutations occur only from event-editor submissions. Connected calendars support repeat series with day, week, month, or year intervals, optional last dates, and occurrence counts. Birthday-style events use all-day yearly repeats. Monthly dates that do not exist in a month and February 29 in non-leap years are skipped by Google. Editing defaults to one occurrence; choosing the whole series loads the original event and its etag before changing the series. Deleting the whole series requires a separate confirmation. Custom Google recurrence rules are preserved when repeat settings are unchanged. Repeat creation requires Google; native one-off events still work independently.

Once connected, Google is the event source for the household. Native event records remain preserved after import; native writes freeze while importing to avoid concurrent changes being missed. Reconnection skips previously imported events to avoid recreating deleted events. Native events can be used immediately while Google is not configured. A connected Google calendar is never silently replaced with native storage on errors.

The backend uses `verify_jwt=false` because Google’s OAuth callback has no Supabase JWT. Authenticated POST operations explicitly validate the caller with `auth.getUser`, require current household membership, and validate Origin. The callback accepts only a valid single-use OAuth state and confirms the current owner. Anonymous POST operations are denied. No provider credentials are returned to browsers.

The calendar search icon searches names, descriptions, and locations across all dates, upcoming events, or past events. Google expands repeat instances and returns 50 results per page in ascending date order; Show more results follows the provider page token. There is no artificial month or year cutoff. Search results open read-only details before editing. Native calendar search remains household-scoped and escapes filter text.

## Development

Node 22.13+ required.

```
npm ci --ignore-scripts
npm run dev
npm run test:calendar
npm run build
```

The app does not store groceries or tasks in localStorage. Supabase persists records; the auth library manages local session storage. The app refreshes household records on focus and every 30 seconds while visible. No offline write queue is included.

## Verification completed

- TypeScript and production build passed.
- Member-colour SQL checks passed in a rolled-back synthetic transaction: own-colour updates, family reads, denial of changes to other members, role/name update denial, invalid CSS rejection, multi-person tags, and outsider/anonymous isolation.
- People checks cover chosen colours, the orange Holt default, multi-person and Everyone filters, legacy names, and continuity when Holt creates an account.
- Browser checked: login and account creation screens render and navigation works. No real credentials were entered.
- Supabase security advisor returned zero findings after schema installation.
- `database/security-check.sql` passed using synthetic users and records in a rolled-back transaction: owner/member data access, outsider isolation, email-bound invitations, invitation consumption, owner-only settings/invitations, and anonymous denial.
- Native calendar editor browser checks passed using synthetic preview events: add, edit, delete, and all-day form behavior.
- Calendar SQL checks passed in a rolled-back transaction: native event CRUD, stale-write protection, outsider/anonymous isolation, provider-secret isolation, one-use OAuth state, encrypted Vault round trip, and native-write freeze during Google import.
- Hosted calendar endpoint rejects unauthenticated and cross-origin requests.
- Eastern-time conversion, DST gap rejection, 25-hour all-day events, date rollover, and request-ID checks passed.
- The owner confirmed Google connection and calendar use. New recurrence/search behavior passed synthetic mobile UI checks and mocked API contract checks; authenticated end-to-end tests under a family member’s session have not been performed.
- Repeat tests cover custom intervals, yearly birthdays, finite endings, Eastern DST cutoffs, one-occurrence versus series targets, etag conflicts, metadata preservation, and current-household authorization. Search tests cover past/future/all-date parameters, query encoding, pagination, and authorization.
- Supabase Site URL and allowed redirect URL were saved to the live GitHub Pages address. Live user signup/email flows still need user validation.

## Database changes

`supabase/migrations/20261018112908_member_colours_and_event_people.sql` adds account colours and native event person IDs without changing existing records.

`supabase/migrations/20261018010629_household_accounts.sql` records the exact applied migration. Do not rerun it on the existing project. For a fresh separate project, apply the schema once through the Supabase migration tools. No auth users or household records are seeded.

## Push event reminders

Avatar → Notifications enables the current device and offers a rate-limited test notification. iPhone and iPad users first add Hummel Home to their Home Screen and open that app. Permission is requested only from the Enable notifications tap. Other supported browsers work over HTTPS. Each account enables each device separately; signing out unsubscribes that browser.

New events default to 15 minutes before. Existing events have no push reminder until edited. The shared reminder can be disabled, set at the start, or set up to one week before. All-day reminders count back from 9 AM America/Toronto on the first day. The setting is persisted in native `reminder_minutes` or the Google shared property `hummel_reminder`. Repeat instances inherit their series setting and can override one occurrence. Google personal popup/email reminders are separate and are not changed.

`event-reminders` is a separate Edge Function. A single Supabase Cron job invokes it every minute through pg_net, using a credential created and stored inside Vault. VAPID keys are generated on the server once and retained in Vault; only the public key reaches browsers. No new deployment secrets need manual entry. Deploy the Google function with `reminders.ts`, and the reminder function with `logic.ts` and its pinned `deno.json`. The exact applied schema is `supabase/migrations/20261018114750_event_push_reminders.sql`.

Each run reads current Google repeat instances (or native events when there is no Google connection), current household members, and opted-in devices. Tagged accounts receive reminders; Everyone includes all current opted-in accounts. Until Holt has an account, a Holt tag sends to the opted-in household; once his account exists the tag resolves to him. Unknown tags do not grant access. Removed members and a device switched to another account are excluded at dispatch. Subscriptions and delivery records are private; only the service-role handler can call the storage RPC. User endpoints validate the session, origin, current membership, subscription keys, and an HTTPS push-service allowlist.

Delivery uses encrypted Web Push with VAPID, a five-minute TTL, and a five-minute catch-up window. Successful deliveries are deduplicated per device, event instance, start, and reminder offset. Transient failures retry with leases up to three attempts, and HTTP 404/410 removes expired subscriptions. The worker has a global lease and bounded runtime. Device/network settings and platform delivery can delay a notification; this is not an alarm service. The push-only service worker never caches HTML or assets, so the full refresh button continues to fetch the latest site. Notification taps open the event date and read-only details.

Verification: reminder timing/DST, recipients, Google metadata, native and Google dispatch, duplicate/retry guards, expired devices, cancelled events, removed members, endpoint validation, authentication and notification click behavior pass automated checks. The SQL security checks in `database/push-reminders-security-check.sql` passed with synthetic rows rolled back. The deployed scheduler returned HTTP 200 and initialized its Vault-backed keys; no actual family device has been opted in or received a test during development. Verify receipt with Send a test, then create a near-term reminder and close the app. Monitor `private.push_settings.last_run_at/last_result` and Cron job runs without reading or logging Vault secrets or subscription endpoints.

## Household Reminders

Lists is now Reminders. Existing tasks stay in place and remain silent unless a notification time is set. Tap a reminder title or its labelled Edit button to change it. Repeat and notification controls also work for undated existing items; enabling either fills today as a starting date that can be changed before saving. Add/edit a reminder with an optional due date, Eastern notification time, responsible person, and custom day/week/month/year interval. Notifications use the existing per-device opt-in and continue without a working Google connection. A notification opens Reminders and highlights the item.

Repeating reminders keep one active occurrence. Completing it atomically advances to the next scheduled future date; a pending occurrence stays overdue until completed. The original schedule anchor preserves month-end dates and leap years, clamping to the last valid day in shorter months. Late completions skip missed dates. Changing the due date or repeat rule resets the anchor. Concurrent/stale saves and completion attempts are guarded by `reminder_version`. One-time reminders complete normally.

Schema: `supabase/migrations/20261018120551_recurring_household_reminders.sql`. Notification timestamps are generated by Postgres from the due date and time in America/Toronto. Existing household RLS applies. The UI cannot directly write the generated timestamp, original anchor, completion timestamp, or version. The SQL checks in `database/recurring-reminders-security-check.sql` verify scheduling, DST, month/leap anchors, stale completions, constraints, existing grocery behavior, and outside/anonymous isolation using rolled-back synthetic records. Automated push checks cover task reminders independently of Google and exclude completed items. Real phone receipt still requires the user's device opt-in/test.

Event editors now start new timed events at 09:00–09:30. Changing the start time resets the end to 30 minutes later and advances the end date across midnight; end fields remain editable. Date rollover and year-boundary behavior are covered by the calendar checks, and the mobile editor was checked with synthetic preview data.

Month-view day taps open a compact day popup instead of a panel underneath the calendar. It shows the selected full date/year, matching events, and an Add event button that prefills that exact date. Event taps open read-only details first; closing details returns to the day popup, while Edit opens the event editor. Empty-day messages, keyboard Escape/focus restoration, and date-prefilled creation were checked in the mobile preview. The existing Agenda and Search views remain available.
