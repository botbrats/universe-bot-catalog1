# Handy-Candy sending

Deploy the Worker with the existing Zoho secrets and OAUTH_TOKENS binding.
The new EMAIL_QUEUE Durable Object and email-queue-v1 SQLite migration in
wrangler.jsonc are required. Keep worker.js, email.js, mail.html and email-ui.js
together. Deploy with the official Wrangler CLI using this configuration.

The existing OAuth CREATE permission is sufficient; no new mail scope is requested.
Open /mail.html and use its Zoho sign-in link once after deployment. The
callback verifies the allowed mailbox and creates a 24-hour HttpOnly Secure
owner session. Public callers cannot use the email API.

Load the private ten-inquiry JSON file through the file chooser. Saving imports
the records into durable storage; loading does not send. The ten-inquiry send
button authorizes submission of those exact saved records only. Edited records
are sent individually. No property inquiry data is bundled in public assets.

Send uses the saved draft revision, fixed verified sender, plain text, and one
recipient. Submitted records cannot be edited or resent. A durable submission
marker precedes the Zoho call. Timeout, malformed responses, and missing provider
message IDs are marked unknown and require checking Zoho Sent. Provider acceptance
is not delivery confirmation. Replies are not implemented in this feature.

Validation: node email.test.mjs; node --check worker.js; node --check email-ui.js.
Tests mock provider traffic and do not send real mail.
