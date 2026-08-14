FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY docker-entrypoint.sh /usr/local/bin/vdoc-admin-entrypoint.sh
COPY --from=builder /app/dist /usr/share/caddy

RUN addgroup -S vdoc-admin \
    && adduser -S -D -H -G vdoc-admin vdoc-admin \
    && mkdir -p /config/caddy /data/caddy \
    && chown -R vdoc-admin:vdoc-admin /usr/share/caddy /config /data \
    && chmod +x /usr/local/bin/vdoc-admin-entrypoint.sh

EXPOSE 8080

USER vdoc-admin

ENTRYPOINT ["/usr/local/bin/vdoc-admin-entrypoint.sh"]
