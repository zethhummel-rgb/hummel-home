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

Set the next app release number in `src/releaseVersion.ts` before building a release. Start with `V2.1`, increment through `V2.9`, then use `V3.0`. Verify the deployed number in HH Admin and in **Notices & updates** in the signed-in app footer. Use the same number when publishing its release notes in HH Admin.

### Admin release queue

The **HH TEST release** GitHub workflow can prepare a build from the TEST repository's `main` branch. **Prepare** tests the exact commit and registers its archive checksum in **Admin → Releases**. Preparation does not update the website or create a member announcement. Prepare again from a new checked commit when a candidate's 30-day artifact expires.

In HH TEST Admin, select the prepared version, save and preview its announcement, and confirm the **Release to HH TEST** action. The workflow deploys the checked archive, verifies the version and linked app files at the TEST address, and publishes the saved announcement. Failed verification preserves the draft. If deployment was verified and posting failed, **Retry announcement** checks that the approved build is still served and retries the post. A panel left in **Deploying** for an hour can be requeued after the previous run's 20-minute limit.

The release switch is off until the TEST operator and deployment connection are configured. Restrict the GitHub environments `hh-test-release-prepare` and `hh-test-release-deploy` to `main`. Store the same dedicated random `HH_RELEASE_WORKER_KEY` in both environments and the TEST Edge Function. Keep `HH_TEST_CLOUDFLARE_API_TOKEN` and the `HH_TEST_CLOUDFLARE_ACCOUNT_ID` variable in the deploy environment. Cloudflare Pages write permission is account-scoped. The workflow checks the TEST repository, Cloudflare project and hosted address.

In the TEST Edge Function, set `HH_RELEASE_OPERATOR_ID` to the authorized HH Admin user ID and `HH_RELEASE_GITHUB_TOKEN` to a credential with Actions write permission on the TEST repository. Set `HH_RELEASE_DISPATCH_ENABLED` to `true` when both environments are ready. Keep the TEST service-role key inside Supabase. None of these values belong in browser code, source control or chat.

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

## Feedback email exception

Send Feedback may deliver only to hummelhomeapp@gmail.com when a test sender app password is configured. It labels mail [HH TEST]. This does not enable invitation emails, Google sync or push. See FEEDBACK.md for deployment, credentials, privacy and verification limits.
