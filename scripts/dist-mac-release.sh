#!/usr/bin/env bash
# Signed + notarized universal Mac build. Does not publish a GitHub Release.
# Used by maintainers with Apple credentials, and as the CI smoke packaging command.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ -z "${CSC_LINK:-}" ] || [ -z "${CSC_KEY_PASSWORD:-}" ]; then
  echo "dist:mac:release requires signing credentials (CSC_LINK + CSC_KEY_PASSWORD)."
  echo "GitHub Actions maps MAC_CSC_LINK / MAC_CSC_KEY_PASSWORD to those names."
  echo "For an unsigned local smoke build, use: npm run dist:mac"
  exit 1
fi

if [ -z "${APPLE_ID:-}" ] || [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
  echo "dist:mac:release requires notarization credentials:"
  echo "  APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID"
  echo "For an unsigned local smoke build, use: npm run dist:mac"
  exit 1
fi

npm run build
exec npx electron-builder --mac --publish never -c.forceCodeSigning=true
