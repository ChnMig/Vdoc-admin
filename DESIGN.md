# Design

## Surface

Vdoc Admin is the authenticated product workbench and developer portal. It uses Vite, React, TypeScript, TanStack Router/Query/Table, Tailwind CSS v4, Radix/shadcn-style components, React Hook Form, Zod, Zustand, Axios, Sonner, and Lucide icons.

## Visual Direction

Use the Control Plane direction: a restrained product-tool register for operators managing reviewed documentation facts. The admin surface should feel precise, state-rich, and calm under normal office light, with workflow state, IDs, review gates, diffs, and MCP token status easier to scan than template defaults. Preserve the shadcn/Radix foundation and functional contracts, but do not preserve the previous warm starter-template styling.

## Color

Theme tokens live in `src/styles/theme.css` as OKLCH custom properties and Tailwind v4 `@theme inline` mappings.

Light mode uses a cool graphite-white workspace with dark blue-gray text and restrained blue verification accents:

- `--background: oklch(0.973 0.004 255.8)`.
- `--foreground: oklch(0.155 0.035 258.6)`.
- `--card: oklch(0.995 0.002 255.8)`.
- `--primary: oklch(0.31 0.072 254.2)`.
- `--muted-foreground: oklch(0.425 0.035 258.6)`.
- `--destructive: oklch(0.535 0.205 27.8)`.

Control Plane-specific tokens include `--surface-control`, `--surface-panel`, `--surface-raised`, `--workspace-glow`, `--workspace-vignette`, `--workspace-grid`, `--status-ready`, `--status-review`, `--status-warning`, `--status-danger`, `--shadow-card`, and `--shadow-panel`. Dark mode switches the same token contract to deep blue-gray surfaces through the `.dark` class. Chart tokens exist for reporting and summaries; use them for data roles only, not decoration. Accent color should mean action, selection, or state.

## Typography

Admin loads Inter and Manrope from Google Fonts and maps them as `--font-inter` and `--font-manrope`. Keep product typography compact and predictable: fixed rem sizes, modest weight changes, and no display-serif treatment. Page headers use compact `text-2xl` scales with tracking no tighter than `-0.04em`; dense supporting copy uses `text-muted-foreground` with clear labels.

## Layout

Authenticated pages use `AuthenticatedLayout` with `SearchProvider`, `LayoutProvider`, `SidebarProvider`, `AppSidebar`, `SkipToMain`, and `SidebarInset`. Page content is standardized through `PageChrome`: header tools, lifecycle stage badge, console label, h1, page description, next-action panel, and a `grid gap-5` content stack.

Responsive behavior should preserve task hierarchy: sidebar and header chrome first, then forms, tables, detail panels, and diff/content viewers. Use horizontal overflow intentionally for tables rather than compressing technical identifiers beyond recognition.

## Components

- Buttons use `buttonVariants` with `default`, `destructive`, `outline`, `secondary`, `ghost`, and `link` variants; keep focus rings and disabled states intact.
- Cards use `rounded-lg`, border, `bg-card`, `panel-control`, and the restrained `--shadow-card`; avoid nested card stacks unless the data hierarchy demands it.
- Tables use semantic `table`, `thead`, `tbody`, `th`, and `td` wrappers with horizontal overflow and hover state.
- Forms should keep labels, validation messages, required fields, and disabled/loading states visible.
- Alerts, badges, status labels, copy buttons, command search, language switch, theme switch, and profile dropdown are functional controls, not decoration.
- Lucide icons are the icon vocabulary; do not mix in unrelated icon styles.

## Motion

Motion should communicate state changes only. Existing collapsible content uses 300ms slide animations for open/closed state. Future motion should stay in the 150-250ms range where possible, provide reduced-motion behavior, and avoid orchestrated page-load sequences.

## Accessibility

Maintain WCAG 2.2 AA. Preserve `SkipToMain`, semantic tables and forms, visible focus rings, `aria-invalid`, keyboard shortcuts that are also discoverable, theme and language controls, and text labels for status. Do not encode review severity, token state, or breaking-change risk with color alone.

## Implementation Notes

- Main style files: `src/styles/index.css` and `src/styles/theme.css`.
- Main shell files: `src/main.tsx`, `src/routes/_authenticated/route.tsx`, `src/components/layout/authenticated-layout.tsx`, and `src/features/vdoc-admin/pages.tsx`.
- Generated `src/routeTree.gen.ts` is not a design source and should not be edited.
- Verify with `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check` from `Vdoc-admin/` when formatting changes are in scope.

## Follow-ups

Future polish should review reduced-motion coverage for admin-specific animations and keep expanding workflow-state density in entity pages without changing API/query contracts.
