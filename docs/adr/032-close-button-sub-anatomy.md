# ADR 032: Close-button as second canonical sub-anatomy

**Status:** Folded into the [ADR-030](./030-sub-anatomy.md#sub-anatomy-registry) sub-anatomy registry (2026-05-31, backlog P6-165)
**Date:** 2026-05
**Supersedes:** none (additive — second instance of the [ADR-030](./030-sub-anatomy.md) sub-anatomy mechanism)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-020](./020-slot-kind.md) (slot kind), [ADR-030](./030-sub-anatomy.md) (sub-anatomy mechanism)

> **2026-05-31 (P6-165).** Authoring one ADR per concrete sub-anatomy proved to be
> process overhead — each is an *application* of the ADR-030 mechanism, not a new
> architectural decision. The canonical index now lives in the
> [sub-anatomy registry](./030-sub-anatomy.md#sub-anatomy-registry) in ADR-030;
> new sub-anatomies get a registry row there, not a new ADR. This file stays as the
> detailed historical rationale for the `close-button` instance.

## Context

Six components in `content/components/` declare an icon-only button for dismissing a transient surface. The canon currently expresses one canonical concept under two slot ids:

| Component | Slot id          | Nesting             | Layout (col)   | a11y-name fallback (prose)            |
|-----------|------------------|---------------------|----------------|---------------------------------------|
| `modal`   | `close-button`   | nested under `header` | col 2, span 3 | "Close" or "Close dialog"             |
| `drawer`  | `close-button`   | nested under `header` | col 2, span 3 | "Close" or "Close filters"            |
| `popover` | `close-button`   | nested under `header` | col 2, span 1 | "Close" or "Close popover"            |
| `alert`   | `dismiss-button` | top-level             | col 3, span 1 | "Dismiss alert" / "Dismiss <severity> message" |
| `banner`  | `dismiss-button` | top-level             | col 3, span 1 | "Dismiss banner" / "Close notification" |
| `toast`   | `dismiss-button` | nested under `container` | col 4, span 1 | "Dismiss" / "Dismiss notification" |

Three drift symptoms today:

- **Naming inconsistency.** Three components call the slot `close-button`, three call it `dismiss-button`. The thing they describe is one canonical pattern: an icon-only button that closes the host surface.
- **Accessible-name rule restated six times in prose.** The icon-only-button-needs-accessible-name canon (WCAG 4.1.2, APG icon-button) lives only in `a11y.hint` strings. A cross-component change to the rule (e.g. tightening to "always provide a visually-hidden text node, even with aria-label") requires six edits and easily skews.
- **The visually-hidden-text-vs-aria-label tension is implicit.** Every `a11y.hint` mentions "provide an accessible name", but none of the six slot blocks structurally surfaces that the icon and the name carrier are *two distinct things* contributing to the button's accessible name. A pedagogically richer canon would surface that structurally.

[ADR-030](./030-sub-anatomy.md) introduced the sub-anatomy mechanism specifically to canonicalize patterns of this shape. Its "Phase-2 follow-ups" section called out close-button as a future second instance:

> **Future sub-anatomies** — `header-bar` (Modal+Drawer share a header pattern), `close-button` (dismiss-button on Alert/Toast vs close-button on Modal/Drawer), `icon-leading-text` (Alert/Toast/Badge severity-glyph + content). Each requires its own ADR documenting scope.

This is that ADR.

## Decision

**Author `content/sub-anatomies/close-button.yaml`** as the second canonical sub-anatomy. Migrate all six consumers (Modal, Drawer, Popover, Alert, Banner, Toast) to `$ref: close-button`. Consolidate the canonical name on **`close-button`** (spec-anchored in WAI-ARIA's dialog "close" terminology, MDN's `HTMLDialogElement.close()`, Radix `Dialog.Close`, Headless UI `Dialog.Close`); rename the legacy `dismiss-button` slot id on Alert / Banner / Toast as part of the migration.

**Three-slot composite shape** (mirroring `action-group`'s 3-slot precedent):

| Slot           | `slotKind`     | `code.semantic`     | Role                                                 |
|----------------|----------------|---------------------|------------------------------------------------------|
| `close-button` | `interactive`  | `button`            | Native `<button type="button">` host. Receives focus, fires the close action. |
| `close-icon`   | `decorative`   | `img-decorative`    | The visual glyph (× / cross). `aria-hidden="true"`. Never carries its own accessible name. |
| `close-label`  | `content`      | `visually-hidden`   | Accessible-name carrier. Visually-hidden child text OR the host's `aria-label` attribute. |

The `close-label` slot is the pedagogically-load-bearing one: counting the accessible-name carrier as a *slot* makes the WCAG 4.1.2 dependency structurally visible in every consumer's anatomy diagram, not just in prose. Sub-anatomy `a11y.groupRule` documents that icon and label both live inside the host and contribute to its accessible-name computation; `focusRule` documents that focus targets the host and that Escape must do the same thing as activation when the host surface is dismissible.

**Per-consumer overrides** stay minimal:

- All six consumers override `close-button.required` to `false` — close is genuinely optional in every case (visible only when `dismissible: true`, or when the host pattern explicitly demands an explicit close).
- All six override `close-button.layout` (col / span / parent vary by host grid).
- All six override `close-label.a11y.hint` to encode the host-specific accessible-name canon ("Close dialog" / "Close filters" / "Dismiss <severity> message" / "Close notification" / "Dismiss notification"). The host-context shapes the name; the *requirement* of having a name is the canon and lives in the sub-anatomy slot itself.

No consumer overrides `close-icon` — the decorative-aria-hidden rule is invariant across all six.

**Token canonicalization.** The previously-redeclared token block (`spacing.padding: spacing.tight`, `radius.corner: radius.sm`, `color.foreground: color.text.muted`, `color.ring: color.border.focus`) was identical across five of the six consumers and very-near-identical for Toast. The sub-anatomy carries the canonical token map; consumers that genuinely diverge (none today) override.

## Rationale

- **Single source of truth.** The naming inconsistency (`close-button` vs `dismiss-button`) is exactly the drift sub-anatomy was introduced to absorb. Lifting once forces one canonical name.
- **`close` over `dismiss` for the canonical name.** WAI-ARIA, MDN (`HTMLDialogElement.close()`), Radix (`Dialog.Close`), and Headless UI (`Dialog.Close`) all use "close" as the action verb. "Dismiss" reads slightly more colloquial and is dominantly used on transient notifications (alert, banner, toast); "close" generalizes cleanly across both transient (toast, banner) and modal (dialog, drawer, popover) surfaces. Picking the spec-anchored term avoids re-litigating the naming on every future sub-anatomy.
- **Three slots vs one.** A single-slot canonization would only canonize the rules in prose. A three-slot composite makes the icon-vs-name-carrier distinction structural — a consumer's anatomy diagram now visibly shows that `close-button` *contains* `close-icon` and `close-label`, which teaches the WCAG 4.1.2 dependency by structure. This mirrors `action-group`'s 3-slot precedent and exercises the sub-anatomy mechanism similarly.
- **Required-true on sub-anatomy slots, override-to-false on consumers.** The sub-anatomy says "if you mount a close-button, you need all three parts." Each consumer overrides `close-button.required → false` because in the consumer's anatomy the close-button as a whole is optional (only present when the host is dismissible). This separates two questions cleanly: sub-anatomy answers "what makes a close-button"; consumer answers "is a close-button present here?".
- **Token canonicalization is safe here.** All six consumers carried near-identical token blocks. Drift would have been silent; centralizing the tokens turns drift into an explicit override that requires a rationale.
- **Clean rename, no compat shim for `dismiss-button`.** The legacy slot id was used internally by the canon only — no implementations file references it via stable id, no MCP query is known to depend on the literal `dismiss-button` name (severity vocabularies and component-scoped queries do not surface raw slot ids). A compat shim would preserve a name no consumer should be coupling to. The clean cut is documented here for the change-log.

### Why include Popover (which ADR-030 did not migrate)

ADR-030 migrated Card / Alert / Modal / Drawer to `action-group` and excluded Toast. Popover wasn't in scope because Popover does not have an action-group footer — its dismiss path is light-dismiss (Escape, outside-click), and the explicit close-button is optional surface. Close-button sub-anatomy applies to Popover because Popover *does* have an explicit close-button slot when dismissible: false or when content discourages outside-click dismissal — same canonical icon-button-with-name pattern as Modal/Drawer.

### Why include Toast (which ADR-030 excluded)

ADR-030 excluded Toast from `action-group` because Toast caps at one action button — that one button is structurally a single `interactive` slot with `code.semantic: button`, not a `button-group`. Forcing Toast through action-group would produce a 1-slot resolved sub-anatomy.

The same exclusion does not apply for close-button. Toast's dismiss-button is *exactly* the canonical close-button pattern: an icon-only button with an accessible-name dependency. Including Toast is canon-correct and gives the sub-anatomy 6/6 reuse density across all dismissible-surface components.

### Why no `header-bar` first

Three candidates surfaced from ADR-030's Phase-2-follow-ups list: `close-button`, `header-bar`, `icon-leading-text`. The 2026-05-05 reuse-evidence audit (Phase-1 exploration of P6-147) found:

| Candidate            | Reuse density (existing components) |
|----------------------|--------------------------------------|
| `close-button`       | 6/6 (Modal, Drawer, Popover, Alert, Banner, Toast) |
| `header-bar`         | 5/7 (Modal, Drawer, Popover, Accordion + partial Card/Banner/Alert) |
| `icon-leading-text`  | 3/3 (Button, Menu, List-item — variable slot count complicates) |

Close-button has the highest density and the simplest schema (single sub-anatomy with no variable-arity considerations). `header-bar` is the natural follow-up (will *compose* with close-button; a header-bar sub-anatomy mounts a `close-button` sub-anatomy as one of its inner slots). `icon-leading-text` has variable slot count between consumers (Button has 3 slots, Menu has 2) — first real exercise of `subAnatomyOverrideSchema.omitted`. Author in that order.

## Consequences

**Positive:**

- Six components share one canonical close-button definition. Naming consolidates from two ids to one. Accessible-name canon is structurally encoded.
- MCP `list_sub_anatomies` length grows from 1 to 2 — agents discover the close-button pattern directly via `get_sub_anatomy close-button`.
- `search_components({ query: "close-button" })` matches all six consumers via the existing referenced-sub-anatomy-id haystack extension.
- The pattern is now the second proof that the ADR-030 mechanism scales additively — schema and loader machinery were unchanged for this rollout.
- `header-bar` sub-anatomy (P6-148, future) becomes simpler to author: it composes with `close-button` rather than re-declaring the close-button pattern inline.

**Negative:**

- The `dismiss-button` slot id disappears from Alert / Banner / Toast. Any downstream that referenced the literal slot id (none known today) would 404 on that name. Documented as a clean cut here.
- Each consumer's anatomy diagram now exposes 3 resolved slots where there was 1 — the slot table grows. This is the cost of structurally surfacing the icon-vs-label distinction; the editorial benefit is that the WCAG 4.1.2 dependency becomes visible in every consumer's docs. The trade-off is the same one ADR-030 made for `action-group`.
- The `code.slot` metadata changes from `close` / `dismiss` to `close-button` / `close-icon` / `close-label` on the resolved slots. Slightly more verbose but uniform across consumers.

**Migration footprint:**

- `content/sub-anatomies/close-button.yaml` — new file (~110 LOC).
- `content/components/{modal,drawer,popover,alert,banner,toast}.yaml` — six migration edits, each replacing the inline slot block with a `$ref` entry plus 2 overrides (`close-button.required + layout`, `close-label.a11y`).
- `mcp-server/tests/server.test.ts` — extend `list_sub_anatomies` and `get_sub_anatomy` tests to cover `close-button` (mirror existing `action-group` test cases).
- `docs/backlog.md` — flip `P6-147 [x]`, append `P6-148 header-bar` and `P6-149 icon-leading-text` follow-ups.

No schema changes. No loader changes. No bundle-script changes. No site-render changes. All five layers were proven sub-anatomy-id-agnostic during the ADR-030 rollout and required zero updates here.

## Alternatives considered

- **Single-slot canonization (just `close-button`, no inner icon/label slots).** Rejected. Would centralize prose but not surface the icon-vs-name-carrier distinction structurally — the WCAG 4.1.2 dependency would remain prose-only. Pedagogically equivalent to a lint comment.
- **Keep `dismiss-button` as a separate sub-anatomy.** Rejected. The semantic distinction between "dismiss" (used on transient notifications) and "close" (used on overlays) is editorial, not structural — both are icon-only buttons with the same a11y rule. Two sub-anatomies for the same canonical thing would re-introduce the drift this ADR removes.
- **Skip Popover and Toast.** Rejected. Both have the same canonical icon-only-button-with-name pattern; excluding them would leave the same "5 of 6 components share a pattern, 1 doesn't" asymmetry that motivated this lift.
- **Migrate first, ADR later.** Rejected. ADR-030 set the precedent that each new sub-anatomy gets its own ADR documenting scope, naming choice, and migration footprint. The naming consolidation (`dismiss-button` → `close-button`) and the 3-slot vs 1-slot structural choice both deserve a written-down decision.
- **Per-consumer compat alias for `dismiss-button`.** Rejected. Compat shims for canonical-only names create maintenance debt with no observed downstream coupling. Clean cut documented here.
