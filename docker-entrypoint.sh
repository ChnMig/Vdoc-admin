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

escaped_api_base_url=$(printf '%s' "$api_base_url" | sed 's/\\/\\\\/g; s/"/\\"/g')
tmp_file="${config_file}.tmp"

{
  printf '%s\n' 'window.__VDOC_ADMIN_CONFIG__ = {'
  printf '  apiBaseUrl: "%s"\n' "$escaped_api_base_url"
  printf '%s\n' '};'
} > "$tmp_file"

mv "$tmp_file" "$config_file"

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
