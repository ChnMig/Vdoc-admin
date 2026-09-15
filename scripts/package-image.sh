#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
tag="${1:-}"
arch="${2:-}"
output="${3:-$ROOT_DIR/.artifacts/images}"
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo 'Invalid release tag' >&2; exit 1; }
[[ "$arch" == amd64 || "$arch" == arm64 ]] || { echo 'Use amd64 or arm64' >&2; exit 1; }
[[ -z "$(git -C "$ROOT_DIR" status --porcelain=v1 --untracked-files=all)" ]] || { echo 'Commit source changes before packaging a release image' >&2; exit 1; }
commit="$(git -C "$ROOT_DIR" rev-parse HEAD)"
build_time="$(git -C "$ROOT_DIR" show -s --format=%cI HEAD)"
image="vdoc-admin:$tag"
mkdir -p "$output"
output="$(cd "$output" && pwd -P)"
docker build --platform "linux/$arch" --tag "$image" \
  --build-arg "VERSION=$tag" --build-arg "GIT_COMMIT=$commit" \
  --build-arg "BUILD_TIME=$build_time" "$ROOT_DIR"
[[ "$(docker image inspect "$image" --format '{{.Architecture}}')" == "$arch" ]]
container="$(docker run -d --rm --platform "linux/$arch" -p 127.0.0.1::8080 -e VDOC_ADMIN_API_BASE_URL=http://127.0.0.1:8080 "$image")"
trap 'docker stop "$container" >/dev/null' EXIT
port="$(docker port "$container" 8080/tcp)"
ready=0
for attempt in {1..30}; do
  if curl -fsS "http://$port/runtime-config.js" | grep -F 'http://127.0.0.1:8080'; then ready=1; break; fi
  sleep 1
done
[[ "$ready" == 1 ]] || { echo 'Admin image failed its runtime configuration smoke test' >&2; exit 1; }
curl -fsS "http://$port/" >/dev/null
docker stop "$container" >/dev/null
trap - EXIT
archive="vdoc-admin_${tag}_linux_${arch}.docker.tar.gz"
docker save "$image" | gzip -n >"$output/$archive"
(cd "$output" && shasum -a 256 "$archive" >"$archive.sha256")
printf 'Prepared %s\n' "$output/$archive"
