#!/usr/bin/env python3
"""Pass 1: fetch raw (SSR) HTML for every visitor template via the panel's
preview endpoint on the provisioned phishing domain."""
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
URLS = ROOT / "downloaded-panel" / "_logs" / "visitor-urls.json"
LOG = ROOT / "downloaded-panel" / "_logs" / "dump-visitor-raw.log"
PROXY = os.environ.get("HTTPS_PROXY", "http://USER:PASS@127.0.0.1:60001")
DOMAIN = "ironvanta.xyz"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

data = json.loads(URLS.read_text())
log_lines = []
ok = fail = 0

for i, t in enumerate(data["templates"], 1):
    out_dir = ROOT / "downloaded-panel" / "visitor" / t["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "raw.html"
    url = f"https://{DOMAIN}{t['path']}"
    proc = subprocess.run(
        [
            "curl", "-sS", "-x", PROXY, "-m", "25", "-L",
            "-A", UA,
            "-o", str(out_file),
            "-w", "%{http_code}|%{size_download}|%{url_effective}",
            url,
        ],
        capture_output=True,
        text=True,
    )
    parts = (proc.stdout or "").split("|")
    http = parts[0] if len(parts) > 0 else "?"
    size = parts[1] if len(parts) > 1 else "?"
    final = parts[2] if len(parts) > 2 else "?"
    line = f"[{i:>2}/{len(data['templates'])}] {t['slug']:<22} HTTP={http} size={size:>6} final={final}"
    print(line)
    log_lines.append(line)
    try:
        if http == "200" and int(size) > 1000:
            ok += 1
        else:
            fail += 1
    except ValueError:
        fail += 1

summary = f"summary: ok={ok} fail={fail} total={len(data['templates'])}"
print(summary)
log_lines.append(summary)
LOG.write_text("\n".join(log_lines) + "\n")
