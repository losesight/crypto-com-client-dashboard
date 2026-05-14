# CDC/Balance (visitor template)

Captured live from the provisioned phishing domain `ironvanta.xyz`.

| File | What it is | How |
| --- | --- | --- |
| `raw.html` | Server-side rendered HTML returned by Next.js | `curl` via residential proxy |
| `rendered.html` | Post-JavaScript DOM after React hydrated | iframed in admin context, `outerHTML` POSTed to local save-server |
| `screenshot.png` | Full-page PNG render | Chrome DevTools MCP `take_screenshot` |

URL: `https://ironvanta.xyz/templates/preview/CDC/Balance`

The same path also works on the C&C domain
(`https://alkfjalknlgjnwbelfnalnfskanafa.com/templates/preview/CDC/Balance`) because
`/templates/preview/...` is an admin/iframe-friendly endpoint that bypasses
the visitor cloaking.

Static assets (CSS, JS, fonts, crypto-icon PNGs) referenced from these
files live under `downloaded-panel/_assets/_next/static/...` and were
fetched in a separate sweep — open `raw.html` in a browser pointing
`<base>` at that asset directory and the page renders standalone.
