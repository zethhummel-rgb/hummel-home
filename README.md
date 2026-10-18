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

## Family accounts

- First user signs up, confirms their email, signs in, and creates the household.
- Owner opens the avatar > Your household, enters an invitee's email and generates a link.
- Share the invitation link yourself. The app sends no invitation email.
- Invitee signs up using that exact email, confirms it, then joins through the link.
- Invitations expire after 7 days, work once, and can be revoked before use.
- Members share groceries and tasks; only the owner manages calendar settings and invitations.
- Holt can be represented in task assignments before having an account. An account can be invited later.

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

`supabase/migrations/20261018010629_household_accounts.sql` records the exact applied migration. Do not rerun it on the existing project. For a fresh separate project, apply the schema once through the Supabase migration tools. No auth users or household records are seeded.
