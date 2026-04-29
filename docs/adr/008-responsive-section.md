# ADR 008: Responsive Section as a Top-Level Component Concern

**Status:** Accepted
**Date:** 2026-04

## Context

Four of the five Phase-1 canonical components — Card, Modal, Tabs, Combobox — change behaviour, layout, or activation at viewport breakpoints. The canonical reference today documents none of this:

- Card has an `orientation: 'vertical' | 'horizontal'` property, but the canon does not say that the horizontal variant collapses to vertical at narrow viewports regardless of the property. Designers and developers re-derive this rule per project.
- Modal has a `fullscreen` variant alongside `dialog` and `alertdialog`, but the canon does not say that the non-fullscreen variants render *as* fullscreen below a small breakpoint.
- Tabs has an `orientation: 'horizontal' | 'vertical'` property, but the canon does not say that vertical layouts are forbidden below a wide breakpoint (vertical tab columns claim too much inline space on narrow viewports).
- Combobox has a floating listbox with a documented portal model, but the canon does not say that on small viewports the floating listbox is replaced by the platform bottom-sheet picker — a wholesale swap of the activation surface, the keyboard model, and the framework-map mechanism.

Without an explicit field, this knowledge stays in design-system playbooks (or in the heads of senior designers and developers) and Phase-2 audits cannot record per-implementation breakpoint values. The Designer view has no responsive section, and the Bridge view loses one of its most useful "designers and developers see different things" moments.

ADR-006 (Token layer) reserved this slot in its Consequences:

> A future ADR may add `motion` and `responsive` categories alongside the existing five; deferred per backlog P1-6 / P1-7, where those concerns get their own structured sections rather than being squeezed into tokens.

ADR-007 was the motion ADR. This is the responsive ADR — the second half of the deferred pair. It is the precondition for backlog item P1-7.

ADR-001 (Canon first) and ADR-006 (canonical names, not values) constrain the design. Canonical responsive entries store *names* (`breakpoint.sm`); concrete pixel values live in `implementations/<lib>/`.

## Decision

Responsive enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`. Not on `anatomySlotSchema`.

The field is a single key — `breakpoints` — holding a non-empty array of `{ at, change }` records:

```yaml
responsive:
  breakpoints:
    - at: breakpoint.sm
      change: >-
        At and below, container fills the viewport, backdrop is suppressed,
        size property is ignored.
    - at: breakpoint.md
      change: >-
        Above this width, all variants render as authored.
```

Vocabulary published in `docs/schema.md`:

- `breakpoint.{xs, sm, md, lg, xl}`

Direction (above / below / between) is encoded in the `change` prose, not in the schema. The `at` token is the *threshold*; the prose describes which side of the threshold the change applies to.

## Rationale

### Why per-component, not per-slot

Responsive behaviour is a component-wide concern. Modal's "becomes fullscreen below sm" is not a property of the container slot, the backdrop slot, or the header slot — it is a property of the dialog as a whole. Tabs's "vertical orientation forbidden below lg" is a property of the tablist's relationship to the tabpanel layout, not of either slot in isolation. Per-slot attachment would force every responsive change to either pick a slot to anchor to (arbitrarily) or duplicate the same change across multiple slots.

This mirrors ADR-007's per-component decision for motion. Both fields parameterise behaviours that span the component as a whole.

### Why a free-text `change`, not a structured payload

A structured payload (`change: { kind: 'orientation-locked', value: 'vertical' }` or `change: { property: 'orientation', force: 'vertical' }`) was considered and rejected. Three reasons:

1. **The space of changes is open.** Modal's "container fills viewport, backdrop suppressed, size ignored" is three coordinated changes that share a single threshold. Combobox's "floating listbox replaced by platform picker, multi-select degrades to comma-separated tokens, async filter becomes synchronous" is four coordinated changes. A discriminated union of "kind" values would have to enumerate every possible kind, and the tail of one-off cases (Combobox's platform-picker swap is unique to it) defeats the structure.
2. **The audience is humans first.** The Designer view and Bridge view render the change so a designer or developer can read it and act. Prose is the form humans read fastest. Structured data would be parsed back into prose for display.
3. **Phase 2 implementations record concrete behaviour.** When `implementations/atelier/modal.yaml` lands, it records the actual breakpoint pixel value and the actual code that applies (`@media (max-width: 640px)`, `class="dialog--fullscreen-on-mobile"`). The canonical `change` is the *spec*; the implementation `responsiveBindings` (a future Phase-2 field) is the *binding*. The spec is prose; the binding is structured.

The existing `mismatches[].consequence` and `mistakes[].description` fields are also free-text strings for the same reason. Responsive joins that family.

### Why direction is in the prose, not the schema

Direction (`above` / `below` / `between two breakpoints`) was considered as a structured field. Three forms:

- `at: { token: 'breakpoint.sm', direction: 'below' }` — adds nesting for one extra word
- `direction: 'below', at: 'breakpoint.sm'` — flat but couples direction to a single threshold
- Token-encoded: `at: 'breakpoint.below.sm'` — pollutes the token namespace with directional variants

All three were rejected. Direction is one English word in the prose ("At and below, …" / "Above this width, …" / "Between sm and lg, …"), the prose has to be there anyway, and forcing it into the schema duplicates the information.

The schema enforces that breakpoints declare a threshold and a change. The prose enforces clarity about which side. Review enforces that authors don't write "things change here" without saying how.

### Why dotted-token names for `at`, not raw `Npx`

Same reason as ADR-007 for motion durations. ADR-006 already settled this for tokens. Canon stores semantic names; implementations bind names to concrete values. A canonical author writing `at: 640px` couples the canon to a single design system's breakpoint scale. A canonical author writing `at: breakpoint.sm` lets each implementation answer "what is sm?" with its own number (Tailwind says 640px, Material 3 says 600dp, Polaris says 768px, Apple HIG declines to answer for regular-width).

The existing `tokenName` regex from `shared/src/schema.ts:55-60` is reused verbatim — no new regex.

### Why a single `breakpoints` array, not a flat `breakpointsBelow / breakpointsAbove`

A flat keyed object (`breakpointsBelow.sm: change`, `breakpointsAbove.lg: change`) was considered. Rejected because some changes apply *between* two breakpoints (a tablet-only layout is the obvious case), and a flat keyed object cannot express "between sm and lg" without inventing a third bucket. The array form lets authors declare two adjacent breakpoints with prose like "At and above sm" / "At and below lg" and the reader composes the band.

The array also keeps the order meaningful (top-to-bottom narrow-to-wide), which matches how design teams write responsive specs in Figma.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P1-7):

```ts
export const breakpointEntrySchema = z
  .object({
    at: tokenName,                // tokenName reused from line 55
    change: z.string().min(1),
  })
  .strict();

export const responsiveSchema = z
  .object({
    breakpoints: z.array(breakpointEntrySchema).min(1),
  })
  .strict();

// componentSchema gains: responsive: responsiveSchema.optional()
```

Implementation side — deferred. When `implementations/<lib>/<id>.yaml` is created in Phase 2, responsive bindings parallel ADR-006's `tokenBindings` and ADR-007's planned `motionBindings`:

```yaml
responsiveBindings:
  - canonicalToken: breakpoint.sm
    value: '640px'
    sourceToken: '$ds-breakpoint-sm'
    mediaQuery: '(max-width: 639.98px)'
  - canonicalToken: breakpoint.md
    value: '768px'
    sourceToken: '$ds-breakpoint-md'
    mediaQuery: '(min-width: 768px)'
```

The shape is sketched here for review continuity; the schema entry for `responsiveBindings` is filed as a Phase-2 backlog item, not added in P1-7.

## Phase 1 implication

The `responsive` field on `componentSchema` is **optional**. Phase 1 ships migrating only the four components whose canonical entries already encode breakpoint-driven behaviour (Card, Modal, Tabs, Combobox). Button stays unmigrated — buttons do not change behaviour at viewport breakpoints in any documented design system.

The Designer view gains a Responsive section between Motion and Axes (`site/src/components/views/DesignerView.astro`). Bridge view and Dev view do not render responsive in Phase 1; the change prose is design spec, and the dev side gets concrete media queries via Phase 2 `responsiveBindings` rather than canonical names.

The MCP tool surface stays unchanged. Backlog item P4-24 picks up `get_responsive` once token data has been stable for one or more Phase-2 audits.

## Consequences

**Positive:**

- Card's "horizontal orientation collapses below sm" rule is now in the canon, not in tribal memory.
- Modal's "fullscreen below sm" rule is structural, not a footnote in mismatch prose.
- Tabs's "vertical forbidden below lg" rule joins the canonical reference instead of being re-derived per project.
- Combobox's "platform picker on mobile" rule — the most invisible rule in the set, since it is a wholesale activation-model swap — gains a structural counterpart.
- Designer view gains a real responsive section.
- Phase 2 audits can record per-implementation breakpoint values via a future `responsiveBindings` field without touching the canon.

**Negative:**

- One more optional top-level field on `componentSchema`. Mitigated: optional fields have zero migration cost for unaffected components.
- The `change` field is free-text, not structured. Mitigated: prose is the right form for human-facing canon spec; structured form lives in Phase-2 bindings.

**Neutral:**

- Breakpoint vocabulary is review-enforced, not regex-enforced (the `tokenName` regex permits any dotted name). This is identical to the discipline ADR-006 already established for token names; out-of-vocabulary breakpoint names parse but will not survive review and have no Phase-2 binding contract.
- Some responsive concerns straddle the boundary with motion (P1-6): a small-viewport swap might disable a transition. ADR-008 owns *what* changes at a breakpoint; ADR-007 owns *how* the change animates. They reference each other implicitly through prose; no cross-field schema relationship is encoded.

## Alternatives considered

**Per-slot responsive entries:** rejected. Responsive behaviour is component-wide; per-slot attachment would force arbitrary anchoring or duplication. Same rejection as ADR-007 made for motion.

**Structured `change` payload:** rejected. The space of canonical responsive changes is open and tail-heavy (Combobox's platform-picker swap is unique). The audience for the canon is humans first; Phase-2 bindings capture the structured form.

**Direction as a schema field:** rejected. One English word in the prose carries the same information without duplicating it in the schema, and preserves the option of "between two breakpoints" without inventing a third bucket.

**Raw pixel values for `at`:** rejected per ADR-006 discipline. Couples canon to a single design system's pixel scale; defeats the Bridge-view three-way comparison.

**One key per breakpoint (`belowSm: change`, `aboveLg: change`):** rejected. Cannot express "between sm and lg" without a third bucket; loses the natural narrow-to-wide ordering of an array.

**A general `viewport` token category under tokens (per slot):** rejected explicitly by ADR-006 line 130–131. Responsive is not a styling token; it is a component-wide behavioural switch. Forcing it into the per-slot tokens model either duplicates the change across slots or anchors it arbitrarily.
