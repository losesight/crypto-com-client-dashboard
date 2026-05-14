#!/usr/bin/env python3
"""Hit every visitor template URL on the local panel and report the result.
Also samples a few /_next/static/ assets to confirm asset hosting works.
"""
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
URLS = ROOT / "downloaded-panel" / "_logs" / "visitor-urls.json"
BASE = "http://localhost:5173"

data = json.loads(URLS.read_text())
ok = fail = 0
fails = []
for i, t in enumerate(data["templates"], 1):
    url = f"{BASE}{t['path']}"
    proc = subprocess.run(
        ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}|%{size_download}", url],
        capture_output=True,
        text=True,
    )
    parts = (proc.stdout or "").split("|")
    http = parts[0] if parts else "?"
    size = parts[1] if len(parts) > 1 else "?"
    line = f"[{i:>2}/32] {t['slug']:<22} HTTP={http} size={size}"
    print(line)
    if http == "200" and int(size) > 1000:
        ok += 1
    else:
        fail += 1
        fails.append(t["slug"])
print(f"\n templates: ok={ok} fail={fail}")
if fails:
    print(f"  failed: {fails}")

# Sample a few referenced assets
print("\n--- asset samples ---")
samples = [
    "/_next/static/css/68165cb776a47886.css",
    "/_next/static/css/97cc91616cea400d.css",
    "/_next/static/chunks/798-26b25d7eaec30e75.js",
    "/_next/static/chunks/webpack-9921f3b0b554b2ea.js",
    "/_next/static/media/bitcoin.44da609b.png",
    "/_next/static/media/de30a32fa2634c38-s.p.ttf",
]
for path in samples:
    proc = subprocess.run(
        ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}|%{size_download}", f"{BASE}{path}"],
        capture_output=True,
        text=True,
    )
    print(f"  {path:<58} {proc.stdout}")
