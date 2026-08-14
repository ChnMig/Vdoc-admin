#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

printf '%s\n' '#!/bin/sh' 'printf "%s" "$VDOC_PUBLIC_SHARE_CONNECT_SRC" > "$VDOC_ENTRYPOINT_CAPTURE"' > "$tmp_dir/caddy"
chmod +x "$tmp_dir/caddy"

run_valid() {
  origin="$1"
  expected="$2"
  runtime_config="$tmp_dir/runtime-config.js"
  capture="$tmp_dir/connect-src.txt"
  PATH="$tmp_dir:$PATH" \
    VDOC_ADMIN_RUNTIME_CONFIG_PATH="$runtime_config" \
    VDOC_ADMIN_API_BASE_URL="$origin" \
    VDOC_ENTRYPOINT_CAPTURE="$capture" \
    sh "$root_dir/docker-entrypoint.sh"
  grep -Fq "apiBaseUrl: \"$expected\"" "$runtime_config" || fail "runtime config did not contain normalized origin $expected"
  [ "$(sed -n '1p' "$capture")" = "$expected" ] || fail "CSP connect-src capture did not equal $expected"
}

assert_rejected() {
  origin="$1"
  if PATH="$tmp_dir:$PATH" \
    VDOC_ADMIN_RUNTIME_CONFIG_PATH="$tmp_dir/rejected-runtime-config.js" \
    VDOC_ADMIN_API_BASE_URL="$origin" \
    VDOC_ENTRYPOINT_CAPTURE="$tmp_dir/rejected-connect-src.txt" \
    sh "$root_dir/docker-entrypoint.sh" >"$tmp_dir/rejected.stdout" 2>"$tmp_dir/rejected.stderr"; then
    fail "invalid origin was accepted"
  fi
}

run_valid 'https://api.example.test:8443/' 'https://api.example.test:8443'
run_valid 'http://127.0.0.1:8080' 'http://127.0.0.1:8080'
run_valid 'http://preview.localhost:8080' 'http://preview.localhost:8080'
run_valid 'http://[::1]:8080' 'http://[::1]:8080'

newline='
'
carriage_return=$(printf '\r')
tab=$(printf '\t')
assert_rejected 'https://api.example.test/path'
assert_rejected 'https://user:pass@api.example.test'
assert_rejected 'https://api.example.test?query=1'
assert_rejected 'https://api.example.test#fragment'
assert_rejected "https://api.example.test${newline}injected.example.test"
assert_rejected "https://api.example.test${carriage_return}injected.example.test"
assert_rejected "https://api.example.test${tab}injected.example.test"
assert_rejected 'https://api.example.test:0'
assert_rejected 'https://api.example.test:65536'
assert_rejected 'http://api.example.test'
assert_rejected 'http://127.example.test'

printf 'ok\n'
