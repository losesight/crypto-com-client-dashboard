#!/usr/bin/env python3
"""Pass 3: harvest every asset referenced by the captured visitor pages
(both raw.html and rendered.html) and download them through the proxy.

Skips assets already on disk so re-runs are idempotent.
"""
import os
import pathlib
import re
import subprocess
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[2]
PROXY = os.environ.get("HTTPS_PROXY", "http://USER:PASS@127.0.0.1:60001")
DOMAIN = "ironvanta.xyz"
ASSETS_ROOT = ROOT / "downloaded-panel" / "_assets"
LOG = ROOT / "downloaded-panel" / "_logs" / "dump-visitor-assets.log"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Patterns that match href/src attribute values pointing at static assets
# under /_next/, /assets/, /images/, /fonts/, /static/, /icons/ etc.
URL_PATTERNS = [
    re.compile(r'(?:src|href)=["\']([^"\']+\.(?:css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico|map))(?:\?[^"\']*)?["\']', re.I),
    re.compile(r'url\(\s*["\']?([^"\')]+\.(?:css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico))(?:\?[^"\')]*)?["\']?\s*\)', re.I),
    re.compile(r'(?:href|src):"([^"]+\.(?:css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico))', re.I),
    # Next.js chunk preloads inside JSON: "/_next/static/chunks/foo.js"
    re.compile(r'"(/_next/static/[^"]+?\.(?:css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico))"', re.I),
]

def collect_urls() -> set[str]:
    found: set[str] = set()
    visitor_root = ROOT / "downloaded-panel" / "visitor"
    for fname in ("raw.html", "rendered.html"):
        for f in visitor_root.rglob(fname):
            try:
                txt = f.read_text(errors="ignore")
            except Exception:
                continue
            for pat in URL_PATTERNS:
                for m in pat.findall(txt):
                    u = m.strip()
                    if not u:
                        continue
                    # Only keep absolute paths / same-origin URLs
                    if u.startswith(("http://", "https://")):
                        # Only same-origin assets; rewrite host to ironvanta
                        parsed = urllib.parse.urlparse(u)
                        if parsed.netloc and parsed.netloc not in (
                            DOMAIN,
                            "alkfjalknlgjnwbelfnalnfskanafa.com",
                        ):
                            continue
                        path = parsed.path
                    elif u.startswith("/"):
                        path = u
                    else:
                        # relative — skip; we don't know base
                        continue
                    if not path.startswith(("/_next/", "/assets/", "/images/", "/fonts/", "/static/", "/icons/")):
                        # only well-known static prefixes to avoid junk
                        continue
                    found.add(path)
    return found

def fetch(path: str) -> tuple[str, int]:
    out = ASSETS_ROOT / path.lstrip("/")
    if out.exists() and out.stat().st_size > 0:
        return ("cached", out.stat().st_size)
    out.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://{DOMAIN}{path}"
    proc = subprocess.run(
        [
            "curl", "-sS", "-x", PROXY, "-m", "30", "-L",
            "-A", UA,
            "-o", str(out),
            "-w", "%{http_code}|%{size_download}",
            url,
        ],
        capture_output=True,
        text=True,
    )
    parts = (proc.stdout or "").split("|")
    http = parts[0] if parts else "?"
    size = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    if http != "200" or size == 0:
        try:
            out.unlink()
        except FileNotFoundError:
            pass
    return (http, size)


def main() -> None:
    urls = sorted(collect_urls())
    log_lines = [f"Collected {len(urls)} unique asset paths"]
    print(log_lines[-1])
    ok = cached = fail = 0
    for i, p in enumerate(urls, 1):
        status, size = fetch(p)
        line = f"[{i:>3}/{len(urls)}] {status:>6} {size:>7}B  {p}"
        print(line)
        log_lines.append(line)
        if status == "cached":
            cached += 1
        elif status == "200":
            ok += 1
        else:
            fail += 1
    summary = f"summary: ok={ok} cached={cached} fail={fail} total={len(urls)}"
    print(summary)
    log_lines.append(summary)
    LOG.write_text("\n".join(log_lines) + "\n")


if __name__ == "__main__":
    main()
