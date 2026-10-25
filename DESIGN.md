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

Authenticated pages use `AuthenticatedLayout` with `SearchProvider`, `LayoutProvider`, `SidebarProvider`, `AppSidebar`, `SkipToMain`, and `SidebarInset`. `PageChrome` uses a compact h1 and full-width description above a `grid gap-6` content stack. Generic lifecycle explanations and next-route links live in the keyboard-accessible Page guide disclosure; they do not occupy the first viewport by default. Contextual dashboard guidance stays visible in a compact expandable row with its action. Header search stays beside the sidebar toggle, with flexible space before the language, theme, and profile tools at the trailing edge. Header tool gaps tighten on narrow screens.

The default destination is the document workspace. Team and project selectors establish scope before the project folder tree. A selected file establishes one reading context: branch, published/draft state, and revision selectors live above the document. Reading, sharing, and document AI use that exact context. Document tools group version history, endpoint inspection, and comparisons; document settings group metadata and branch management. Sharing opens from the current document and pins the selected published version; drafts cannot create public links. Keep context visible without repeating selectors inside the tools or editor. Visited panes retain unsaved input until the selected document or scope changes. On wide screens the bounded folder rail sits beside the flexible detail area; on narrow screens it stacks above and can be hidden. Single-click folder rows expand or collapse and select a creation destination without closing the open document. OpenAPI, Markdown, and TXT use distinct functional icons. Logical folder depth is unlimited, while visual indentation stays bounded. Distinguish display names from filenames and published content from drafts. New documents and folders are actions beside the tree, with the selected folder as the default location.

Navigation combines the former document, draft, version, and diff entries into Documents. Retain legacy deep links to the corresponding document task. Team, project, user, agent access, audit, and system settings remain separate administration destinations. Workspace navigation gives the document tree priority over global chrome.

Context selectors form a responsive, border-bottom toolbar without a separate titled card. Related search fields, results, and pagination stay together. Summary facts use one divided definition strip instead of several equally prominent metric cards. Dashboard setup steps are a scannable status list; health and role details support the main task. Diff severity groups and endpoint details use headings and dividers, with bordered surfaces reserved for individual changes and contained code. Skill installation groups instructions alongside its command and keeps MCP client configuration as a separate task. Auxiliary raw token metadata is available through a disclosure.

Settings uses the same authenticated shell with a compact title and four task tabs: Account, Appearance, AI, and Version. It omits the workflow hero and next-action panel. Account and appearance use a single divided surface with section explanations beside controls on desktop and above controls on narrow screens. Password fields remain bounded to `max-w-md`. Runtime diagnostics live under Version, after deployment/update information. Theme and language are editable controls, rather than raw enum readouts.

AI settings separate system defaults from project overrides with scope tabs. Each scope groups its provider and prompt templates together; avoid nested card borders. Provider fields use two columns and tuning parameters use three when space permits. Prompt forms use a container-aware two-column grid and collapse to one column on narrow screens. System prompt fields start at twelve rows and user template fields at seven, independent of content length, so paired forms align. Longer text scrolls inside the field; users can resize vertically. Visited settings tabs and AI scopes retain their form drafts while inactive panels are hidden from keyboard and assistive technology. AI configuration and runtime health are loaded when their categories are first opened; checking for updates remains a manual action.

Collections use compact title/count headers with trailing actions, followed by tables and pagination in the same surface. Empty states use plain guidance within their existing container, rather than nested bordered boxes. Context selectors have a bounded width, so one selector does not stretch across the workspace. Dashboard setup tasks lead, with role and backend health in the supporting column and workspace counts below.

Drafts separate Workspace, History, and AI; visited tabs retain edits and review context. The workspace pairs editing with saved content and review at sufficient width, and stacks these tasks on mobile. Versions open with content; Endpoints and History are sibling tasks, and endpoint links open the right task. Diffs separate the comparison result from history, with optional search beside the comparison context. MCP separates credentials, client configuration, and activity while keeping newly issued secrets visible. Skill installation presents a copyable command with instructions tied to each step. Project membership creation uses a short dialog; user tokens have an explicit row action, selected state, and close action.

Responsive behavior should preserve task hierarchy: sidebar and header chrome first, then forms, tables, detail panels, and diff/content viewers. Use horizontal overflow intentionally for tables rather than compressing technical identifiers beyond recognition.

## Components

- Buttons use `buttonVariants` with `default`, `destructive`, `outline`, `secondary`, `ghost`, and `link` variants; keep focus rings and disabled states intact.
- Cards use `rounded-lg`, border, `bg-card`, `panel-control`, and the restrained `--shadow-card`; avoid nested card stacks unless the data hierarchy demands it.
- Tables use semantic `table`, `thead`, `tbody`, `th`, and `td` wrappers with horizontal overflow and hover state. Center column headings and cell contents consistently, including badges, role controls, and action groups; keep vertical alignment in the middle.
- Forms should keep labels, validation messages, required fields, and disabled/loading states visible.
- Product selects use the shared Radix-backed control, including project context and form fields. Empty choices, disabled states, labels, and submitted form values must retain their existing meaning. Date and time fields use the shared calendar popover with matching time selectors, localized labels, and a clear action for optional values; display local time and preserve the API's UTC conversion at submission.
- Resource management pages show lists first. Place creation buttons in the collection header and editing buttons in each row; open short, labeled forms in the shared `FormDialog`. Keep fields in one column, preserve input on errors, and close after successful submission. Draft editing and review retain their dedicated workflows.
- Alerts, badges, status labels, copy buttons, command search, language switch, theme switch, and profile dropdown are functional controls, not decoration.
- Lucide icons are the functional icon vocabulary. Product branding uses the owner-supplied Vdoc artwork through `src/assets/logo.tsx`, with the original blue-and-cyan colors and transparent background in both themes. `public/images/vdoc-logo.png` is the 256px mark and `public/images/favicon.png` is the 64px browser variant. The shared Logo component reserves its dimensions and uses empty alt text alongside the visible brand name.

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
