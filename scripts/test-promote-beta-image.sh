#!/usr/bin/env bash
set -euo pipefail

root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
stage="$(mktemp -d)"
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/bin"
cat >"$stage/bin/gh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$TEST_GH_CALLS"
cat "$TEST_RELEASES_FILE"
SH
cat >"$stage/bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$TEST_DOCKER_CALLS"
# A beta promotion must never read or write the stable channel.
[[ "$*" != *:latest* ]] || exit 1
case "$*" in
  'login '*) cat >/dev/null ;;
  'buildx imagetools inspect '*)
    if [[ "$*" == *'--raw' ]]; then
      if [[ -n "${TEST_PLATFORMS:-}" ]]; then
        printf '%s\n' "$TEST_PLATFORMS"
      else
        printf '%s\n' '{"manifests":[{"platform":{"os":"linux","architecture":"amd64"}},{"platform":{"os":"linux","architecture":"arm64"}}]}'
      fi
    elif [[ "$4" == *:beta ]]; then
      printf '%s\n' "${TEST_FINAL_DIGEST:-$TEST_DIGEST}"
    else
      printf '%s\n' "$TEST_DIGEST"
    fi ;;
  'buildx imagetools create '*) ;;
  *) exit 1 ;;
esac
SH
chmod +x "$stage/bin/gh" "$stage/bin/docker"
export PATH="$stage/bin:$PATH"
export GH_TOKEN=disposable-test-token GITHUB_ACTOR=test GITHUB_REPOSITORY=ChnMig/Test
export TEST_RELEASES_FILE="$stage/releases.json" TEST_DOCKER_CALLS="$stage/docker.calls" TEST_GH_CALLS="$stage/gh.calls"
export TEST_DIGEST="sha256:$(printf 'a%.0s' {1..64})"
valid_digest="$TEST_DIGEST"

releases() {
  printf '%s\n' "$1" >"$TEST_RELEASES_FILE"
  : >"$TEST_DOCKER_CALLS"
  : >"$TEST_GH_CALLS"
}
fail() { printf 'FAIL: %s\n' "$1" >&2; exit 1; }
run() { bash "$root/scripts/promote-beta-image.sh" "$1" >"$stage/output" 2>&1; }
expect_promotion() {
  : >"$TEST_DOCKER_CALLS"
  run "$1" || { cat "$stage/output"; fail "beta $1 was rejected"; }
  grep -Fq "create --tag ghcr.io/chnmig/test:beta ghcr.io/chnmig/test@$TEST_DIGEST" "$TEST_DOCKER_CALLS" || fail 'promotion did not use the verified index digest'
  if grep -Fq ':latest' "$TEST_DOCKER_CALLS"; then fail 'beta touched latest'; fi
}
expect_skip() {
  : >"$TEST_DOCKER_CALLS"
  run "$1" || { cat "$stage/output"; fail "$1 should skip promotion"; }
  [[ ! -s "$TEST_DOCKER_CALLS" ]] || fail "$1 touched the registry"
}
expect_rejected() {
  : >"$TEST_DOCKER_CALLS"
  if run "$1"; then fail "$1 was accepted"; fi
  [[ ! -s "$TEST_DOCKER_CALLS" ]] || fail "$1 touched the registry"
}
expect_no_promotion() {
  : >"$TEST_DOCKER_CALLS"
  if run "$1"; then fail "$2 was accepted"; fi
  if grep -Fq 'imagetools create' "$TEST_DOCKER_CALLS"; then fail "$2 was promoted"; fi
}

releases '[[{"tag_name":"v0.3.16-beta.9","draft":false,"prerelease":true}],[{"tag_name":"v0.3.16-beta.10","draft":false,"prerelease":true},{"tag_name":"v9.0.0-beta.1","draft":true,"prerelease":true},{"tag_name":"v8.0.0-beta.1","draft":false,"prerelease":false},{"tag_name":"v7.0.0-rc.1","draft":false,"prerelease":true},{"tag_name":"v6.0.0","draft":false,"prerelease":false}]]'
expect_promotion v0.3.16-beta.10
expect_skip v0.3.16-beta.9
expect_rejected v9.0.0-beta.1
expect_rejected v8.0.0-beta.1
expect_rejected v10.0.0-beta.1
: >"$TEST_DOCKER_CALLS"
bash "$root/scripts/promote-latest-image.sh" v0.3.16-beta.10 >"$stage/output" 2>&1 || fail 'latest promotion should skip beta'
[[ ! -s "$TEST_DOCKER_CALLS" ]] || fail 'the latest promotion step touched the registry for beta'

# Stable and other valid prereleases skip before credentials/API/registry access.
: >"$TEST_GH_CALLS"
for tag in v1.0.0 v1.0.0-rc.1 v1.0.0-alpha.1 v1.0.0-beta v1.0.0-beta.1.extra v1.0.0-beta.-1; do
  expect_skip "$tag"
done
[[ ! -s "$TEST_GH_CALLS" ]] || fail 'non-beta releases queried the release API'
if ! env -u GH_TOKEN -u GITHUB_ACTOR -u GITHUB_REPOSITORY bash "$root/scripts/promote-beta-image.sh" v1.0.0 >"$stage/output" 2>&1; then
  fail 'stable skip required credentials'
fi
for tag in v01.0.0-beta.1 v1.00.0-beta.1 v1.0.00-beta.1 v1.0.0-beta.01 v1.0.0-beta. v1.0.0-beta.1.. v1.0.0-beta.1+build 1.0.0-beta.1 garbage; do
  expect_rejected "$tag"
done

# Base components take precedence over the beta counter, using numeric ordering.
for pair in 'v0.9.99-beta.999 v0.10.0-beta.0' 'v0.10.9-beta.999 v0.10.10-beta.0' 'v9.99.99-beta.999 v10.0.0-beta.0' 'v0.3.16-beta.9007199254740992 v0.3.16-beta.9007199254740993'; do
  read -r older newer <<<"$pair"
  releases "[[{\"tag_name\":\"$newer\",\"draft\":false,\"prerelease\":true},{\"tag_name\":\"$older\",\"draft\":false,\"prerelease\":true}]]"
  expect_promotion "$newer"
  expect_skip "$older"
done

releases '[[{"tag_name":"v0.3.16-beta.0","draft":false,"prerelease":true}]]'
expect_promotion v0.3.16-beta.0
export TEST_PLATFORMS='{"manifests":[{"platform":{"os":"linux","architecture":"amd64"}}]}'
expect_no_promotion v0.3.16-beta.0 'single-platform image'
export TEST_PLATFORMS='{"manifests":[{"platform":{"os":"linux","architecture":"arm64"}},{"platform":{"os":"windows","architecture":"amd64"}}]}'
expect_no_promotion v0.3.16-beta.0 'non-Linux amd64 image'
export TEST_PLATFORMS='{"mediaType":"application/vnd.oci.image.manifest.v1+json"}'
expect_no_promotion v0.3.16-beta.0 'non-index manifest'
unset TEST_PLATFORMS
export TEST_DIGEST='sha256:invalid'
expect_no_promotion v0.3.16-beta.0 'invalid source digest'
export TEST_DIGEST="$valid_digest"
export TEST_FINAL_DIGEST="sha256:$(printf 'b%.0s' {1..64})"
if run v0.3.16-beta.0; then fail 'incorrect published digest was accepted'; fi
if grep -Fq ':latest' "$TEST_DOCKER_CALLS"; then fail 'beta touched latest'; fi
printf 'PASS: beta promotion, numeric ordering, channel isolation, release guards, platform validation and digest verification\n'
