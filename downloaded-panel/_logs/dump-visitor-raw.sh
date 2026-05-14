#!/usr/bin/env bash
# Pass 1: fetch raw (SSR) HTML for every visitor template via the panel's
# preview endpoint on the provisioned phishing domain. No cookies needed —
# /templates/preview/{Brand}/{Page} is intentionally public so the admin
# panel's iframe can load it.
set -uo pipefail

PROXY="${HTTPS_PROXY:-http://USER:PASS@127.0.0.1:60001}"
ROOT="$(pwd)"
URLS="$ROOT/downloaded-panel/_logs/visitor-urls.json"
DOMAIN="ironvanta.xyz"
LOG="$ROOT/downloaded-panel/_logs/dump-visitor-raw.log"

mkdir -p "$(dirname "$LOG")"
: > "$LOG"

count=0
ok=0
fail=0

# read each template via python
mapfile -t LINES < <(python3 -c '
import json, sys
data = json.load(open(sys.argv[1]))
for t in data["templates"]:
    print(f"{t[\"slug\"]}\t{t[\"path\"]}\t{t[\"module\"]}\t{t[\"page\"]}")
' "$URLS")

for line in "${LINES[@]}"; do
  IFS=$'\t' read -r slug path module page <<<"$line"
  count=$((count + 1))
  out_dir="$ROOT/downloaded-panel/visitor/${slug}"
  mkdir -p "$out_dir"
  url="https://${DOMAIN}${path}"
  status=$(curl -sS -x "$PROXY" -m 25 -L \
    -A 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' \
    -o "$out_dir/raw.html" \
    -w '%{http_code}|%{size_download}|%{url_effective}' \
    "$url" 2>>"$LOG" || true)
  http=$(cut -d'|' -f1 <<<"$status")
  size=$(cut -d'|' -f2 <<<"$status")
  final=$(cut -d'|' -f3 <<<"$status")
  msg="[$count/32] $slug -> HTTP=$http size=$size final=$final"
  echo "$msg" | tee -a "$LOG"
  if [[ "$http" == "200" && "$size" -gt 1000 ]]; then
    ok=$((ok + 1))
  else
    fail=$((fail + 1))
  fi
done
echo "summary: ok=$ok fail=$fail total=$count" | tee -a "$LOG"
