# Downloaded panel — `alkfjalknlgjnwbelfnalnfskanafa.com`

Captured **2026-05-13** via the configured residential proxy
(`http://USER:***@127.0.0.1:60001`, exit IP `73.249.185.104`).
Open **`_index.html`** in a browser for a clickable dashboard.

```
downloaded-panel/
├── _index.html              ← browseable index (open this!)
├── _manifest.json           ← machine-readable catalogue
├── README.md                ← this file
│
├── admin/                   ← admin panel pages (we are logged in)
│   └── <slug>/
│       ├── raw.html         server-rendered SSR HTML (no JS executed)
│       ├── rendered.html    post-JavaScript live DOM (Chrome MCP)
│       ├── screenshot.png   full-page screenshot
│       └── _note.md         (only when something is unusual)
│
├── visitor/                 ← all 32 visitor template paths, fully captured
│   └── <module>/<page>/
│       ├── raw.html         server-rendered SSR HTML
│       ├── rendered.html    post-JavaScript live DOM (iframed in admin context)
│       ├── screenshot.png   full-page screenshot
│       └── _note.md         per-template provenance
│
├── _assets/                 ← every CSS/JS/font/image referenced from any page
│   └── _next/static/...     visitor + admin bundles (chunks, css, fonts, icons)
│
└── _logs/                   ← provenance / re-run scripts
    ├── visitor-urls.json    manifest of the 32 visitor template URLs
    ├── templates.json       raw response from GET /templates
    ├── cookies.txt          Netscape cookie jar with the admin JWT
    ├── dump-raw.sh          pass 1+2+3: re-run admin raw HTML + asset download
    ├── dump-admin-assets.sh pass 3b: re-fetch admin-only chunks
    ├── dump-visitor-raw.py  pass 1: visitor template raw HTML over the proxy
    ├── dump-visitor-assets.py  pass 3: harvest visitor template assets
    ├── regenerate-notes.py  rewrites every visitor _note.md
    ├── save-server.cjs      tiny CORS POST receiver used by Chrome MCP
    ├── save_rendered.py     converts Cursor agent-tools output → clean HTML
    └── build-index.py       regenerate _index.html
```

## What I captured

### ✅ Admin panel — fully captured (7/9 pages with rendered DOMs + screenshots)

| Page          | URL                       | Raw   | Rendered | Screenshot |
| ------------- | ------------------------- | ----- | -------- | ---------- |
| dashboard     | `/admin/dashboard`        | ✓     | ✓        | ✓          |
| users         | `/admin/users`            | ✓     | ✓        | ✓          |
| domains       | `/admin/domains`          | ✓     | ✓        | ✓          |
| flows         | `/admin/flows`            | ✓     | ✓        | ✓          |
| mailer        | `/admin/mailer`           | ✓     | ✓        | ✓          |
| profile       | `/admin/profile`          | ✓     | ✓        | ✓          |
| settings      | `/admin/settings`         | ✓     | ✓        | ✓          |
| login         | `/admin/login`            | ✓     | —        | —          |
| inbox-filter  | `/admin/inbox-filter`     | ✓     | —        | —          |

> **Note on `inbox-filter`**: shown in the sidebar but the route does not
> actually exist on this build — server returns `307 → google.com`. The
> raw.html is the cloak's tiny redirect page, not real content.

### ✅ Visitor templates — ALL 32 captured

After a custom phishing domain (`ironvanta.xyz`) was provisioned via
`/admin/domains`, every visitor template became reachable through the
panel's preview endpoint:

```
https://ironvanta.xyz/templates/preview/{Brand}/{PageName}
```

The same path also returns 200 on the C&C domain itself
(`https://alkfjalknlgjnwbelfnalnfskanafa.com/templates/preview/...`),
because `/templates/preview/...` is the iframe-friendly endpoint the
admin's per-victim "Redirect" panel uses for its live preview.

| Module    | Pages | Slugs                                                                     |
| --------- | ----- | ------------------------------------------------------------------------- |
| Coinbase  | 9     | loading, external, activity, balance, case, cbw, reset, swap, vault       |
| CDC       | 6     | loading, activity, balance, case, external, wallet                        |
| Google    | 7     | loading, login, password, backup, fail, totp, sms                         |
| iCloud    | 4     | login, password, 2fa, locked                                              |
| Binance   | 5     | loading, case, backup, balance, activity                                  |
| KuCoin    | 1     | loading                                                                   |

For every one of those 32 templates we now have:
- `raw.html` (SSR shell, ~12–55 KB)
- `rendered.html` (post-React-hydration DOM, ~27–56 KB)
- `screenshot.png` (1024×768+ full page, 60–390 KB)
- `_note.md` (URL + provenance)

### ✅ Static assets — fully captured

74 files (≈7.9 MB) under `_assets/_next/static/`: every CSS bundle, JS
chunk (visitor + admin + dynamic-route page chunks), woff2/ttf font, and
crypto-icon PNG referenced from any captured page. Re-runs are
idempotent — already-on-disk assets are skipped.

## Why the previous run couldn't get visitor templates

Originally the C&C domain returned `307 → google.com` for every direct
visitor-style URL (`/coinbase/loading/template`, `/coinbase/loading`,
`/templates/coinbase/loading`, etc.). The panel's intentional cloak.

Two things made this run succeed:

1. **A phishing domain was added** (`ironvanta.xyz`) — once a domain is
   provisioned in `/admin/domains` it stops being cloaked.
2. **The right URL prefix is `/templates/preview/`** — the admin panel
   uses this endpoint for its iframe preview inside the per-victim
   "Redirect" tab. It bypasses the cloak (it's the preview endpoint,
   not a victim endpoint), so it works on both the C&C and the new
   domain regardless of victim sessions or phishkey settings.

## How to re-run

The proxy + cookies you need are already on disk. From the project
root:

```bash
# Replace USER/PASS with your residential proxy credentials
export HTTPS_PROXY="http://USER:PASS@127.0.0.1:60001"
export HTTP_PROXY="$HTTPS_PROXY"

# Pass 1 — admin pages raw HTML + admin assets:
bash downloaded-panel/_logs/dump-raw.sh
bash downloaded-panel/_logs/dump-admin-assets.sh

# Pass 1b — visitor template raw HTML (32 pages):
python3 downloaded-panel/_logs/dump-visitor-raw.py

# Pass 2 (rendered DOMs) — needs a Chrome session via Chrome DevTools MCP
# AND the local save-server running:
node downloaded-panel/_logs/save-server.cjs &
# … then drive Chrome MCP to navigate each preview URL and POST
#    document.documentElement.outerHTML to http://localhost:8765/save?path=…

# Pass 3 — harvest visitor assets referenced from raw.html / rendered.html:
python3 downloaded-panel/_logs/dump-visitor-assets.py

# Regenerate notes + index:
python3 downloaded-panel/_logs/regenerate-notes.py
python3 downloaded-panel/_logs/build-index.py
```

If the JWT in `cookies.txt` expires you'll start getting 14-KB login
pages back for the **admin** routes — re-login through Chrome MCP and
copy `document.cookie` back into `_logs/cookies.txt`. Visitor preview
URLs do **not** require the cookie.
