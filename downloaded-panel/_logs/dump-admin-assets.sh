#!/usr/bin/env bash
# Pass 3b: fetch admin-specific _next chunks from /admin/_next/...
set -uo pipefail
cd "$(cd "$(dirname "$0")/../.." && pwd)"

export HTTPS_PROXY="${HTTPS_PROXY:-http://USER:PASS@127.0.0.1:60001}"
export HTTP_PROXY="$HTTPS_PROXY"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
COOKIES="downloaded-panel/_logs/cookies.txt"
BASE="https://alkfjalknlgjnwbelfnalnfskanafa.com"

# Drop the failed (404) shared-path attempts so we re-fetch from /admin/_next/
find downloaded-panel/_assets -type f -size 9c -delete 2>/dev/null || true

# Re-extract every /admin/_next/... reference verbatim, no rewriting
ASSET_LIST="downloaded-panel/_logs/admin-assets.txt"
grep -hroE '/admin/_next/static/[^"'\''[:space:]\)]+' downloaded-panel/admin 2>/dev/null \
  | sort -u > "$ASSET_LIST"

count=$(wc -l < "$ASSET_LIST" | tr -d ' ')
echo "Admin-prefixed _next assets: $count"

dlasset() {
  local rel="$1" url="$BASE$1" out="downloaded-panel/_assets$1"
  mkdir -p "$(dirname "$out")"
  if [ -s "$out" ] && [ "$(wc -c < "$out" | tr -d ' ')" -gt 100 ]; then return 0; fi
  local code
  code=$(curl -sS --max-time 25 \
    -H "User-Agent: $UA" \
    -H "Referer: $BASE/admin/dashboard" \
    -b "$COOKIES" \
    -o "$out" -w "%{http_code}" "$url")
  local size
  size=$(wc -c < "$out" | tr -d ' ')
  printf "[admin-asset] HTTP %s  %8sB  %s\n" "$code" "$size" "$rel"
}

while IFS= read -r path; do
  [ -z "$path" ] && continue
  dlasset "$path"
done < "$ASSET_LIST"

echo "Done."
