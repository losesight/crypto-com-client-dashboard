# inbox-filter is NOT implemented on this panel build

Even though the admin sidebar shows an "Inbox Filter" entry, the route
`/admin/inbox-filter` does NOT exist on this build of
alkfjalknlgjnwbelfnalnfskanafa.com — the server returns
`HTTP 307 -> https://google.com/` (the same cloak response the visitor
templates use to hide non-existent or unauthorized routes).

That means:
- `raw.html` here is the cloak's 307 body (a tiny Next.js redirect page);
- there is no `rendered.html` and no `screenshot.png` because Chrome
  follows the 307 and lands on google.com.

Confirmed via parallel probes:
- `/admin/inbox-filter`  -> 307 -> https://google.com/
- `/admin/inbox-filter` with `RSC: 1` header -> HTTP 404 (`_not-found`)

Other sidebar items in the same situation: chat, livechat, sessions,
seeds, vault, gmail, templates, control, sms — all 307 to google.com.
The real admin routes are: dashboard, users, domains, flows, mailer,
profile, settings, login.
