FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder

ARG VERSION
ARG BUILD_TIME
ARG GIT_COMMIT

RUN test -n "$VERSION" \
    && test "$VERSION" != dev \
    && test -n "$BUILD_TIME" \
    && test "$BUILD_TIME" != unknown \
    && printf '%s' "$GIT_COMMIT" | grep -Eq '^[0-9a-f]{40}(-dirty)?$'

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM caddy:2-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648

ARG VERSION
ARG BUILD_TIME
ARG GIT_COMMIT

LABEL org.opencontainers.image.title="Vdoc Admin" \
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
