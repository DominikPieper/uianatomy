# ADR 012: `whenToUse` Section Replacing Bare `related[]`

**Status:** Accepted
**Date:** 2026-04

## Context

Phase-1 components have shipped with a bare `related: [slug, ...]` field at the top of each YAML and a row of chips at the top of each component page. Five of five Phase-1 components declare `related[]`; every entry references a component that is not yet documented (Tile, ListItem, Drawer, Popover, Alert, Accordion, SegmentedControl, SidebarNav, Select, SearchInput, TagInput, Link, IconButton, MenuButton). The chips link to `/components/<id>` and currently resolve to 404s.

Two problems:

1. **The chips carry no rationale.** A reader sees `Card → tile, list-item` with no answer to "*which* of these should I use, and *when* should I pick Card over the others?" This is the highest-frequency designer-developer alignment question — "which component is the right one?" — and the canon today gives zero structural guidance.
2. **The bare `related[]` field is a flat list with no diff prose.** ADR-001 ("Rationale, not just rules") explicitly requires every documented decision to carry a *because*. The `related[]` field is the one place in the canon where that discipline is broken — the relation is asserted without being justified.

The backlog has this filed as P2-12, with the description "Schema-Feld `whenToUse?: { use, avoid, vsRelated: [{ id, difference }] }` ersetzt nackte `related[]`-Chips." The replacement is structural, not additive — `related[]` is gone, `whenToUse` is the new surface, and the migration is one-time across all five Phase-1 components.

ADR-001 (Canon first), ADR-004 (schema is a contract), and ADR-006 (canonical names, not values) all constrain the design. `whenToUse` stores *prose* and *per-related differentiators*; concrete library mappings ("Radix `Dialog` is our Modal") live in `implementations/<lib>/`.

## Decision

`whenToUse` enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`, `responsive`, `events`. The bare `related: z.array(slug).optional()` field is **removed** from the schema in the same migration; its data and semantics are subsumed by `whenToUse.vsRelated[].id`.

```ts
const vsRelatedEntrySchema = z
  .object({
    id: slug,
    difference: z.string().min(1),
  })
  .strict();

const whenToUseSchema = z
  .object({
    use: z.string().min(1),
    avoid: z.string().min(1),
    vsRelated: z.array(vsRelatedEntrySchema).min(1).optional(),
  })
  .strict();

// componentSchema gains: whenToUse: whenToUseSchema.optional()
// componentSchema loses: related: z.array(slug).optional()
```

YAML form:

```yaml
whenToUse:
  use: >-
    When the user must focus on a single decision or input that blocks
    the underlying flow — confirmations, destructive actions,
    multi-step wizards.
  avoid: >-
    For non-blocking notifications — `Toast` or `Banner`. For
    contextual content anchored to a trigger — `Popover`.
  vsRelated:
    - id: drawer
      difference: >-
        `Drawer` slides from a viewport edge and may be modal or
        non-modal; `Modal` always centres and is always modal.
    - id: popover
      difference: >-
        `Popover` is non-modal, anchored to a trigger, and dismissable
        by outside-click without ceremony.
```

Render: a new `WhenToUseSection.astro` slots into `[id].astro` directly after the component hero (description), before the anatomy diagram. View-agnostic — Designer, Bridge, and Dev views all see the same section, because "should I use this?" is a decision that precedes role-specific deep-dives. The previous `related-row` chips block in the page hero is removed; chip-style links to related components live inside `WhenToUseSection.astro`'s `vsRelated` list.

## Rationale

### Why replace `related[]`, not coexist with it

A coexistence model — keep `related[]` as a quick flat list, add `whenToUse` as a richer structure — was considered. Rejected:

1. **Two ways to spell the same data.** `related: [tile, list-item]` and `whenToUse.vsRelated: [{id: tile, ...}, {id: list-item, ...}]` would carry the same identifier set with no canonical answer to "which one is authoritative when they disagree?" ADR-001's "single source of truth" line forecloses this.
2. **Chips without rationale fail the canon contract.** ADR-001 also says every documented decision needs a *because*. A bare relation chip names a relation but supplies no rationale — exactly the failure mode the canon exists to prevent. Keeping `related[]` would preserve a structural exception to the rule.
3. **Migration is small.** Five components, two-to-three related ids per component. Writing `use`, `avoid`, and one-paragraph `difference` per related id is roughly 15 lines per YAML — the cost of doing the migration once is lower than the cost of carrying both fields forward indefinitely.

### Why per-component, not per-relation

A "global" relations table (`docs/relations.yaml` listing every pair of components and their differences) was considered. Rejected:

1. **Scaling.** With *N* components, the relations table grows quadratically. Even at *N=20* (P4-25's view-strategy threshold), the table has up to 190 entries; most of those pairs are uninteresting.
2. **Locality.** A reader looking at the Modal page wants to know "Modal vs Drawer", not the entire relations matrix. Per-component co-location keeps the relevant rationale next to the component being documented.
3. **Asymmetry.** `Card vs Tile` and `Tile vs Card` are not the same prose — they emphasise different things from each side. Per-component entries naturally allow asymmetric phrasing without forcing a "canonical direction".

### Why `use` and `avoid` are both required

A schema with `use` only (and `avoid` optional) was considered. Rejected: most "should I use this?" questions are answered as much by *what to pick instead* as by *when to pick this*. Forcing both fields makes authors think about the negative case, which is where mistakes live (the user who reaches for Modal when they wanted Toast, the user who reaches for Tabs when they wanted Stepper). The discipline matches ADR-008's required-`change` prose on breakpoints — the prose is the field, you cannot opt out of writing it.

### Why `vsRelated` is optional but non-empty when present

Some future components may have rich `use` / `avoid` prose without a meaningful set of "vs other components" comparisons (a one-off pattern with no near-neighbours). Forcing `vsRelated` would punish those components. Allowing empty `vsRelated: []` would let an author declare the field then declare zero entries — the same dead-letter pattern that `events: []` and `breakpoints: []` are forbidden from. Optional-but-non-empty-when-present hits both constraints.

### Why `difference` is free-text, not structured

A structured difference (`difference: { dimension: 'modality', value: 'always-modal-vs-may-be-non-modal' }`) was considered. Rejected for the same reasons ADR-009 rejected structured triggers and ADR-008 rejected structured `change`: the space of differentiators is open and tail-heavy. Modal-vs-Drawer is about modality; Tabs-vs-Accordion is about how-many-panels-visible; Card-vs-Tile is about content-vs-image-led. Encoding the dimension as a fixed enum either omits Phase-2 differentiators (compositionality, focus model, dismissal style) or balloons into a flat "any string" key that adds no validation. Free prose is the right shape for this kind of comparison.

### Why one render section, not view-specific

`whenToUse` could plausibly render in three different ways across Designer / Dev / Bridge views (designer prose vs developer prose vs comparison table). Rejected: "should I use this?" is a single decision that precedes the role-specific deep-dive. Rendering the same content three different ways produces three slightly-different documents about the same decision, which is exactly the "drift between artifacts" failure ADR-001 was written to prevent. One section, view-agnostic, before the view-tabs.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P2-12):

```ts
const vsRelatedEntrySchema = z
  .object({
    id: slug,
    difference: z.string().min(1),
  })
  .strict();

export const whenToUseSchema = z
  .object({
    use: z.string().min(1),
    avoid: z.string().min(1),
    vsRelated: z.array(vsRelatedEntrySchema).min(1).optional(),
  })
  .strict();

// componentSchema:
//   - removed: related: z.array(slug).optional()
//   - added:   whenToUse: whenToUseSchema.optional()
```

Implementation side — none. `whenToUse` is canon-only; Phase-2 implementations do not record per-library "Radix Dialog is our Modal" mappings here. That information lives in `implementations/<lib>/<id>.yaml` as the implementation YAML's own header (`canonicalId: modal`, `library: radix`, `componentName: Dialog`).

## Phase 1 implication

All five Phase-1 components migrate to `whenToUse` in one pass. Every previously-declared `related[]` id appears as a `vsRelated[i].id` with a paragraph of `difference` prose. The bare `related[]` blocks are removed from the YAMLs and the field is removed from the schema. The render template (`site/src/pages/components/[id].astro`) loses the `related-row` chips block and gains a `<WhenToUseSection>` slot before the anatomy diagram.

The MCP tool surface stays unchanged. Backlog item P4-24 picks up a `get_when_to_use` tool once Phase-2 audits surface a concrete consumer.

## Consequences

**Positive:**

- Every related component reference now carries rationale (the `difference` prose), closing the bare-chip loophole that violated ADR-001's "rationale, not just rules" rule.
- The "should I use this?" question gains a structural answer rendered upfront, before the anatomy diagram. Reduces the time a reader spends guessing whether they have the right component.
- Bridge view's value increases: the canonical "designer thinks Card, developer thinks Tile" mismatch is now in data, not implicit.
- Future MCP tools can answer "what is the difference between Modal and Drawer?" with a one-line lookup instead of prose-parsing.

**Negative:**

- Authoring overhead per component grows by ~15 lines (use + avoid + per-related difference). Mitigated by the small Phase-1 surface (5 components × ~15 lines = ~75 lines total) and the fact that the prose was already implicit in mismatches/mistakes — formalising it costs less than re-deriving it on every read.
- Removing the bare `related[]` field is a breaking schema change. Mitigated: the migration is one-time across all five existing YAMLs, and the schema/test combination catches any retained `related:` blocks at parse time once the field is gone (non-strict schema silently drops them, but the rendered chips disappear immediately, surfacing the gap).

**Neutral:**

- A future `whenToCompose` field may emerge for components that pair with others in a near-required way (Modal with Toast, Combobox with Form). Out of scope for P2-12; file as a follow-up if it becomes a recurring need.
- The `vsRelated[].id` slug references components that may not yet be documented. Templates render those as anchor links to `/components/<id>` which 404 until those components ship; this is the pre-existing behaviour and is preserved.

## Alternatives considered

**Coexist `related[]` with `whenToUse`**: rejected. Two ways to spell the same data; a bare-chip surface that violates ADR-001's rationale rule; ongoing "which one is authoritative?" question.

**Global relations table (`docs/relations.yaml`)**: rejected. Quadratic scaling, lost locality, forced symmetry that doesn't match how cross-component prose actually reads.

**`use` only, `avoid` optional**: rejected. The negative case is where most component-choice mistakes live; making `avoid` required forces authors to think about it.

**Empty `vsRelated: []` allowed**: rejected. Same dead-letter pattern as `events: []` and `breakpoints: []` are forbidden from. Optional-but-non-empty-when-present is the right shape.

**Structured `difference` payload**: rejected. The space of differentiators is open and tail-heavy; free prose is the right shape, same as `breakpoints[].change` (ADR-008) and `transitions[].trigger` (ADR-009).

**Per-view `whenToUse` rendering** (different content per Designer / Dev / Bridge): rejected. Splits one decision into three slightly-different documents about the same decision; ADR-001's "single source of truth" rule applies to render output too.

**Keeping `related[]` and adding `whenToUse` as supplementary**: rejected. The supplementary form would either be ignored (chips kept, rich section unread) or duplicate the chip data without justification.
