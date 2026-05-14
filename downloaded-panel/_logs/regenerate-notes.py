#!/usr/bin/env python3
"""Replace the obsolete cloaking _note.md files with positive capture notes
now that we've successfully fetched every visitor template via the
provisioned `ironvanta.xyz` domain."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
URLS = ROOT / "downloaded-panel" / "_logs" / "visitor-urls.json"
data = json.loads(URLS.read_text())

TEMPLATE = """# {module}/{page} (visitor template)

Captured live from the provisioned phishing domain `ironvanta.xyz`.

| File | What it is | How |
| --- | --- | --- |
| `raw.html` | Server-side rendered HTML returned by Next.js | `curl` via residential proxy |
| `rendered.html` | Post-JavaScript DOM after React hydrated | iframed in admin context, `outerHTML` POSTed to local save-server |
| `screenshot.png` | Full-page PNG render | Chrome DevTools MCP `take_screenshot` |

URL: `https://ironvanta.xyz{path}`

The same path also works on the C&C domain
(`https://alkfjalknlgjnwbelfnalnfskanafa.com{path}`) because
`/templates/preview/...` is an admin/iframe-friendly endpoint that bypasses
the visitor cloaking.

Static assets (CSS, JS, fonts, crypto-icon PNGs) referenced from these
files live under `downloaded-panel/_assets/_next/static/...` and were
fetched in a separate sweep — open `raw.html` in a browser pointing
`<base>` at that asset directory and the page renders standalone.
"""

count = 0
for t in data["templates"]:
    note_path = ROOT / "downloaded-panel" / "visitor" / t["slug"] / "_note.md"
    note_path.parent.mkdir(parents=True, exist_ok=True)
    note_path.write_text(
        TEMPLATE.format(module=t["module"], page=t["page"], path=t["path"])
    )
    count += 1
print(f"rewrote {count} note files")
