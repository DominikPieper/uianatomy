# ADR 020: Optional `slotKind` Vocabulary for Anatomy Slots

**Status:** Accepted
**Date:** 2026-04

## Context

Phase 1 and Phase 2 layered substantial new domains onto every anatomy slot — `tokens` (ADR-006), `motion` (ADR-007), `responsive` (ADR-008), `events` (ADR-011), `propertyMap` (ADR-015), `a11yAcceptance` (ADR-014), `formIntegration` (ADR-016), `performance` (ADR-018), and the `axes.states` graph (ADR-009). The canonical schema is now informationally rich. The anatomy SVG, however, communicates only structural facts: required vs optional (solid vs dashed stroke), parent vs leaf, floating slots, repeats, overlay.

A second observation: the existing slot fields `figma.type` and `code.semantic` describe *implementation surface* (Figma's component-property type vocabulary; the rendered HTML element's role). Neither captures the canonical *function* of a slot — whether the slot is decoration, structural scaffolding, content carrier, or interactive control. That distinction is invariant across implementations and useful for visual hierarchy, search facets, and downstream tooling, but no field carries it today.

ADR-005 deferred "inline annotations (arrows, callouts) on diagrams" until there's clear demand. The demand has now arrived in two forms: visual hierarchy is harder to read as anatomies grow more nested, and the gap between SVG and the data tables underneath the diagram has become the primary cognitive cost of the page.

## Decision

Add an **optional** enum field `slotKind` to `anatomySlotSchema`, with exactly four values:

- `structural` — scaffolding that holds other slots (container, header, footer, region wrappers, body)
- `interactive` — invokes user action (button, trigger, close, link, control)
- `content` — carries information (title, label, description, body text, helper)
- `decorative` — non-essential affordance (backdrop, overlay, divider, ornament)

`slotKind` is **optional** — YAMLs that omit it render with a default neutral stroke and pay no semantic price. The site's SVG renderer maps `slotKind` to a stroke-color hue (default ink for `structural`; accent-active for `interactive`; warm-mix for `content`; faint for `decorative`). Fill is reserved for nesting depth (separate axis), so the two visual encodings do not collide.

`slotKind` does not enter the MCP tool surface in this iteration. It will be added to `get_anatomy` once at least 80% of the canonical roster declares it (currently 23 components migrated to declared values; threshold reached at landing).

## Rationale

### Why a closed enum, not free-form

Free-form strings would re-create the `code.semantic` problem — a vocabulary that drifts because nothing constrains it. Four values cover the four functional roles a slot plays in any UI primitive we've documented (Card, Modal, Combobox, Tabs, Accordion, etc.). Rare edge cases (e.g., a slot that is both interactive and decorative) resolve by picking the dominant role and noting nuance in `purpose`. The enum can be extended in a future ADR if a recurring fifth role emerges; it cannot be retroactively closed if it starts as free-form.

### Why optional, not required

Making `slotKind` required forces a 23-file migration as a prerequisite for landing the schema change. Making it optional lets the schema land first, the renderer adapt, and the YAMLs migrate at a pace the author can verify per component. No drift risk, because the renderer's default is neutral — slots without `slotKind` look exactly like they look today.

### Why not derive from `figma.type` or `code.semantic`

- `figma.type` is `frame | text | instance | rectangle | text-or-frame` — Figma's authoring vocabulary. A `frame` is a body or a header indistinguishably; a `text` is a title or a label indistinguishably. The mapping is many-to-many.
- `code.semantic` is free-form prose grown organically across 23 YAMLs (`heading`, `dialog-or-alertdialog`, `presentational-overlay`, etc.). A normalization table would be brittle, and the field's purpose is to describe the rendered element, not the canonical role.

`slotKind` is a fifth, orthogonal facet with a stable closed vocabulary. That's why it earns its own field rather than being computed.

### Why this is canon-clean

ADR-001 forbids library-specific facts in canon. `slotKind` describes the slot's *function*, which is identical across libraries — Modal's backdrop is decorative whether it's Radix, Headless UI, or CDK Dialog. The four values name *what the slot is for*, not *how it looks*. No concrete colors, no design-system tokens, no library names. The renderer's mapping from `slotKind` to a hue lives in `site/`, not in the canon.

## Schema change

```diff
 export const anatomySlotSchema = z.object({
   id: slug,
   required: z.boolean(),
   purpose: z.string().min(1),
+  slotKind: z.enum(['structural', 'interactive', 'content', 'decorative']).optional(),
   layout: layoutHintSchema,
   figma: figmaHintSchema,
   code: codeHintSchema,
   a11y: a11yHintSchema,
   tokens: slotTokensSchema.optional(),
 });
```

Plus an exported `SlotKind` type and `slotKindSchema` enum, parallel to existing exports.

## Migration heuristic for the existing 23 components

| Slot id pattern | `slotKind` |
|---|---|
| `backdrop`, `overlay`, `scrim`, `divider` | `decorative` |
| `close-button`, `trigger`, `submit`, `dismiss`, anything `*-button`, `link`, `tab`, `option`, `chevron`, `chevron-icon`, `caret` | `interactive` |
| `title`, `label`, `description`, `body`, `text`, `helper`, `caption`, `hint`, `value`, `placeholder`, `eyebrow` | `content` |
| `container`, `header`, `footer`, `region`, `panel`, `wrapper`, `group`, `section`, `list`, `popover`, `surface` | `structural` |

Edge cases resolved on read of each YAML; the heuristic is a starting point, not a substitute for judgement.

## Phase implication

Phase 1 / Phase 2 outputs are unaffected at the schema-validation level. Phase-2 implementation YAMLs (`implementations/<lib>/`) do not gain a `slotKind` mirror — slot kind is canonical, not implementation-specific. The MCP tool surface is unchanged in this iteration; `get_anatomy` will surface `slotKind` in a follow-up once full roster coverage is verified.

## Visual encoding (rendered in `site/`, not canonical)

| `slotKind` | Stroke hue | CSS variable |
|---|---|---|
| (omitted) | neutral ink | `--diagram-stroke` |
| `structural` | neutral ink (same as omitted) | `--diagram-stroke` |
| `interactive` | accent-active | `--accent-active` |
| `content` | warm 35% mix | `color-mix(--accent-warm)` |
| `decorative` | faint | `--fg-faint` |

`structural` deliberately collapses with the default — it is the resting visual state. The other three earn their hue.

## Consequences

**Positive:**

- The diagram gains a fourth axis of communication (slot function) without abandoning its wireframe register.
- A long-implicit distinction (function vs. surface vs. role) becomes a queryable field.
- The schema gains a vocabulary that downstream tools (search facets, MCP, Bridge-view filters) can rely on.
- Migration is non-breaking; the field is opt-in per component.

**Negative:**

- Per-slot density grows by one field. Mitigated by the field being a single enum, not a sub-object.
- A canonical author has to make a judgement call on each slot. Mitigated by the migration heuristic above and by the four values being mutually exhaustive in practice.

**Neutral:**

- The visual mapping (hue per kind) lives in CSS and may evolve with the design refresh; the canon is unaffected by such changes.
- A future ADR may add a fifth value if recurring evidence demands it (e.g., `status` for badge-like slots that announce state). Deferred until at least three roster components reveal the gap.

## Alternatives considered

**Free-form `slotKind: string`:** rejected. Vocabulary drift across 23 files with no forcing function for normalization.

**Derive `slotKind` automatically from `figma.type` + `code.semantic` + heuristics:** rejected. Many-to-many mapping, brittle, hides the canonical decision behind a derivation table that is itself canonical-grade information.

**Add the field but make it required immediately:** rejected. Forces the 23-file migration as a prerequisite for the schema change, increasing the size of one PR and coupling concerns that don't need coupling.

**Encode the same information across `figma.type` and `code.semantic` with stricter vocabularies:** rejected. The two fields describe surface, not function. Conflating surface and function would degrade both.

**Use color in the SVG but key it off `tokens.color` presence:** rejected. `tokens.color` is about which color tokens the slot uses, not about the slot's function. The two facets are orthogonal and the diagram should not collapse them.
