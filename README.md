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

Owner pastes the Google family calendar ID into settings. The website embeds Google's calendar; each visitor must be signed in to a Google account authorized for the private calendar. Browsers that block embedded sign-in can use Open in Google. Add event opens Google Calendar; choose the family calendar before saving. Events are not directly fetched into the home card, and no API/OAuth two-way synchronization is claimed.

## Development

Node 22.13+ required.

```
npm ci --ignore-scripts
npm run dev
npm run build
```

The app does not store groceries or tasks in localStorage. Supabase persists records; the auth library manages local session storage. The app refreshes household records on focus and every 30 seconds while visible. No offline write queue is included.

## Verification completed

- TypeScript and production build passed.
- Browser checked: login and account creation screens render and navigation works. No real credentials were entered.
- Supabase security advisor returned zero findings after schema installation.
- `database/security-check.sql` passed using synthetic users and records in a rolled-back transaction: owner/member data access, outsider isolation, email-bound invitations, invitation consumption, owner-only settings/invitations, and anonymous denial.
- Live hosted signup, email delivery, password reset, and invitation end-to-end remain unverified pending publication and email configuration.

## Database changes

`supabase/migrations/20261018010629_household_accounts.sql` records the exact applied migration. Do not rerun it on the existing project. For a fresh separate project, apply the schema once through the Supabase migration tools. No auth users or household records are seeded.
