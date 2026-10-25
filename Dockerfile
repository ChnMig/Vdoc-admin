FROM node:26.12.1-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS builder

ARG VERSION
ARG BUILD_TIME
ARG GIT_COMMIT

RUN test -n "$VERSION" \
    && test "$VERSION" != dev \
    && test -n "$BUILD_TIME" \
    && test "$BUILD_TIME" != unknown \
    && printf '%s' "$GIT_COMMIT" | grep -Eq '^[0-9a-f]{40}(-dirty)?$'

WORKDIR /app

RUN npm install --global pnpm@12.15.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f

ARG VERSION
ARG BUILD_TIME
ARG GIT_COMMIT

LABEL org.opencontainers.image.title="Vdoc Admin" \
    org.opencontainers.image.source="https://github.com/ChnMig/Vdoc-admin" \
    org.opencontainers.image.version="$VERSION" \
    org.opencontainers.image.created="$BUILD_TIME" \
    org.opencontainers.image.revision="$GIT_COMMIT"

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
