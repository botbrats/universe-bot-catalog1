# Universe Bot Catalog — prototype
Static catalog prototype: showroom theme, cylinder/mirror, bot cards, deployment modes, renter/customer/employee/manager portals, clearance cabinet demo, and 120 editable-style listing rows.

IMPORTANT: the clearance gate is only a visual demo. Do not put passwords, API keys, financial credentials, or IDs in front-end code. Production needs real authentication, authorization, server-side secrets, audit logs, and human approval gates.

Suggested free-first architecture:
- Cloudflare Pages for the public catalog
- GitHub for source/version control
- Supabase Free for auth/database/storage
- Agent runtime chosen after commercial-license review
- Automation engine chosen after commercial-license review

Prototype product flow:
Catalog → Choose → Configure → License → Connect → Human authorize → Deploy → Update → Renew/Return
