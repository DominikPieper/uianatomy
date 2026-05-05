# ADR 033: Header-bar as third canonical sub-anatomy

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** none (additive — third instance of the [ADR-030](./030-sub-anatomy.md) sub-anatomy mechanism)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-020](./020-slot-kind.md) (slot kind), [ADR-030](./030-sub-anatomy.md) (sub-anatomy mechanism), [ADR-032](./032-close-button-sub-anatomy.md) (close-button — co-mount)

## Context

Three overlay-surface components in `content/components/` declare a near-identical "top wrapper region grouping a heading and dismiss affordances" pattern:

| Component | `header` slot | `title` slot | Notes                                                    |
|-----------|---------------|--------------|----------------------------------------------------------|
| `modal`   | `slotKind: structural`, `code.semantic: heading-region`, padding/gap = `spacing.compact` | `slotKind: content`, `code.semantic: heading`, typography = `text.lg` / `weight.semibold` / `leading.tight` | Header optional on alert dialogs |
| `drawer`  | identical to Modal | identical to Modal + visually-hidden-title acceptable variant | Header optional on filter panels |
| `popover` | identical structure but padding/gap = `spacing.tight` (smaller surface) | **No title slot today** — `header.purpose` claims "grouping title and close affordance" but the slot is missing | Header optional on small popovers |

Drift symptoms in the canon today:

- **Header wrapper structure repeated three times** with identical slot kind, semantic, and a11y rule ("layout region, not a heading"). A canon-wide tightening of the rule (e.g. mandating that the heading-region semantic also requires a real `<header>` element vs `<div>`) would require three edits.
- **Title typography redeclared verbatim** on Modal and Drawer (`text.lg` / `semibold` / `tight`) — Popover lacks the slot entirely. Three cases of "should be canon" tokens that are currently per-component.
- **Popover canon gap.** Popover's `header.purpose` prose mentions "grouping title and close affordance" but no `title` slot is defined. The implication is that some popovers carry a title; the canon has no surface to express that. A consumer authoring a labelled popover (form panel, named filter sheet) has to reconstruct the title canon from Modal's slot definition.

The sub-anatomy mechanism ([ADR-030](./030-sub-anatomy.md)) was designed exactly for this drift profile. ADR-030's "Phase-2 follow-ups" listed `header-bar` as a candidate. ADR-032 (close-button) shipped first because it had higher reuse density (6/6 components) and a cleaner naming-consolidation moment. Header-bar is the next-strongest candidate.

## Decision

**Author `content/sub-anatomies/header-bar.yaml`** as the third canonical sub-anatomy. Two-slot composite:

| Slot     | `slotKind`    | `code.semantic`   | Role |
|----------|---------------|-------------------|------|
| `header` | `structural`  | `heading-region`  | The wrapper region. Not itself a heading. Spans the full inline-size of the host's container so co-mounted close-buttons land at the inline-end edge. |
| `title`  | `content`     | `heading`         | The real heading element. Referenced by the host container's `aria-labelledby`. Visually-hidden titles are valid when no visible title is desired. |

The two-slot split surfaces the canonical APG rule "header is a region, not a heading" structurally rather than only in `a11y.hint` prose. The `aria-labelledby`-target relation between the host container and the title slot becomes a visible structural relation in the resolved anatomy.

**Sub-anatomy `a11y.groupRule` and `focusRule`** carry the canonical region-vs-heading rule and the canonical focus rule (focus does not land on header or title; APG focus targets the body's first interactive element or the close-button when no body interactive exists).

**Reuse roster: 3 components.**

| Component | Migration                                                                                              |
|-----------|--------------------------------------------------------------------------------------------------------|
| `modal`   | Replace inline `header` + `title` slots with `$ref: header-bar` (parent: container). Override `header.required: false` (alert-dialog inlines title with body). |
| `drawer`  | Replace inline `header` + `title` slots with `$ref: header-bar`. Override `header.required: false` (filter panels embed title in body) + `header.figma` (drawer's header is at the inline-start edge). Override `title.a11y.hint` (drawer's visually-hidden-title canon). |
| `popover` | Replace inline `header` slot with `$ref: header-bar`. Override `header.required: false` (small popovers skip header) + `header.tokens.spacing` (Popover uses `spacing.tight` not Modal/Drawer's `spacing.compact`). Override `title.required: false` (small popovers omit title; accessible name comes from trigger's `aria-describedby` or body's first textual content). **This migration introduces a `title` slot to Popover for the first time** — closes the canon gap noted in Context. |

**Co-mount with close-button (ADR-032).** All three consumers also mount the `close-button` sub-anatomy as a separate `$ref` entry with `parent: header`. After resolution, the close-button host is a child of the header wrapper — same structural relation as before the migration. Because `subAnatomySchema.slots` is `array(anatomySlotSchema)` (no `$ref` shape inside sub-anatomies), header-bar cannot nest close-button via `$ref` from the inside; the consumer mounts both sub-anatomies separately and the parent-child relation is expressed via the `parent: header` ref-level layout hint on the close-button entry.

Modal becomes the **first triple-sub-anatomy component** (header-bar + close-button + action-group) — proof that the ADR-030 mechanism stacks cleanly when three orthogonal canonical patterns co-occur.

## Rationale

- **Single source of truth, third proof.** Three components share an identical wrapper-region + title-heading pattern. ADR-030's machinery absorbs the drift without schema changes.
- **Two slots is the right depth.** A one-slot lift (just the wrapper) would centralize the wrapper rule but leave the title-typography canon scattered. A three-or-four-slot lift (eyebrow + title + subtitle + close-button) would speculate on consumer needs that no current consumer expresses. Two slots match the actual canonical pattern.
- **Closes Popover's title canon gap.** Popover's `header.purpose` claimed "grouping title and close affordance" but had no title slot. The migration introduces a title slot (overridden `required: false`) so the canon now structurally documents that a popover can carry a title. This is the kind of side-benefit the sub-anatomy mechanism was designed to surface — drift between prose and structure.
- **Header-bar does not nest close-button.** Schema constraint: `subAnatomySchema.slots` is `array(anatomySlotSchema)` only — sub-anatomies cannot reference other sub-anatomies via `$ref`. Allowing nesting would require recursive resolution and cycle-detection in the loader; the schema cost is non-trivial. The cleaner alternative — consumer mounts both sub-anatomies as separate `$ref` entries — exercises the existing mechanism without a schema change. Modal's resolved anatomy is unchanged: header → title; close-button → close-icon, close-label; both close-button and title carry `parent: header` in their resolved layout. Same structural relations, two `$ref` entries instead of one.
- **Token canonicalization choice.** Header padding/gap `spacing.compact` is canonical in the sub-anatomy because it matches Modal and Drawer (2 of 3 consumers); Popover overrides to `spacing.tight` because it is a smaller surface. Title typography `text.lg` / `weight.semibold` / `leading.tight` is canonical because both Modal and Drawer have it identically. Popover lacked a title slot today, so token canon for title is "what Modal and Drawer agree on" — Popover gets these by default after migration without overriding (consistent with the canonical popover-title pattern: when popovers do carry a title, it should be a heading at this size).

### Why Accordion is excluded

Accordion has a `header` slot at line 89 of `content/components/accordion.yaml` — but it is structurally a different abstraction. Accordion's `header.code.semantic` is **`heading`**, not `heading-region`. APG accordion-pattern explicitly requires the heading element to wrap the toggle button:

> Each accordion header is wrapped in an element with role heading that has a value set for aria-level that is appropriate for the information architecture of the page.

Accordion's `header` *is* the heading; Modal/Drawer/Popover's `header` is a wrapper region *containing* a heading. Forcing both into the same sub-anatomy would conflate two APG-distinct patterns. Accordion's pattern (header-as-heading wrapping button) is canonical-different and would warrant its own sub-anatomy if the pattern recurs elsewhere — which it currently does not.

### Why Card / Banner / Alert are excluded

- **Card.** Card has `eyebrow` (line 28), `title` (line 57), `subtitle` (line 89) laid out vertically as part of the body grid — an article-top-matter pattern, not a header-bar wrapper. The eyebrow + title + subtitle composition is its own canonical thing (closer to a CMS card layout); it does not share the wrapper-region semantic of Modal/Drawer/Popover.
- **Banner / Alert.** Both have a `title` slot but no header wrapper. The title is a body-grid cell sitting next to the severity icon and the textual content — a horizontal grid, not a vertical wrapper-and-heading split. The wrapper-region rule does not apply.

These are canonical exclusions, not oversight. They are documented here so a future author asking "why doesn't Card use header-bar?" finds the answer.

### Why no `eyebrow` or `subtitle` slots in the sub-anatomy

ADR-030 set the precedent that sub-anatomies should not speculate on slots no current consumer uses. Modal, Drawer, and Popover all have just `header` + `title` today; none have eyebrow, subtitle, status-icon, or breadcrumb-trail in their headers. Adding optional slots that no consumer expresses would be premature design. If a future consumer (or design-system precedent) demands those, the sub-anatomy gains them additively in a follow-up ADR — same path action-group reserves for hypothetical fourth-action.

## Consequences

**Positive:**

- Three components share one canonical header-bar definition. Wrapper-region + title-heading rule lives once.
- Popover's title canon gap closes — the canon now structurally documents that popovers can carry a title.
- Modal becomes the first triple-sub-anatomy component (header-bar + close-button + action-group). Three orthogonal canonical patterns stacked cleanly via three `$ref` entries — proof that the mechanism scales when overlays carry multiple canonical concerns.
- MCP `list_sub_anatomies` length grows from 2 to 3. `get_sub_anatomy header-bar` returns the canonical header definition.
- `search_components({ query: "header-bar" })` matches Modal / Drawer / Popover via the existing referenced-sub-anatomy-id haystack extension.

**Negative:**

- Schema constraint discovered during planning: `subAnatomySchema.slots` is `array(anatomySlotSchema)` only — sub-anatomies cannot nest other sub-anatomies via `$ref`. The cleaner alternative (consumer mounts both sub-anatomies as separate `$ref` entries) works for this case, but a future authentic composition need (e.g. a "card-top-matter" sub-anatomy that wants to mount `header-bar` inside) would require schema work. Documented here so future ADRs do not re-discover the constraint.
- Popover gains a new title slot it did not have before. Any downstream that enumerated Popover's slot ids would now see one extra entry. Unlikely to break anything; documented.

**Migration footprint:**

- `content/sub-anatomies/header-bar.yaml` — new file (~110 LOC).
- `content/components/{modal,drawer,popover}.yaml` — three migration edits, each replacing the inline `header` (+ `title` for Modal/Drawer) slot blocks with a `$ref: header-bar` entry plus per-consumer overrides.
- `mcp-server/tests/server.test.ts` — extend `list_sub_anatomies` and `get_sub_anatomy` tests for `header-bar`.
- `docs/backlog.md` — flip `P6-148 [x]`. P6-149 (`icon-leading-text`) becomes the active path.

No schema changes. No loader changes. No bundle-script changes. No site-render changes. Third proof that ADR-030's mechanism is sub-anatomy-id-agnostic.

## Alternatives considered

- **Allow `$ref` inside `subAnatomySchema.slots`.** Rejected for this rollout — recursive resolution + cycle-detection is non-trivial schema work and there is no current need beyond cosmetic ("header-bar references close-button"). Consumer-level co-mount (Modal lists three `$ref` entries) is structurally equivalent in the resolved anatomy and exercises only the existing mechanism.
- **Include Accordion.** Rejected. Accordion's `header.code.semantic: heading` is canonical-different (APG accordion-pattern requires header-as-heading). Forcing it into header-bar would conflate two APG-distinct patterns.
- **Include Card / Banner / Alert.** Rejected. Card's eyebrow/title/subtitle is article-top-matter; Banner/Alert's title is body-grid-cell. Neither has the wrapper-region semantic.
- **Author header-bar without migrating Popover (defer to a later pass).** Rejected. Popover's title canon gap is a real today-problem; the migration is the moment to close it. Skipping Popover would leave `list_sub_anatomies` advertising header-bar with only 2 consumers and Popover still claiming "grouping title" with no title slot.
- **Add `eyebrow` and `subtitle` slots speculatively.** Rejected. ADR-030 precedent: sub-anatomies do not speculate on slots no current consumer uses. Additive future change if a real consumer surfaces.
- **Replace Popover's `header.purpose` prose to remove the "grouping title" mention instead of adding a title slot.** Rejected. The prose was correct intent — Popover canonically supports headers with titles. Fixing the canon by removing surface would be regression; fixing it by adding the title slot via header-bar is what the sub-anatomy mechanism is for.
