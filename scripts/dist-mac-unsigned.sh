#!/usr/bin/env bash
# Local / maintainer smoke: universal Mac DMG + ZIP, unsigned, not notarized.
# Do not distribute this output as a production release.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

echo "WARNING: npm run dist:mac produces an UNSIGNED local smoke build."
echo "It is not a production release. Production Mac builds are signed and"
echo "notarized by GitHub Actions (.github/workflows/release-mac.yml)."
echo

npm run build

export CSC_IDENTITY_AUTO_DISCOVERY=false
exec npx electron-builder --mac --publish never -c.mac.notarize=false
