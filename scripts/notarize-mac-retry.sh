#!/usr/bin/env bash
# Submit a signed Mac .app to Apple notarytool with bounded retries.
# Called from electron-builder afterSign (scripts/notarize-mac.cjs).
# Does not rebuild or re-sign. Never prints Apple credentials.
set -euo pipefail

APP_PATH="${1:?app path required}"
MAX_ATTEMPTS="${NOTARIZE_MAX_ATTEMPTS:-3}"
WAIT_TIMEOUT="${NOTARIZE_WAIT_TIMEOUT:-15m}"
# Seconds to wait before attempts 2 and 3.
BACKOFF_SECONDS=(60 180)

if [ ! -d "$APP_PATH" ]; then
  echo "notarize-mac-retry: missing app at $APP_PATH" >&2
  exit 1
fi

: "${APPLE_ID:?APPLE_ID is required}"
: "${APPLE_APP_SPECIFIC_PASSWORD:?APPLE_APP_SPECIFIC_PASSWORD is required}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required}"

echo "SIGNING SUCCESS"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/foxbridge-notary.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

NOTARY_ZIP="$WORKDIR/FoxBridge-notary.zip"
LOG="$WORKDIR/notarytool.log"

echo "Packaging app for notarytool submit (temporary zip, not a release artifact)..."
ditto -c -k --keepParent "$APP_PATH" "$NOTARY_ZIP"

print_notary_log() {
  local text
  text="$(cat "$LOG")"
  text="${text//${APPLE_APP_SPECIFIC_PASSWORD}/[redacted]}"
  text="${text//${APPLE_ID}/[redacted]}"
  printf '%s\n' "$text"
}

is_deterministic_failure() {
  grep -qiE \
    'status:[[:space:]]*Invalid|Invalid signature|invalid entitlements|package Invalid|not signed with a valid Developer ID|Hardened Runtime is not enabled|authentication (failed|failure)|invalid (username|password|credentials)|HTTP status code: 401|HTTP status code: 403|unauthorized|Your Apple ID or password was incorrect' \
    "$LOG"
}

is_transient_failure() {
  grep -qiE \
    'NSURLErrorDomain|-1009|-1001|-1005|-1200|appears to be offline|The Internet connection|timed?[[:space:]]*out|timeout|ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|network is unreachable|temporarily unavailable|HTTP status code: 5[0-9]{2}|App Store Connect is unavailable|connection was lost|unexpected EOF|DNS' \
    "$LOG"
}

success=0
attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if [ "$attempt" -gt 1 ]; then
    echo "NOTARIZATION RETRY $attempt"
    delay_index=$((attempt - 2))
    delay="${BACKOFF_SECONDS[$delay_index]:-300}"
    echo "Waiting ${delay}s before retry (no rebuild, no re-sign)..."
    sleep "$delay"
  fi

  echo "NOTARIZATION SUBMITTED (attempt ${attempt}/${MAX_ATTEMPTS}, wait timeout ${WAIT_TIMEOUT})"
  set +e
  xcrun notarytool submit "$NOTARY_ZIP" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait \
    --timeout "$WAIT_TIMEOUT" \
    >"$LOG" 2>&1
  status=$?
  set -e

  print_notary_log

  if [ "$status" -eq 0 ]; then
    echo "NOTARIZATION ACCEPTED"
    success=1
    break
  fi

  if is_deterministic_failure; then
    echo "Notarization rejected with a deterministic error. Not retrying."
    exit 1
  fi

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    break
  fi

  if is_transient_failure; then
    echo "Transient notarization failure (network/service)."
  else
    echo "Unclassified notarization failure; retrying as potentially transient."
  fi

  attempt=$((attempt + 1))
done

if [ "$success" -ne 1 ]; then
  echo "Notarization failed after ${MAX_ATTEMPTS} attempts."
  exit 1
fi

echo "Stapling notarization ticket to app..."
xcrun stapler staple "$APP_PATH"
xcrun stapler validate "$APP_PATH"
echo "STAPLE VERIFIED"
