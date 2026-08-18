#!/usr/bin/env bash
# Fail unless GitHub Release v<version> contains every required Mac asset by exact name.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mac-release-assets.sh
source "$root/scripts/mac-release-assets.sh"

VERSION="${2:-$(node -p "require('$root/package.json').version")}"
TAG="${1:-v${VERSION}}"

fail() {
  echo "verify-github-mac-release: $*" >&2
  exit 1
}

command -v gh >/dev/null || fail "gh CLI is required"

ASSETS="$(gh release view "$TAG" --json assets --jq '.assets[].name' | sort)"
[ -n "$ASSETS" ] || fail "GitHub Release ${TAG} has no assets"

MISSING=0
while IFS= read -r name; do
  if ! echo "$ASSETS" | grep -Fxq "$name"; then
    echo "verify-github-mac-release: missing ${name}" >&2
    MISSING=1
  fi
done < <(mac_release_asset_names "$VERSION")

if [ "$MISSING" -ne 0 ]; then
  echo "GitHub Release ${TAG} assets:" >&2
  echo "$ASSETS" >&2
  fail "GitHub Release ${TAG} is incomplete"
fi

echo "verify-github-mac-release: ok (${TAG})"
echo "$ASSETS"
