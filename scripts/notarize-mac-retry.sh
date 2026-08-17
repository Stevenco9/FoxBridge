#!/usr/bin/env bash
# Submit a signed Mac .app to Apple notarytool ONCE, then poll that submission.
# Called from electron-builder afterSign (scripts/notarize-mac.cjs).
# Does not rebuild, re-sign, or resubmit after a submission ID is known.
# Never prints Apple credentials.
set -euo pipefail

APP_PATH="${1:?app path required}"
POLL_INTERVAL="${NOTARIZE_POLL_INTERVAL_SECONDS:-60}"
OVERALL_TIMEOUT="${NOTARIZE_OVERALL_TIMEOUT_SECONDS:-10800}"
NETWORK_RETRIES="${NOTARIZE_NETWORK_RETRIES:-5}"

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

notary_auth() {
  # Intentionally does not echo credentials.
  xcrun notarytool "$@" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --output-format json
}

print_notary_log() {
  local text
  text="$(cat "$LOG")"
  text="${text//${APPLE_APP_SPECIFIC_PASSWORD}/[redacted]}"
  text="${text//${APPLE_ID}/[redacted]}"
  printf '%s\n' "$text"
}

json_field() {
  python3 - "$LOG" "$1" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
text = open(path, errors="replace").read()
start = text.find("{")
end = text.rfind("}")
if start < 0 or end < start:
    sys.exit(1)
obj = json.loads(text[start : end + 1])
value = obj.get(key, "")
if value is None:
    value = ""
print(value)
PY
}

is_auth_or_package_failure() {
  grep -qiE \
    'Invalid signature|invalid entitlements|package Invalid|not signed with a valid Developer ID|Hardened Runtime is not enabled|authentication (failed|failure)|invalid (username|password|credentials)|HTTP status code: 401|HTTP status code: 403|unauthorized|Your Apple ID or password was incorrect' \
    "$LOG"
}

is_transient_network() {
  grep -qiE \
    'NSURLErrorDomain|-1009|-1001|-1005|-1200|appears to be offline|The Internet connection|timed?[[:space:]]*out|timeout|ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|network is unreachable|temporarily unavailable|HTTP status code: 5[0-9]{2}|App Store Connect is unavailable|connection was lost|unexpected EOF|DNS' \
    "$LOG"
}

now_epoch() {
  date +%s
}

run_notary() {
  set +e
  notary_auth "$@" >"$LOG" 2>&1
  local status=$?
  set -e
  return "$status"
}

# --- Submit once (retry only the upload if the network fails before an ID) ---
submission_id=""
submit_try=1
while [ -z "$submission_id" ] && [ "$submit_try" -le "$NETWORK_RETRIES" ]; do
  echo "Submitting signed app to Apple notary service (try ${submit_try}/${NETWORK_RETRIES})..."
  if run_notary submit "$NOTARY_ZIP"; then
    print_notary_log
    submission_id="$(json_field id || true)"
    if [ -n "$submission_id" ]; then
      break
    fi
    echo "notarytool submit succeeded but no submission id was parsed."
  else
    print_notary_log
    if is_auth_or_package_failure; then
      echo "Notarization submit failed with an authentication or package error. Not retrying."
      exit 1
    fi
    if ! is_transient_network; then
      echo "Notarization submit failed with an unclassified error."
      if [ "$submit_try" -ge "$NETWORK_RETRIES" ]; then
        exit 1
      fi
    fi
    echo "Transient network failure during submit (no submission id yet)."
  fi
  submit_try=$((submit_try + 1))
  if [ "$submit_try" -le "$NETWORK_RETRIES" ]; then
    sleep 15
  fi
done

if [ -z "$submission_id" ]; then
  echo "Could not obtain a notarization submission id."
  exit 1
fi

echo "NOTARIZATION SUBMITTED: ${submission_id}"

# --- Poll the existing submission until Accepted / Invalid or overall timeout ---
deadline=$(( $(now_epoch) + OVERALL_TIMEOUT ))

while [ "$(now_epoch)" -lt "$deadline" ]; do
  info_ok=0
  poll_try=1
  while [ "$poll_try" -le "$NETWORK_RETRIES" ]; do
    if run_notary info "$submission_id"; then
      print_notary_log
      info_ok=1
      break
    fi
    print_notary_log
    if is_auth_or_package_failure; then
      echo "notarytool info failed with an authentication error. Not retrying."
      exit 1
    fi
    echo "NOTARIZATION POLL RETRY"
    poll_try=$((poll_try + 1))
    if [ "$poll_try" -le "$NETWORK_RETRIES" ]; then
      sleep 15
    fi
  done

  if [ "$info_ok" -ne 1 ]; then
    if [ "$(now_epoch)" -ge "$deadline" ]; then
      break
    fi
    echo "NOTARIZATION STATUS: In Progress"
    echo "Poll network failed; waiting ${POLL_INTERVAL}s then retrying info for ${submission_id} (no resubmit)."
    sleep "$POLL_INTERVAL"
    continue
  fi

  status_value="$(json_field status || true)"
  echo "NOTARIZATION STATUS: ${status_value:-unknown}"

  case "$(printf '%s' "$status_value" | tr '[:upper:]' '[:lower:]')" in
    accepted)
      echo "NOTARIZATION ACCEPTED"
      echo "Stapling notarization ticket to app..."
      xcrun stapler staple "$APP_PATH"
      xcrun stapler validate "$APP_PATH"
      echo "STAPLE VERIFIED"
      exit 0
      ;;
    invalid|rejected)
      echo "Notarization reached terminal failure (${status_value}). Fetching Apple log; not resubmitting."
      if run_notary log "$submission_id"; then
        print_notary_log
      else
        print_notary_log
      fi
      exit 1
      ;;
    *)
      remaining=$(( deadline - $(now_epoch) ))
      if [ "$remaining" -le 0 ]; then
        break
      fi
      sleep "$POLL_INTERVAL"
      ;;
  esac
done

echo "Notarization timed out after ${OVERALL_TIMEOUT}s while polling submission ${submission_id}."
echo "The submission was not resubmitted. Check Apple Notary history for this id."
exit 1
