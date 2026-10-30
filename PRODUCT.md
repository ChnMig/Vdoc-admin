# Product

## Register

product

## Users

Vdoc Admin serves authenticated operators and builders working inside the documentation lifecycle. Primary users are SuperAdmins, Project Admins, project writers, backend maintainers publishing OpenAPI or Markdown drafts, frontend developers browsing endpoint and diff facts, documentation maintainers, and agent users creating MCP tokens for local AI tools. Their context is task-focused: configure the workspace, review content, compare versions, inspect API facts, and keep agents tied to approved knowledge.

## Product Purpose

Vdoc Admin is the product workbench and developer portal for the Vdoc backend. It guides first-time setup for Team, Project, Document, Branch, Draft, review, Version, and MCP Token creation, then lets users browse endpoint details, Markdown content, diffs, breaking changes, and reviewed versions. Success means users can complete the trust loop without guessing state: create or find the right document, submit or review the draft, publish the immutable version, and safely hand approved facts to humans and agents.

## Brand Personality

Careful, technical, trustworthy. The admin interface should feel like a dependable control room for reviewed facts: efficient, legible, state-rich, and calm under complex workflows. It can carry Vdoc's document-system identity subtly, but task completion and confidence always outrank expressive branding.

## Anti-references

Avoid over-styled AI dashboards, decorative glass panels, novelty motion, generic shadcn template pages left without Vdoc-specific workflow meaning, and thin CRUD screens that hide the review lifecycle. Avoid implying MCP can publish directly. Avoid burying IDs, status, branch, version, and role context behind vague labels.

## Design Principles

- Put the workflow state first: setup, draft, review, version, diff, and token status must be visible and actionable.
- Separate source-of-truth facts from user input; reviewed versions and MCP-readable facts should feel more authoritative than drafts.
- Keep dense developer information scannable through tables, badges, filters, and monospace identifiers.
- Make dangerous actions explicit and reversible where the backend allows it; never soften archive, revoke, reject, or breaking-change states.
- Preserve product familiarity: standard controls, predictable focus, and consistent shadcn/Radix affordances beat decorative invention.

## Accessibility & Inclusion

Assume WCAG 2.2 AA for future Admin work. Preserve keyboard navigation, visible focus rings, semantic form labels, table structure, status text alongside color, language switching, and reduced-motion alternatives for new animation. Core review and token flows should remain usable for keyboard-only users and users scanning dense technical data.

## Repository workflow (0.4 beta)

The normal document workspace is a project repository. A branch points to an immutable commit containing the complete file tree. Every successful save creates a server-identified commit; users provide an optional commit message, never a required revision or version number. Multi-file uploads, path changes and content changes are saved together against an explicit branch head and generation. Concurrent writes preserve the user's input and offer a branch from the original edit baseline.

Protected branches use working branches and pinned merge requests. Reviewers inspect the actual candidate tree, including automatic merge content, before approval and merge. Resolving conflicts creates a new commit and request for fresh review. Saving or merging does not publish. An administrator explicitly publishes a fixed commit; the server generates the release identifier, and public links pin a document inside that release.

History, source/semantic comparison, AI analysis and event delivery identify exact commits. Subscription and webhook controls belong to project administrators. Existing projects with saved legacy content require explicit administrative import before repository writes; imported history keeps provenance, old deep links and existing public shares. Legacy draft/version screens remain compatibility readers. New work uses commits and branches.
