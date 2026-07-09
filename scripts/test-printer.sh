#!/usr/bin/env bash
set -euo pipefail

PRINTER="QL_820NWB3899"
TEXT="FoxBridge Print Test"

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT

printf '%s\n' "$TEXT" > "$tmpfile"

job_id="$(lp -d "$PRINTER" -t "FoxBridge Print Test" "$tmpfile" | sed -n 's/.*request id is \([^ ]*\).*/\1/p')"

echo "Sent test label to $PRINTER (job $job_id)"
