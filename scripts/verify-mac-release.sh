#!/usr/bin/env bash
# Verify Mac release artifacts after electron-builder.
# CI sets REQUIRE_SIGNED=1 and APPLE_TEAM_ID.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

VERSION="$(node -p "require('./package.json').version")"
APP="release/mac-universal/FoxBridge.app"
BINARY="$APP/Contents/MacOS/FoxBridge"
DMG="release/FoxBridge-${VERSION}-mac-universal.dmg"
ZIP="release/FoxBridge-${VERSION}-mac-universal.zip"
YML="release/latest-mac.yml"
REQUIRE_SIGNED="${REQUIRE_SIGNED:-0}"

fail() {
  echo "verify-mac-release: $*" >&2
  exit 1
}

[ -d "$APP" ] || fail "missing $APP"
[ -f "$DMG" ] || fail "missing $DMG"
[ -f "$ZIP" ] || fail "missing $ZIP"
[ -f "$YML" ] || fail "missing $YML"

if ! lipo -info "$BINARY" 2>/dev/null | grep -q 'x86_64'; then
  fail "universal binary missing x86_64"
fi
if ! lipo -info "$BINARY" 2>/dev/null | grep -q 'arm64'; then
  fail "universal binary missing arm64"
fi
echo "Universal architectures: $(lipo -info "$BINARY")"

YML_BODY="$(cat "$YML")"
echo "$YML_BODY" | grep -q "version: ${VERSION}" || fail "latest-mac.yml version is not ${VERSION}"
echo "$YML_BODY" | grep -q "FoxBridge-${VERSION}-mac-universal.zip" || fail "latest-mac.yml does not reference the universal ZIP"
echo "$YML_BODY" | grep -q 'sha512:' || fail "latest-mac.yml missing sha512"
echo "$YML_BODY" | grep -q 'size:' || fail "latest-mac.yml missing size"
if echo "$YML_BODY" | grep -Eq 'mac-arm64|mac-x64'; then
  fail "latest-mac.yml references a host-arch artifact (arm64/x64) instead of universal"
fi
echo "latest-mac.yml references FoxBridge-${VERSION}-mac-universal.zip"

APP_UPDATE="$APP/Contents/Resources/app-update.yml"
if [ -f "$APP_UPDATE" ]; then
  UPDATE_YML="$(cat "$APP_UPDATE")"
  echo "$UPDATE_YML" | grep -q 'provider: github' || fail "app-update.yml missing GitHub provider"
  echo "$UPDATE_YML" | grep -q 'private: false' || fail "app-update.yml must mark the GitHub repo public"
  if echo "$UPDATE_YML" | grep -Eqi 'token:|GH_TOKEN|github_token'; then
    fail "app-update.yml must not contain a GitHub token"
  fi
  echo "app-update.yml provider=github private=false (no token)"
else
  echo "warning: app-update.yml not found in app bundle"
  if [ "$REQUIRE_SIGNED" = "1" ]; then
    fail "CI release is missing app-update.yml"
  fi
fi

BLOCKMAPS="$(find release -maxdepth 1 -name "FoxBridge-${VERSION}-mac-universal*.blockmap" -print)"
if [ -z "$BLOCKMAPS" ]; then
  echo "warning: no universal blockmap next to the ZIP/DMG (electron-builder may omit it for unsigned local smoke)"
  if [ "$REQUIRE_SIGNED" = "1" ]; then
    fail "CI release is missing blockmap metadata for the universal artifact"
  fi
else
  echo "blockmap files:"
  echo "$BLOCKMAPS"
fi

# Do not ship signing material or env files inside release artifacts.
SECRET_HITS="$(
  find release -type f \( \
    -name '*.p12' -o -name '*.p8' -o -name '.env' -o -name '.env.*' \
    -o -name 'secrets.bin' -o -name 'AuthKey_*.p8' \
  \) 2>/dev/null || true
)"
if [ -n "$SECRET_HITS" ]; then
  fail "release artifacts contain signing or secret files"
fi

if [ "$REQUIRE_SIGNED" != "1" ]; then
  echo "REQUIRE_SIGNED is not set; skipping Developer ID / notarization checks (local unsigned smoke)."
  exit 0
fi

codesign --verify --deep --strict --verbose=2 "$APP"

SIGN_INFO="$(codesign -dv --verbose=4 "$APP" 2>&1)"
echo "$SIGN_INFO"

echo "$SIGN_INFO" | grep -q 'Authority=Developer ID Application' || fail "app is not signed with Developer ID Application"
echo "$SIGN_INFO" | grep -q 'TeamIdentifier=' || fail "TeamIdentifier missing"

TEAM_LINE="$(echo "$SIGN_INFO" | grep 'TeamIdentifier=' | head -n 1)"
TEAM_VALUE="${TEAM_LINE#TeamIdentifier=}"
if [ -z "$TEAM_VALUE" ] || [ "$TEAM_VALUE" = "not set" ]; then
  fail "TeamIdentifier is not set"
fi
if [ -n "${APPLE_TEAM_ID:-}" ] && [ "$TEAM_VALUE" != "$APPLE_TEAM_ID" ]; then
  fail "TeamIdentifier does not match APPLE_TEAM_ID"
fi

echo "$SIGN_INFO" | grep -Eq 'flags=.*(runtime|0x10000)' || fail "Hardened Runtime is not enabled"

if ! echo "$SIGN_INFO" | grep -q 'Signature=adhoc'; then
  echo "Signature is not ad-hoc (expected for production)."
else
  fail "app is still ad-hoc signed"
fi

echo "Stapler (app):"
xcrun stapler validate "$APP"

if xcrun stapler validate "$DMG"; then
  echo "Stapler (dmg): The validate action worked!"
else
  echo "Stapler (dmg): ticket not attached to DMG; app staple succeeded (acceptable if Apple stapled the app only)."
fi

echo "Gatekeeper assessment:"
if spctl --assess --verbose=4 --type execute "$APP"; then
  echo "spctl accepted the app."
else
  fail "spctl --assess rejected the app"
fi

echo "verify-mac-release: ok"
