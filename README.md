# Vdoc Admin

Vdoc Admin is the Vite + React + TypeScript product workbench and developer portal for the Vdoc backend. It is adapted from [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) and keeps the template's TanStack and shadcn UI foundation while replacing template authentication with Vdoc's raw-JWT API contract.

The v0.1 surface is responsible for more than CRUD administration: it guides first-time users through Team, Project, Document, Branch, Draft, review, Version, and MCP Token setup; it also gives frontend developers a searchable endpoint browser, version content viewer, Markdown document viewer, and Diff / Breaking Change review flow.

## Stack

- Vite, React, and TypeScript
- TanStack Router, Query, and Table
- Tailwind CSS v4 and shadcn/ui components
- React Hook Form, Zod, Zustand, Axios, and Sonner

## Vdoc Backend Expectations

Set `VITE_VDOC_API_BASE_URL` to the Vdoc API origin, for example `http://127.0.0.1:8080`.

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

Browser tests use Playwright Chromium by default. Set `VDOC_ADMIN_TEST_BROWSER_EXECUTABLE_PATH` only when you intentionally want to run tests against a local browser executable such as Microsoft Edge Beta.

Before the first local browser test run, install Chromium once:

```sh
pnpm exec playwright install chromium
pnpm test
```

CI uses `pnpm exec playwright install --with-deps chromium` to install Chromium and Linux system dependencies.

## Attribution

This starter is adapted from `satnaing/shadcn-admin`, Copyright (c) 2024 Sat Naing, under the MIT License. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for the retained upstream notice. The project license remains the Vdoc Admin license in [LICENSE](./LICENSE).
