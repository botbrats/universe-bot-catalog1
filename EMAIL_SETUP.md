# Handy-Candy email portal

The email portal supports the existing Zoho sender and the approved Gmail sender
`shopclubhostings@gmail.com`. Gmail inbox access is read-only; replies are saved
as drafts and sent only through the separate approval and Send actions.

## Cloudflare configuration

Keep the existing production Worker, Durable Object binding `EMAIL_QUEUE`, and
KV binding `OAUTH_TOKENS`. Configure the Google OAuth client ID and secret as
Worker secrets named `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Do not put
credentials in browser code, repository files, or chat messages.

Google OAuth must use the Web application redirect URI:
`https://universe-bot-catalog1.dceddocs.workers.dev/api/google/callback`.
The OAuth consent screen is External / Testing and the verified owner account
`shopclubhostings@gmail.com` must be a test user. The authorized domain is
`dceddocs.workers.dev`.

The requested Google scopes are `openid`, `email`, `gmail.send`, and
`gmail.readonly`. Adding read-only inbox access changes the consent grant.
After the updated Worker is deployed, the owner must reconnect Gmail and approve
the expanded scope. No Google Cloud billing activation is required merely to
use the OAuth testing flow; do not enable billing or make a payment just for
this integration without independently confirming a service requires it.

## Owner workflow

1. Open `/mail.html` and connect the authorized Gmail account or sign in to Zoho.
2. For Gmail, choose Refresh Inbox and open a conversation. Message content is
   rendered as text, not inserted as HTML.
3. Choose Draft a reply. Confirm the recipient and wording, then Save draft.
4. Review the saved draft and choose Approve. Approval does not send.
5. Choose Send and confirm the exact recipient and subject. Sending is a
   separate, explicit action.

Imported inquiry batches contain at most 10 items and only create drafts. A
recipient must be present and valid before approval. Editing an approved draft
resets its approval. Submitted or uncertain sends cannot be blindly resent;
check the provider Sent folder first. Provider acceptance is not delivery
confirmation.

## Validation

Run `node --test email.test.mjs gmail.test.mjs` and the syntax checks in
`.github/workflows/tests.yml`. Tests mock provider traffic; they do not send
real email. Do not merge or deploy until CI passes and an owner-controlled
end-to-end OAuth and test-message check has been completed.
