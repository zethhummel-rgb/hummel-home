# HH test environment

Hummel Home is the staging site for HH Family. Initial source baseline:
`zethhummel-rgb/hh-family` commit `8ae27cadd1e25e704c52b4aa85aa90042f8ab32a`.

| Target | Repository | Website path | Supabase project |
| --- | --- | --- | --- |
| Test | zethhummel-rgb/hummel-home | /hummel-home/ | ybizqfghnplcxlmlhvyn |
| Live | zethhummel-rgb/hh-family | /hh-family/ | njpdqiwrwgoothkstoql |

## Release workflow

1. Start from the current reviewed HH source and apply changes in Hummel Home.
2. Run the existing calendar, database, invitations, recovery and welcome suites plus `test:staging`. Test fixture changes also require `node scripts/check-test-seed.mjs`.
3. Apply necessary additive migrations/functions to the TEST project only. Publish Hummel Home and verify its deployed version and target project.
4. Review on the installed iPhone app and exercise the affected flows using Maple House. Record the exact tested commit and any limitations.
5. Only after Zeth approves release, prepare a production PR containing that reviewed application change. Preserve production data and configuration. Apply required additive production migrations separately before frontend release, then merge and verify Pages.
6. Never promote records, credentials, `test-support/` resets or synthetic seed SQL. Never run the legacy reset twice or bootstrap against a populated project. Build-time environment selection remains explicit; the shared workflow binds it to the repository.

Do not use a moving branch tip as proof of which version was tested. Compare the staged source with the current HH source; resolve intervening changes and retest before release. No automatic staging-to-production merge is configured.

## Isolation

- Test builds reject the live backend and the live website path. Production builds reject the test project and test path.
- Login storage, preferences, account registry and auth broadcast channels are namespaced in the test build. Legacy and production login keys are not removed.
- Existing old-app Auth accounts remain; only Zeth's existing confirmed account is assigned to Maple House. Other retained accounts have no household access. Household displays and records are fictional.
- Old Google tokens, migration connection tokens and push subscriptions are removed during the authorized one-time reset. Remote Google calendars are not deleted. Old reminder jobs stop; no production credentials are copied.
- Edge Functions detect the actual TEST project URL. Google copy/import, invitation email and push delivery are blocked there regardless of old environment secrets. They must be deliberately enabled with test-only external accounts before end-to-end delivery tests.
- Existing account sign-in is available. Real Auth confirmation/recovery emails, real multi-account flows, live device push and physical iPhone behavior require separate controlled checks; database fixtures do not prove those paths work.

## Fixtures

Maple House has Alex (tester login), Jamie, Riley and Casey; 12 events; 16 groceries; 10 tasks; 6 staples; 4 notes; 4 favourite recipes; 29 meal plans across all slots; a sample unread update and two invalid-domain invitations. Dates are relative to the seed's Toronto date. Some records deliberately have missing quantities, no store, decimal quantities, completed states, recurrence, cancelled occurrences, or expired invitations.

The initial reset script is specific to the observed legacy database and rejects any project already containing HH's pilot schema. It is kept outside `supabase/migrations` and is never run by Pages.
