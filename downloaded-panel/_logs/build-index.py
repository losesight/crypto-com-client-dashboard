#!/usr/bin/env python3
"""Generate _index.html: a browsable dashboard of everything we captured."""
import json, os, glob, html, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PANEL = ROOT  # we are inside downloaded-panel/_logs/, so ROOT == downloaded-panel/

manifest = json.load(open(PANEL / "_manifest.json"))

def rel(p):
    return os.path.relpath(p, PANEL)

def file_size(p):
    try:
        n = os.path.getsize(p)
        if n >= 1024 * 1024: return f"{n/1024/1024:.1f} MB"
        if n >= 1024:        return f"{n/1024:.1f} KB"
        return f"{n} B"
    except Exception:
        return "—"

def cell(p):
    if os.path.exists(p):
        return f'<a href="{html.escape(rel(p))}">{html.escape(os.path.basename(p))}</a> <span class=sz>({file_size(p)})</span>'
    return '<span class=missing>—</span>'

rows_admin = []
for entry in manifest["admin_pages"]:
    slug = entry["slug"]
    base = PANEL / "admin" / slug
    raw  = base / "raw.html"
    rend = base / "rendered.html"
    shot = base / "screenshot.png"
    note = base / "_note.md"
    rows_admin.append(f"""
      <tr>
        <td><strong>{html.escape(slug)}</strong><br><span class=url>{html.escape(entry['url'])}</span></td>
        <td>{cell(raw)}</td>
        <td>{cell(rend)}</td>
        <td>{cell(shot)}</td>
        <td>{cell(note) if note.exists() else ''}</td>
      </tr>
    """)

rows_vis = []
for v in manifest["visitor_templates"]:
    slug = v["slug"]
    base = PANEL / "visitor" / slug
    raw  = base / "raw.html"
    rend = base / "rendered.html"
    shot = base / "screenshot.png"
    note = base / "_note.md"
    path = v.get("path", f"/templates/preview/{v['module']}/{v['page']}")
    rows_vis.append(f"""
      <tr>
        <td><strong>{html.escape(v['module'])} — {html.escape(v['page'])}</strong><br>
            <span class=url>{html.escape(path)}</span></td>
        <td>{cell(raw)}</td>
        <td>{cell(rend)}</td>
        <td>{cell(shot)}</td>
        <td>{cell(note)}</td>
      </tr>
    """)

assets_count = sum(1 for _ in glob.iglob(str(PANEL / "_assets" / "**"), recursive=True) if os.path.isfile(_))

visitor_rendered_ok = sum(
    1 for v in manifest["visitor_templates"]
    if (PANEL / "visitor" / v["slug"] / "rendered.html").exists()
)
visitor_shot_ok = sum(
    1 for v in manifest["visitor_templates"]
    if (PANEL / "visitor" / v["slug"] / "screenshot.png").exists()
)
phishing_domain = manifest.get("phishing_domain", "—")
visitor_capture_at = manifest.get("visitor_capture_at_iso", "—")

doc = f"""<!doctype html>
<meta charset=utf-8>
<title>Downloaded Panel — alkfjalknlgjnwbelfnalnfskanafa.com</title>
<style>
  body {{ background:#0a0a0a; color:#eaeaea; font:14px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; margin:0; padding:32px 40px; }}
  h1 {{ margin:0 0 4px; font-size:22px; }}
  h2 {{ margin:32px 0 8px; font-size:15px; text-transform:uppercase; letter-spacing:.08em; color:#a78bfa; }}
  .sub {{ color:#999; margin-bottom:24px; font-size:12px; }}
  table {{ width:100%; border-collapse:collapse; background:#141414; border:1px solid #2a2a2a; border-radius:8px; overflow:hidden; }}
  th, td {{ padding:10px 14px; text-align:left; border-bottom:1px solid #222; vertical-align:top; }}
  th {{ background:#1a1a1a; color:#bbb; font-size:11px; text-transform:uppercase; letter-spacing:.05em; }}
  td:first-child {{ width:34%; }}
  a {{ color:#8b5cf6; text-decoration:none; }}
  a:hover {{ text-decoration:underline; }}
  .url {{ color:#666; font-family:ui-monospace,monospace; font-size:11px; }}
  .sz {{ color:#666; font-size:11px; }}
  .missing {{ color:#444; }}
  .stat {{ display:inline-block; margin-right:18px; padding:6px 12px; background:#141414; border:1px solid #2a2a2a; border-radius:6px; font-size:12px; }}
  .stat b {{ color:#a78bfa; font-size:14px; }}
  .ok {{ background:#152a18; border:1px solid #1f4625; padding:14px 18px; border-radius:8px; margin:16px 0; color:#a3e2b3; font-size:13px; line-height:1.55; }}
  .ok strong {{ color:#7eecaa; }}
  code {{ background:#222; padding:2px 6px; border-radius:4px; font-size:12px; color:#fde68a; }}
</style>

<h1>Downloaded panel — alkfjalknlgjnwbelfnalnfskanafa.com</h1>
<div class=sub>Captured {manifest['captured_at_iso']} as <code>{manifest['captured_by']}</code> · visitor templates captured {visitor_capture_at} via <code>{phishing_domain}</code> · Chrome DevTools MCP + curl over HTTPS proxy</div>

<div>
  <span class=stat><b>{len(rows_admin)}</b> admin pages</span>
  <span class=stat><b>{len(rows_vis)}</b> visitor templates</span>
  <span class=stat><b>{visitor_rendered_ok}/{len(rows_vis)}</b> rendered DOMs</span>
  <span class=stat><b>{visitor_shot_ok}/{len(rows_vis)}</b> screenshots</span>
  <span class=stat><b>{assets_count}</b> static assets</span>
  <span class=stat><b>~{(sum(os.path.getsize(p) for p in glob.glob(str(PANEL/'**/*'), recursive=True) if os.path.isfile(p))/1024/1024):.1f} MB</b> total</span>
</div>

<div class=ok>
  <strong>All 32 visitor templates captured.</strong> Once a phishing domain
  (<code>{phishing_domain}</code>) was provisioned in the admin
  <code>/admin/domains</code> tab, the
  <code>/templates/preview/{{Brand}}/{{PageName}}</code> endpoint returned the
  real React/Next.js visitor pages on both the C&amp;C and the new domain
  (no cloak, no auth). For each template we now have raw SSR HTML, post-JS
  rendered DOM, and a full-page screenshot — see the table below.
</div>

<h2>Admin pages ({len(rows_admin)})</h2>
<table>
  <thead><tr><th>Page</th><th>Raw HTML (server SSR)</th><th>Rendered DOM (post-JS)</th><th>Screenshot</th><th>Note</th></tr></thead>
  <tbody>{''.join(rows_admin)}</tbody>
</table>

<h2>Visitor templates ({len(rows_vis)})</h2>
<table>
  <thead><tr><th>Template</th><th>Raw HTML (cloak shell)</th><th>Rendered</th><th>Screenshot</th><th>Note</th></tr></thead>
  <tbody>{''.join(rows_vis)}</tbody>
</table>

<h2>References</h2>
<ul>
  <li><a href="_manifest.json"><code>_manifest.json</code></a> — machine-readable catalogue of every page</li>
  <li><a href="_logs/templates.json"><code>_logs/templates.json</code></a> — the panel's own template manifest (live JSON from <code>GET /templates</code>)</li>
  <li><a href="_logs/cookies.txt"><code>_logs/cookies.txt</code></a> — Netscape cookie jar with the captured admin JWT (use with curl <code>-b</code> while it's valid)</li>
  <li><a href="_logs/dump-raw.sh"><code>_logs/dump-raw.sh</code></a> · <a href="_logs/dump-admin-assets.sh"><code>_logs/dump-admin-assets.sh</code></a> — re-runnable download scripts</li>
  <li><a href="_logs/save-server.cjs"><code>_logs/save-server.cjs</code></a> — Node.js receiver that wrote rendered DOMs from Chrome MCP to disk</li>
  <li><a href="_assets/"><code>_assets/</code></a> — every <code>_next/static</code> CSS, JS, font and image referenced</li>
</ul>
"""
out = PANEL / "_index.html"
out.write_text(doc)
print(f"Wrote {out} ({len(doc):,} chars)")
