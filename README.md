# Vdoc Admin

Vdoc Admin is the Vite + React + TypeScript product workbench and developer portal for the Vdoc backend. It is adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) and keeps the template's TanStack and shadcn UI foundation while replacing template authentication with Vdoc's raw-JWT API contract.

The v0.1 surface is responsible for more than CRUD administration: it guides first-time users through Team, Project, Document, Branch, Draft, review, Version, and MCP Token setup; it also gives frontend developers a searchable endpoint browser, version content viewer, Markdown document viewer, and Diff / Breaking Change review flow.

## Stack

- Vite, React, and TypeScript
- TanStack Router, Query, and Table
- Tailwind CSS v4 and shadcn/ui components
- React Hook Form, Zod, Zustand, Axios, and Sonner

## Vdoc Backend Expectations

Set `VITE_VDOC_API_BASE_URL` to the Vdoc API origin during local development, for example `http://127.0.0.1:8080`. The production Docker image is configured at container startup instead: set `VDOC_ADMIN_API_BASE_URL` to write `/runtime-config.js` before Caddy serves the Vite bundle as static files. `VITE_VDOC_API_BASE_URL` remains supported as a container startup fallback for compatibility.

Authentication uses the Vdoc backend directly:

- `POST /api/v1/open/auth/login`
- `POST /api/v1/open/auth/register`
- `GET /api/v1/private/identity/me`

Private requests send the JWT as the raw `Authorization` header value with no `Bearer` prefix. Vdoc responses are HTTP 200 envelopes with `code`, `status`, `message`, `detail`, `total`, `trace_id`, and `timestamp`; the starter API helper unwraps successful envelopes and raises errors for non-OK envelopes.

## Development

```sh
pnpm install
pnpm build
pnpm dev
```

Copy `.env.example` to `.env` before local development if your backend is not running at the example URL. Workspace-level pilot and deploy guidance lives in `../PILOT_RUNBOOK.md` and `../RELEASE_DEPLOY.md`.

For the full local closure path, run from the workspace root:

```sh
scripts/vdoc-local-bootstrap.sh
docker compose --env-file .env up -d --build
cd Vdoc && go run ./tools/vdoc-demo-seed
```

The demo seed is optional. For live E2E against the root Compose stack:

```sh
cd Vdoc
./scripts/vdoc-e2e.sh live-compose --env-file ../.env --check-only
./scripts/vdoc-e2e.sh live-compose --env-file ../.env
```

Live E2E resets the selected disposable `VDOC_TEST_POSTGRES_DB`, `vdoc_e2e` by default. It does not reset the application database from `VDOC_POSTGRES_DB`.

Use the release dry-run as the local gate:

```sh
scripts/vdoc-release-dry-run.sh --list
scripts/vdoc-release-dry-run.sh
```

Do not put raw JWTs, MCP tokens, DB passwords, storage secrets, or `Authorization` header values in docs, logs, screenshots, issues, or shell history. The dry-run does not publish or deploy Admin.

Tests run in Vitest's jsdom environment and do not require a Playwright or Chromium installation:

```sh
pnpm test
```

## Attribution

This starter is adapted from `satnaing/shadcn-admin`, Copyright (c) 2024 Sat Naing, under the MIT License. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the retained upstream notice. The project license remains the Vdoc Admin license in [LICENSE](./LICENSE).
