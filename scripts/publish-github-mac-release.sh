#!/usr/bin/env bash
# Publish the exact local Mac asset set to GitHub Release v<version>.
# Does not invoke electron-builder publish. Fails if any required upload is missing.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mac-release-assets.sh
source "$root/scripts/mac-release-assets.sh"
cd "$root"

VERSION="$(node -p "require('./package.json').version")"
TAG="v${VERSION}"
DIR="${1:-release}"

fail() {
  echo "publish-github-mac-release: $*" >&2
  exit 1
}

command -v gh >/dev/null || fail "gh CLI is required"
[ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ] || fail "GH_TOKEN or GITHUB_TOKEN is required"

bash "$root/scripts/verify-local-mac-release-assets.sh" "$DIR"

FILES=()
while IFS= read -r name; do
  FILES+=("${DIR}/${name}")
done < <(mac_release_asset_names "$VERSION")

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "GitHub Release ${TAG} already exists; uploading the exact asset set."
  gh release upload "$TAG" "${FILES[@]}" --clobber
else
  echo "Creating GitHub Release ${TAG} with the exact asset set."
  gh release create "$TAG" "${FILES[@]}" --title "$VERSION" --verify-tag
fi

bash "$root/scripts/verify-github-mac-release.sh" "$TAG" "$VERSION"
echo "publish-github-mac-release: ok (${TAG})"
