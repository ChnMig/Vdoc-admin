#!/bin/sh
set -eu

config_file="${VDOC_ADMIN_RUNTIME_CONFIG_PATH:-/usr/share/caddy/runtime-config.js}"
api_base_url="${VDOC_ADMIN_API_BASE_URL:-${VITE_VDOC_API_BASE_URL:-}}"

if [ -z "$api_base_url" ]; then
  api_base_url="http://127.0.0.1:8080"
  printf '%s\n' "VDOC_ADMIN_API_BASE_URL is not set; using local dev/demo fallback ${api_base_url}." >&2
fi

while [ "${api_base_url%/}" != "$api_base_url" ]; do
  api_base_url="${api_base_url%/}"
done

reject_api_base_url() {
  printf '%s\n' "VDOC_ADMIN_API_BASE_URL must be an exact HTTPS origin (HTTP is allowed only for localhost/loopback development) without credentials, path, query, fragment, or control characters." >&2
  exit 1
}

newline='
'
case "$api_base_url" in
  *"$newline"*) reject_api_base_url ;;
esac

if printf '%s' "$api_base_url" | LC_ALL=C grep -q '[[:cntrl:]]'; then
  reject_api_base_url
fi

if ! printf '%s\n' "$api_base_url" | grep -Eq '^https?://([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?$'; then
  reject_api_base_url
fi

authority="${api_base_url#*://}"
scheme="${api_base_url%%://*}"
port=""
case "$authority" in
  \[*\]:*) port="${authority##*:}" ;;
  \[*\]) ;;
  *:*) port="${authority##*:}" ;;
esac
if [ -n "$port" ] && { [ "$port" -eq 0 ] || [ "$port" -gt 65535 ]; }; then
  reject_api_base_url
fi

host="$authority"
case "$host" in
  \[*\]:*) host="${host%:*}" ;;
  \[*\]) ;;
  *:*) host="${host%:*}" ;;
esac
if [ "$scheme" = "http" ]; then
  case "$host" in
    localhost|*.localhost|127.0.0.1|\[::1\]) ;;
    *) reject_api_base_url ;;
  esac
fi

export VDOC_PUBLIC_SHARE_CONNECT_SRC="$api_base_url"

escaped_api_base_url=$(printf '%s' "$api_base_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
tmp_file="${config_file}.tmp"

{
  printf '%s\n' 'window.__VDOC_ADMIN_CONFIG__ = {'
  printf '  apiBaseUrl: "%s"\n' "$escaped_api_base_url"
  printf '%s\n' '};'
} > "$tmp_file"

mv "$tmp_file" "$config_file"

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
