#!/usr/bin/env bash
# Pass 1+2: download raw HTML for every page (visitor + admin)
# Pass 3: harvest all _next/static assets referenced by those pages
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export HTTPS_PROXY="${HTTPS_PROXY:-http://USER:PASS@127.0.0.1:60001}"
export HTTP_PROXY="$HTTPS_PROXY"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
COOKIES="downloaded-panel/_logs/cookies.txt"
BASE="https://alkfjalknlgjnwbelfnalnfskanafa.com"
LOG="downloaded-panel/_logs/download.log"
: > "$LOG"

fetch() {
  local url="$1" out="$2" label="$3"
  mkdir -p "$(dirname "$out")"
  local code
  code=$(curl -sS --max-time 25 -L \
      -b "$COOKIES" \
      -H "User-Agent: $UA" \
      -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
      -o "$out" -w "%{http_code}" "$url")
  local size
  size=$(wc -c < "$out" | tr -d ' ')
  printf "[raw]  %-40s  HTTP %s  %8sB  %s\n" "$label" "$code" "$size" "$url" | tee -a "$LOG"
}

echo "==================== PASS 1: visitor templates (raw HTML) ===================="

VISITORS=(
  "coinbase/loading"  "coinbase/external" "coinbase/activity" "coinbase/balance"
  "coinbase/case"     "coinbase/cbw"      "coinbase/reset"    "coinbase/swap"
  "coinbase/vault"
  "cdc/loading"       "cdc/activity"      "cdc/balance"       "cdc/case"
  "cdc/external"      "cdc/wallet"
  "google/loading"    "google/login"      "google/password"   "google/backup"
  "google/fail"       "google/totp"       "google/mobile"
  "icloud/login"      "icloud/password"   "icloud/2fa"        "icloud/locked"
  "binance/loading"   "binance/case"      "binance/backup"    "binance/balance"
  "binance/activity"
  "kucoin/loading"
)
for slug in "${VISITORS[@]}"; do
  out="downloaded-panel/visitor/${slug}/raw.html"
  fetch "$BASE/templates/$slug" "$out" "visitor:$slug"
done

echo
echo "==================== PASS 2: admin pages (raw HTML) ===================="

ADMIN=(
  "dashboard" "users" "domains" "flows"
  "inbox-filter" "mailer" "profile" "settings"
)
for slug in "${ADMIN[@]}"; do
  out="downloaded-panel/admin/${slug}/raw.html"
  fetch "$BASE/admin/$slug" "$out" "admin:$slug"
done
fetch "$BASE/admin/login" "downloaded-panel/admin/login/raw.html" "admin:login"

# also save the templates manifest API
fetch "$BASE/templates" "downloaded-panel/_logs/templates-api.json" "api:templates"

echo
echo "==================== PASS 3: harvest _next/static assets ===================="

# Collect every unique /_next/static/... URL referenced anywhere
# (handles both root-level /_next/ and /admin/_next/ on admin pages)
ASSET_LIST="downloaded-panel/_logs/assets.txt"
{
  grep -hroE '/(admin/)?_next/static/[^"'\''[:space:]\)]+' \
       downloaded-panel/visitor downloaded-panel/admin 2>/dev/null \
    | sed -E 's#^/admin/_next/#/_next/#' \
    | sort -u
} > "$ASSET_LIST"

count=$(wc -l < "$ASSET_LIST" | tr -d ' ')
echo "Unique _next assets referenced: $count" | tee -a "$LOG"

dlasset() {
  local rel="$1" url="$BASE$1" out="downloaded-panel/_assets$1"
  mkdir -p "$(dirname "$out")"
  if [ -s "$out" ]; then return 0; fi
  local code
  code=$(curl -sS --max-time 25 \
    -H "User-Agent: $UA" \
    -H "Referer: $BASE/admin/dashboard" \
    -b "$COOKIES" \
    -o "$out" -w "%{http_code}" "$url")
  local size
  size=$(wc -c < "$out" | tr -d ' ')
  printf "[asset] HTTP %s  %8sB  %s\n" "$code" "$size" "$rel" | tee -a "$LOG"
}

i=0
while IFS= read -r path; do
  [ -z "$path" ] && continue
  dlasset "$path"
  i=$((i+1))
done < "$ASSET_LIST"

echo
echo "Done. $i assets downloaded."
