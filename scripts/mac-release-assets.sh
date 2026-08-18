#!/usr/bin/env bash
# Canonical production Mac GitHub Release asset set.
# Call: mac_release_asset_names <version>
# Prints one filename per line. No globs.

mac_release_asset_names() {
  local version="${1:?version required}"
  cat <<EOF
FoxBridge-${version}-mac-universal.dmg
FoxBridge-${version}-mac-universal.dmg.blockmap
FoxBridge-${version}-mac-universal.zip
FoxBridge-${version}-mac-universal.zip.blockmap
latest-mac.yml
EOF
}
