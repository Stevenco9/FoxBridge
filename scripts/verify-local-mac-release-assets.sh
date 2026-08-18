#!/usr/bin/env bash
# Fail unless the exact production Mac asset set exists locally and latest-mac.yml
# matches the ZIP that will be published.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=mac-release-assets.sh
source "$root/scripts/mac-release-assets.sh"
cd "$root"

VERSION="$(node -p "require('./package.json').version")"
DIR="${1:-release}"

fail() {
  echo "verify-local-mac-release-assets: $*" >&2
  exit 1
}

while IFS= read -r name; do
  [ -f "${DIR}/${name}" ] || fail "missing required file ${DIR}/${name}"
done < <(mac_release_asset_names "$VERSION")

YML="${DIR}/latest-mac.yml"
ZIP="${DIR}/FoxBridge-${VERSION}-mac-universal.zip"
YML_BODY="$(cat "$YML")"

echo "$YML_BODY" | grep -q "version: ${VERSION}" || fail "latest-mac.yml version is not ${VERSION}"
echo "$YML_BODY" | grep -q "path: FoxBridge-${VERSION}-mac-universal.zip" || fail "latest-mac.yml primary path is not the universal ZIP"
echo "$YML_BODY" | grep -q 'sha512:' || fail "latest-mac.yml missing sha512"
echo "$YML_BODY" | grep -q 'size:' || fail "latest-mac.yml missing size"
echo "$YML_BODY" | grep -q 'releaseDate:' || fail "latest-mac.yml missing releaseDate"

EXPECTED_SHA="$(
  awk '
    $1 == "path:" && $2 == "FoxBridge-'"${VERSION}"'-mac-universal.zip" { want=1; next }
    want && $1 == "sha512:" { print $2; exit }
  ' "$YML"
)"
[ -n "$EXPECTED_SHA" ] || fail "could not read primary sha512 from latest-mac.yml"

ACTUAL_SHA="$(openssl dgst -sha512 -binary "$ZIP" | base64)"
[ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] || fail "ZIP sha512 does not match latest-mac.yml (do not rewrite latest-mac.yml)"

ZIP_SIZE="$(wc -c < "$ZIP" | tr -d ' ')"
echo "$YML_BODY" | grep -q "size: ${ZIP_SIZE}" || fail "latest-mac.yml size does not match ZIP byte length ${ZIP_SIZE}"

echo "verify-local-mac-release-assets: ok (${DIR}, version ${VERSION})"
