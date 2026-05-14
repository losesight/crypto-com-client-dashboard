#!/usr/bin/env python3
"""Convert the Cursor agent-tools file (containing JSON-wrapped HTML) to clean HTML."""
import json, sys, os, re, pathlib

def extract_html(raw: str) -> str:
    # Strip the "Script ran on page and returned:\n```json\n...\n```\n" wrapper if present
    raw = raw.strip()
    if raw.startswith("Script ran on page"):
        # find the first ```json fence
        m = re.search(r"```json\s*\n(.*?)\n```", raw, flags=re.S)
        if m: raw = m.group(1).strip()
    # Now raw should be a JSON-encoded string (a single JSON string literal)
    return json.loads(raw)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: python save_rendered.py <agent_tools_file> <output_html>")
        sys.exit(1)
    src, dst = sys.argv[1], sys.argv[2]
    raw = open(src, encoding="utf-8").read()
    html = extract_html(raw)
    pathlib.Path(os.path.dirname(dst)).mkdir(parents=True, exist_ok=True)
    open(dst, "w", encoding="utf-8").write(html)
    print(f"Wrote {len(html):,} bytes -> {dst}")
