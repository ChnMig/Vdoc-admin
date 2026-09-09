---
target: Vdoc Admin real product-closure audit
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-17T12-31-02Z
slug: src-features-vdoc-admin-pages-tsx
---
⚠️ DEGRADED: single-context (sub-agents declined by user)

# Vdoc Admin design critique — 2026-08-17

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3 | Loading, error, success, and destructive confirmation states are broadly present; release provenance is not surfaced to users. |
| 2 | Match System / Real World | 2 | Change types 4–10 render as `Unknown N`, and entity-specific statuses are translated with one generic function. |
| 3 | User Control and Freedom | 3 | Forms and destructive actions have exits and confirmations; invalid last-admin mutations are still offered before the backend rejects them. |
| 4 | Consistency and Standards | 2 | User `disabled` becomes `Archived`, published Versions become `Active`, and backend English Diff copy leaks into Chinese UI. |
| 5 | Error Prevention | 1 | Empty MCP scopes silently become `api:read`; expiry is free-form and may already be expired; last-admin mutations are not prevented. |
| 6 | Recognition Rather Than Recall | 3 | Navigation is labeled and grouped, with contextual guidance and visible selectors; unknown numeric change labels undermine recognition on the core Diff path. |
| 7 | Flexibility and Efficiency | 2 | The shell performs one member-list request per Project to decide Audit navigation access and offers little expert acceleration. |
| 8 | Aesthetic and Minimalist Design | 3 | The calm operator surface, grouped sidebar, and restrained hierarchy are coherent, although the visual system remains close to a category-standard dashboard. |
| 9 | Error Recovery | 3 | Retry and error states preserve most flows; several preventable failures are deferred to backend error responses. |
| 10 | Help and Documentation | 2 | In-product guidance and docs links exist, but Terms and Privacy are 404 and the MCP install snippet points to an obsolete commit. |
| **Total** |  | **24/40** | **Acceptable — significant pre-release fixes remain** |

## Design Specificity Verdict

The workflow vocabulary, first-run guidance, review/publish boundary, document context, and MCP evidence cards feel authored for Vdoc. The surrounding shell, tables, cards, and form composition remain category-interchangeable with a typical shadcn admin. Product specificity is strongest in copy and state modeling, but the most important state model—the semantic Diff—currently loses meaning in the UI.

The deterministic detector returned zero findings for `src/features/vdoc-admin/pages.tsx`. That is a useful signal for obvious implementation anti-patterns, not a clean UX verdict: browser and source evidence found semantic labeling, permission-intent, and dead-link failures outside the detector's rules.

No reliable visual overlay was produced. Browser mutation preflight failed because the available page-control surface exposes no mutable script-injection method (`addScriptTag is not a function`), so no live server was started. Direct DOM inspection was used instead and confirmed both legal routes render the application's 404 screen.

## Overall Impression

The product has a credible, calm operator surface and far better state/error coverage than a prototype. Its largest opportunity is semantic integrity: the UI must never present a valid backend change or entity state with the wrong human meaning. That gap is more damaging than visual polish because Diff comprehension is the product's central promise.

## What's Working

- The five navigation groups keep each group at four items or fewer and make the long workflow learnable.
- Loading, retry, empty, confirmation, archive-read-only, and role-aware states are implemented across the main workbench.
- Desktop and mobile authentication surfaces are readable and responsive; real Playwright business-flow tests pass for Draft approval, safe Markdown viewing, and public-share handling.

## Cognitive Load

Moderate: 2 of 8 checklist items fail. The interface is well chunked and grouped, but users must bridge Project/Document/Branch/Version context across screens, and Diff rows force interpretation of numeric `Unknown` labels. Decision points generally stay within four visible options.

## Emotional Journey

The calm sign-in and guided empty states set appropriate reassurance. The emotional valley occurs at high-stakes interpretation and setup moments: a reviewer can encounter `Unknown 7`, an administrator can create a token with unintended read access, and a first-time user can leave the product through a legal-link 404. Those moments weaken trust precisely where the interface should feel most certain.

## Priority Issues

### [P1] Core Diff meanings collapse to `Unknown 4`–`Unknown 10`

**Why it matters:** The backend emits ten valid change types, while `changeTypeLabel()` handles only endpoint added/removed/modified. Parameter, request-body, response, security, and deprecated changes—the reason users open the Diff page—lose their meaning.

**Fix:** Add entity-specific labels for all ten codes, localize the human message layer, and add UI tests covering each change type and both languages.

**Suggested command:** `$impeccable harden`

### [P1] The displayed MCP install source is not the adapter that the current backend contract expects

**Why it matters:** Admin and Site still install commit `7d641fa…`; the current adapter HEAD adds `User-Agent`, `X-Vdoc-Adapter: stdio`, and live audit coverage. Following the product UI therefore records calls as `direct` rather than `stdio` and bypasses the intended evidence path.

**Fix:** Publish the five local commits, refresh the reviewed workspace lock and control-plane digest, then derive all install snippets from the locked MCP/Skill commits instead of duplicated literals.

**Suggested command:** `$impeccable harden`

### [P2] Token creation can violate the user's explicit permission and expiry intent

**Why it matters:** Unchecking every scope submits `[]`, which the backend silently normalizes to `api:read`. Expiry accepts arbitrary ISO text and permits an already-expired token. The user can complete a security-sensitive action and receive a different result from the one selected.

**Fix:** Require at least one selected scope in UI and API, use a constrained future-date control, reject past expiry at both layers, and state the effective scope before confirmation.

**Suggested command:** `$impeccable harden`

### [P2] Generic status labeling states false facts

**Why it matters:** A disabled user/member is announced as `Archived`, while a published Version is announced as `Active`. The interface is visually consistent but semantically wrong, including for screen-reader users.

**Fix:** Replace the global numeric status formatter with typed, entity-specific status maps and exhaustive tests.

**Suggested command:** `$impeccable clarify`

### [P2] Authentication legal links are dead ends

**Why it matters:** Sign-in and sign-up ask users to accept Terms and Privacy, but both links render a 404. This damages trust at the exact moment users decide whether to create or access an account.

**Fix:** Ship real Terms and Privacy routes/content or remove the acceptance claim until those documents exist; add route coverage for both.

**Suggested command:** `$impeccable harden`

## Persona Red Flags

**Alex (Power User):** Audit navigation permission triggers one member-list request per visible Project; no bulk or shortcut path offsets this overhead. On Diff, valid parameter/body/response changes become `Unknown N`, so rapid scanning fails.

**Sam (Accessibility-Dependent User):** Controls are generally labeled and browser accessibility tests pass, but assistive technology receives the same incorrect `Archived`/`Active` status text and meaningless numeric Diff labels as visual users.

**Riley (Stress Tester):** Empty scopes create a read-capable token, past expiry creates an immediately useless token, last-admin demotion/removal is offered then rejected, and both legal routes deterministically 404. These are predictable boundary inputs, not exotic attacks.

## Minor Observations

- `AuthenticatedLayout` has an N+1 permission lookup across Projects; expose current-user role summaries or an audit-capability endpoint.
- Backend Diff messages are English data strings, so Chinese pages mix languages even when labels are localized.
- The OpenAPI contract documents only 6 request bodies across 45 write operations; many body-accepting endpoints are not usable as a complete machine contract.
- The detector reported no findings; the remaining issues are primarily semantic and cross-layer, which explains the discrepancy.

## Questions to Consider

- What would it take for every user-visible state and change label to be generated from one typed contract rather than parallel numeric assumptions?
- Should a security-sensitive form ever submit a value that the backend silently upgrades to a permission the user did not choose?
- Can a release candidate be shown in installation UI before the exact commit is both remotely obtainable and bound by the workspace lock?
