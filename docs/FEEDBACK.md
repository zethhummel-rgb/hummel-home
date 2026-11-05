# Send Feedback

Available to signed-in, confirmed household members under More → Send Feedback and Settings → Send Feedback. Choose an HH area or New Feature Suggestion and enter up to 5,000 characters. The email includes the selected area, comment, account email, member display name and household name. Reply-To uses the verified account email. Recipient is fixed on the server to hummelhomeapp@gmail.com; request fields cannot override it. Test messages have an [HH TEST] subject.

## Deployment

Apply the additive hh_send_feedback migration to the intended project, then deploy `send-feedback` with its shared modules, before publishing the frontend. The handler verifies the bearer token through Auth and requires confirmed email plus current household membership. Platform JWT checking is off because the handler performs this check itself, consistent with the other app functions.

The TEST project is `ybizqfghnplcxlmlhvyn`. LIVE is `njpdqiwrwgoothkstoql`. This change is initially deployed only to TEST. Do not copy any test data or reset scripts to live.

## Email setup

Set `HH_EMAIL_APP_PASSWORD` in the intended project's Edge Function secrets to a Gmail app password for the sender account. The default sender is hummelhomeapp@gmail.com; `HH_EMAIL_FROM` can identify a different authorized Gmail sender. Never put an app password in frontend environment variables, code, GitHub or chat. Prefer a dedicated app password for the test app, which can be revoked independently.

The handler's GET endpoint (with the app's Origin header) reports only `{configured: boolean}`. This checks configuration presence, not Gmail authentication or inbox delivery. A real authorized submission is still needed to verify the Gmail path. Unconfigured delivery returns 503 without claiming or storing the comment; the frontend keeps it in the form. No success is shown until SMTP accepts the message.

Feedback email is a deliberate exception to the test project's other outbound-mail restrictions. Invitation email, Google syncing and push delivery remain disabled. No real email was sent by the automated tests.

## Delivery and privacy

The private table stores each submission and its delivery status, with cascading deletion when the account or home is deleted. Authenticated and anonymous clients cannot read this table or invoke the service RPC. A service-only function serializes claims, checks membership and enforces 30 seconds between messages, at most 5 per user per hour and 100 total per hour. Repeated request IDs return the existing result without sending twice. A different payload cannot reuse a claimed ID.

When delivery is uncertain, the same ID will not resend automatically. The comment stays visible and the user gets an honest delivery warning. An operator can inspect the private delivery record and mailbox for the reference ID; do not blindly resend an uncertain SMTP delivery. A sent email copy has separate mailbox retention.

Run `npm run test:feedback`, `npm run test:invitations`, the existing release suites and `npm run build`. Review menu navigation, the full mobile form, keyboard focus, errors and success on the test app before proposing a production release.

Initial test deployment (2026-11-05): migration 20261105170757 applied; email configuration check returned false. No real inbox delivery has been verified.
