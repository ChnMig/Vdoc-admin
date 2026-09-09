#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
release_tag="${1:-}"
[[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || {
  printf 'Use pnpm release:package vMAJOR.MINOR.PATCH (optionally with a prerelease suffix)\n' >&2
  exit 1
}
[[ -f "$ROOT_DIR/dist/index.html" && -f "$ROOT_DIR/dist/runtime-config.js" ]] || {
  printf 'Run pnpm build before packaging the Admin release\n' >&2
  exit 1
}

artifact_name="vdoc-admin_$release_tag"
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/$artifact_name"
COPYFILE_DISABLE=1 cp -R "$ROOT_DIR/dist/." "$stage/$artifact_name/"
cp "$ROOT_DIR/LICENSE" "$ROOT_DIR/THIRD_PARTY_NOTICES.md" "$ROOT_DIR/README.md" "$stage/$artifact_name/"
COPYFILE_DISABLE=1 tar -czf "$stage/$artifact_name.tar.gz" -C "$stage" "$artifact_name"
(
  cd "$stage"
  shasum -a 256 "$artifact_name.tar.gz" >SHA256SUMS
)
output="$ROOT_DIR/.artifacts/release"
mkdir -p "$output"
rm -f -- "$output"/*.tar.gz "$output/SHA256SUMS"
cp "$stage/$artifact_name.tar.gz" "$stage/SHA256SUMS" "$output/"
printf 'Admin release prepared: %s\n' "$output/$artifact_name.tar.gz"
