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

Outside independent document pages, authenticated pages use `AuthenticatedLayout` with `SearchProvider`, `LayoutProvider`, `SidebarProvider`, `AppSidebar`, `SkipToMain`, and `SidebarInset`. `PageChrome` uses a compact h1 and full-width description above a `grid gap-6` content stack. Generic lifecycle explanations and next-route links live in the keyboard-accessible Page guide disclosure; they do not occupy the first viewport by default. Contextual dashboard guidance stays visible in a compact expandable row with its action. Header search stays beside the sidebar toggle, with flexible space before the language, theme, and profile tools at the trailing edge. Header tool gaps tighten on narrow screens.

The default destination is Workspace at `/documents`. Its hierarchy browser puts teams and their projects in a bounded navigation rail, then shows the selected level as a resource list. At desktop widths the rail is 15.5rem; below the large breakpoint it sits above the list. A project groups Documents, Project members, and permission-gated Project settings in one place. SuperAdmins can also open People and Team settings inside this workspace. Membership and access belong to projects; grouping projects under a team does not create a separate team membership system. Use distinct functional icons for the workspace, team, project, people, folder, and document type.

Opening a document enters the independent `/documents/$documentId` page and removes the global application sidebar. The document layout fills the viewport: the current project's file tree occupies a 17rem rail on the left, the reading surface fills the center, and an outline/assistant region plus a 3rem tool rail appears on the right from 1280px. Reading content is bounded to 52rem; tool and editor views may use 82rem. The right region is 15rem for the outline, 23rem for document AI, and collapses when another tool is active without AI. Each region scrolls within its own bounds. The file rail identifies the project and team and provides Back to workspace, new-document, and new-folder actions.

The document header keeps its title, Share, and Edit draft actions visible. Branch, published/draft state, and revision selectors share a compact row below it. The right rail provides independent entries for the content outline, Versions, Diffs, Document AI, and permission-gated Document settings. Versions opens the document's publication history across its branches; selecting a revision returns to reading on that branch. Diffs owns comparison selection and results, without a nested Versions/Diffs switch. Its source and target each have a branch selector and a published-version selector, so the same document can be compared within or across branches. Drafts and other documents cannot be comparison endpoints. Changing one side's branch clears that side's version and the old comparison. Preserve the reading selection while the comparison context changes.

Document settings has one entry with sibling Document details and Branches tabs. Keep metadata forms and branch management separate; retain visited tab input without adding a second branch-management route or duplicating the document settings form. Share opens a dialog for the selected published version; drafts cannot create public links. Reading scope selectors remain in the document toolbar rather than repeating inside the editor, history, or AI.

AI expands independently of the active reading or tool pane. On wide screens it docks beside that pane at a fixed 23rem width, leaving content and editing usable. On narrow screens the same assistant subtree is presented as a modal dialog from the right. The AI entry toggles it; a labeled close control and Escape dismiss it and restore focus to the trigger. Keep one assistant instance through closing, reopening, and breakpoint changes so unsubmitted chat input survives for the same target. Summary and chat remain bound to the explicitly selected version or draft; changing that target creates a new AI context, and invalid selections must not fall back to another revision. Do not replace the center reading surface with AI or imply that its width is draggable.

Keep the reader mounted while another document tool is active, preserving the exact revision, scroll position, and Preview/Source choice on return. Visited editor, comparison, and settings panes retain their local input while hidden; inactive content is unavailable to keyboard navigation and assistive technology. State retention is scoped to the current document/project/session and permitted task, not a substitute for saving. Selecting another document or losing access must clear stale scope rather than leak earlier content. A cold scope load uses a local skeleton, never another project's data.

Single-click folder rows expand or collapse and select a creation destination without closing the open document. Highlight the open document once; keep its containing folder's creation-target state visually separate. OpenAPI, Markdown, and TXT use distinct icons. Logical folder depth is unlimited, while visual indentation stays bounded. Distinguish display names from filenames and published content from drafts. The outline reflects headings in the currently rendered content; a plain-text document without headings has an empty outline.

Below 768px, the project file tree opens in a left sheet and closes after choosing a document. Below 1280px, the outline opens in a dialog and document-tool buttons appear in a horizontal row below the reading selectors. AI uses a right-side modal panel up to 26rem wide with a backdrop; the underlying pane remains mounted at its reading or editing position. Modal focus stays inside AI and returns on close. Share or outline dialogs take modal precedence on narrow screens without discarding AI state. Keep Share and Edit draft accessible through labeled icon buttons when their text is hidden.

Navigation combines team, project, people, and document browsing into Workspace. Agent access, audit, and system settings retain their global destinations. Legacy team, project, draft, version, diff, and document query links continue to resolve to the matching task. The independent document page prioritizes project navigation and reading over global chrome.

Treat query changes as local task updates. Keep shell, navigation tree, filters, and visited project tabs stable while their content changes. Clicking the current folder destination is a navigation no-op; clicking a folder does not change the open document. Clicking the open document while reading is also a no-op, while selecting it from a tool returns to content with the exact revision intact. Browser history restores URL-owned selection, including the source and target comparison branches. Avoid remounting the application shell or whole page on each query update.

Context selectors form a responsive, border-bottom toolbar without a separate titled card. Related search fields, results, and pagination stay together. Summary facts use one divided definition strip instead of several equally prominent metric cards. Dashboard setup steps are a scannable status list; health and role details support the main task. Diff severity groups and endpoint details use headings and dividers, with bordered surfaces reserved for individual changes and contained code. Skill installation groups instructions alongside its command and keeps MCP client configuration as a separate task. Auxiliary raw token metadata is available through a disclosure.

Settings uses the same authenticated shell with a compact title and four task tabs: Account, Appearance, AI, and Version. It omits the workflow hero and next-action panel. Account and appearance use a single divided surface with section explanations beside controls on desktop and above controls on narrow screens. Password fields remain bounded to `max-w-md`. Runtime diagnostics live under Version, after deployment/update information. Theme and language are editable controls, rather than raw enum readouts.

AI settings separate system defaults from project overrides with scope tabs. Each scope groups its provider and prompt templates together; avoid nested card borders. Provider fields use two columns and tuning parameters use three when space permits. Prompt forms use a container-aware two-column grid and collapse to one column on narrow screens. System prompt fields start at twelve rows and user template fields at seven, independent of content length, so paired forms align. Longer text scrolls inside the field; users can resize vertically. Visited settings tabs and AI scopes retain their form drafts while inactive panels are hidden from keyboard and assistive technology. AI configuration and runtime health are loaded when their categories are first opened; checking for updates remains a manual action.

Collections use compact title/count headers with trailing actions, followed by tables and pagination in the same surface. Empty states use plain guidance within their existing container, rather than nested bordered boxes. Context selectors have a bounded width, so one selector does not stretch across the workspace. Dashboard setup tasks lead, with role and backend health in the supporting column and workspace counts below.

Drafts separate Workspace, History, and AI; visited tabs retain edits and review context. The workspace pairs editing with saved content and review at sufficient width, and stacks these tasks on mobile. Versions is a history tool. Published OpenAPI content uses Source/Endpoints reading tabs; endpoint links open the matching version and endpoint, with scope validation and exact JSON values preserved. Diffs separate the comparison result from history, with optional search beside the comparison context. MCP separates credentials, client configuration, and activity while keeping newly issued secrets visible. Skill installation presents a copyable command with instructions tied to each step. Project membership creation uses a short dialog; user tokens have an explicit row action, selected state, and close action.

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

Use the shared motion tokens in `src/styles/theme.css`: `--motion-duration-fast: 150ms`, `--motion-duration-panel: 220ms`, `--motion-duration-route: 160ms`, and `--motion-ease-standard: cubic-bezier(0.16, 1, 0.3, 1)`. Local pane and route changes use a short opacity transition from 0.92 to 1; they do not move the reading surface or reset its scroll. Folder chevrons rotate the same icon. Collapsible rows use 180ms opening and 160ms closing slides. The AI region interpolates its grid width on desktop; on narrow screens its dialog and backdrop transition together, with a short horizontal entrance from the right.

`prefers-reduced-motion: reduce` removes layout/panel transforms, collapsible slides, and smooth scrolling. Pane/route feedback becomes a brief 80ms opacity change. Preserve functional focus and state changes in both modes. Motion communicates an existing local state change; it must not hide a network error, replay a page-load sequence on query changes, or delay access to content.

## Accessibility

Maintain WCAG 2.2 AA. Preserve `SkipToMain`, semantic tables and forms, visible focus rings, `aria-invalid`, keyboard shortcuts that are also discoverable, theme and language controls, and text labels for status. Do not encode review severity, token state, or breaking-change risk with color alone.

## Implementation Notes

- Main style files: `src/styles/index.css` and `src/styles/theme.css`; motion classes are shared by the app shell, task panes, tree, and assistant.
- Document interaction sources: `document-workspace-detail.tsx`, `document-workspace-content.tsx`, `document-file-tree.tsx`, `diffs-page.tsx`, and `versions-page.tsx` under `src/features/vdoc-admin/`.
- Main shell files: `src/main.tsx`, `src/routes/_authenticated/route.tsx`, `src/components/layout/authenticated-layout.tsx`, and `src/features/vdoc-admin/pages.tsx`.
- Generated `src/routeTree.gen.ts` is not a design source and should not be edited.
- Verify with `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check` from `Vdoc-admin/` when formatting changes are in scope.

## Follow-ups

Keep checking state retention, keyboard focus, and reduced-motion behavior when adding document tools or changing responsive breakpoints. Expand workflow-state density in entity pages without changing API/query contracts.
