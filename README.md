# Universe Bot Catalog — prototype
Static catalog prototype: showroom theme, cylinder/mirror, bot cards, deployment modes, renter/customer/employee/manager portal previews, and 120 listing rows.

The startup page now opens to a grid of square icon buttons. Private tiles display
"Administrator only" and open a locked notice; Agents & tools remains a public demo.
Bookmarks save in the
current browser only. A service worker caches the public page, CSS, and JavaScript for
offline opening after the first successful load; API requests and customer files are not
cached. Browser data can be cleared,
so bookmarks are not a substitute for the future private database or backup.
Documents & signing appears first as a locked tile. The document desk farther down
the public page contains only placeholders. No documents or signatures are sent to DocuSign.

For a future blank product, ship a clean starter with sample data and optional connectors.
Do not ship customer projects, tokens, credentials, or the owner's personal bookmarks.
Add product terms and review licenses and trademarks before selling or distributing it.

IMPORTANT: the locked tile is a public notice, not an administrator login. No private
customer data is stored or exposed in these drawers. The former demo unlock code has
been removed. Zoho setup endpoints return 403 until verified administrator authentication
is installed. Production needs real authentication, authorization, server-side secrets,
audit logs, and human approval gates.

Suggested free-first architecture:
- Cloudflare Pages for the public catalog
- GitHub for source/version control
- Supabase Free for auth/database/storage
- Agent runtime chosen after commercial-license review
- Automation engine chosen after commercial-license review

Prototype product flow:
Catalog → Choose → Configure → License → Connect → Human authorize → Deploy → Update → Renew/Return

## Handy-Candy customer project and approval requirements

The chat currently drafts text only. It has no customer sign-in, persistent project store,
approval queue, or outbound email action. A model saying "approved" is never authorization.

For production, add an authenticated customer account and a server-side database (for example,
Cloudflare D1). Associate each rental with a customer ID and explicit start and end dates.
Store every project under that rental: messages, drafts, revisions, negotiation notes,
proposed appointments, approval requests, decisions, and an action audit log. The customer
must be able to reopen and export their own projects for the entire rental. Do not erase
projects automatically at expiration; make post-rental access and deletion a stated policy.
Every read and write must verify the authenticated customer owns the rental. A public
browser key, demo clearance code, or client-supplied customer ID is insufficient.

Before an external action, the server creates a PENDING approval request that includes
the exact recipient, subject, body, sender account, and proposed action. The UI shows
Approve and Reject controls to that authenticated customer. Approval must bind to the
specific immutable content hash and be single use; editing the content invalidates it.
The server must reject sending when approval is missing, rejected, expired, already used,
or belongs to another customer. After sending via a connected provider, record the
provider response and action result. A retry must use an idempotency key to avoid
duplicate emails. Scheduling, accepting terms, and other external commitments follow
the same rule. Never give the model a direct path to the send API.

Chat generation now tries a backup Gemini model for temporary primary-model errors.
This improves availability of drafting; it does not provide a backup email provider.
The model cannot send an email during a busy-model error. Customer project storage and
approved outbound sending require the authenticated backend described above.
