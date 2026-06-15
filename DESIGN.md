# Design

## Surface

Vdoc Admin is the authenticated product workbench and developer portal. It uses Vite, React, TypeScript, TanStack Router/Query/Table, Tailwind CSS v4, Radix/shadcn-style components, React Hook Form, Zod, Zustand, Axios, Sonner, and Lucide icons.

## Visual Direction

Use a restrained product-tool register: familiar, precise, state-rich, and low-drama. The admin surface should feel like a control room for reviewed documentation facts, not a marketing page. Preserve the current shadcn foundation while making Vdoc-specific workflows, statuses, IDs, and review gates clearer than template defaults.

## Color

Theme tokens live in `src/styles/theme.css` as OKLCH custom properties and Tailwind v4 `@theme inline` mappings.

Light mode uses a near-white warm neutral workspace with dark blue-gray text:

- `--background: oklch(0.986 0.006 84.56)`.
- `--foreground: oklch(0.145 0.038 264.45)`.
- `--card: oklch(0.998 0.003 84.56)`.
- `--primary: oklch(0.208 0.042 265.755)`.
- `--muted-foreground: oklch(0.514 0.038 257.417)`.
- `--destructive: oklch(0.577 0.245 27.325)`.

Dark mode switches to deep blue-gray surfaces and light text through the `.dark` class. Chart tokens exist for reporting and summaries; use them for data roles only, not decoration. Accent color should mean action, selection, or state.

## Typography

Admin loads Inter and Manrope from Google Fonts and maps them as `--font-inter` and `--font-manrope`. Keep product typography compact and predictable: fixed rem sizes, modest weight changes, and no display-serif treatment. Page headers currently use `text-2xl font-bold tracking-tight`; dense supporting copy uses `text-muted-foreground` with clear labels.

## Layout

Authenticated pages use `AuthenticatedLayout` with `SearchProvider`, `LayoutProvider`, `SidebarProvider`, `AppSidebar`, `SkipToMain`, and `SidebarInset`. Page content is standardized through `PageChrome`: header tools, console label, h1, page description, and a `grid gap-6` content stack.

Responsive behavior should preserve task hierarchy: sidebar and header chrome first, then forms, tables, detail panels, and diff/content viewers. Use horizontal overflow intentionally for tables rather than compressing technical identifiers beyond recognition.

## Components

- Buttons use `buttonVariants` with `default`, `destructive`, `outline`, `secondary`, `ghost`, and `link` variants; keep focus rings and disabled states intact.
- Cards use `rounded-xl`, border, `bg-card`, and `--shadow-card`; avoid nested card stacks unless the data hierarchy demands it.
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
- Verify with `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check` from `Vdoc-admin/`.

## Follow-ups

Future polish should replace arbitrary z-index usage with a semantic z-index scale, review reduced-motion coverage for admin-specific animations, and reconsider the current border plus large `--shadow-card` pairing so cards do not drift into generic ghost-card styling.
