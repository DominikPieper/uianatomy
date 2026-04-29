# ADR 006: Canonical Token Layer with Implementation-Specific Values

**Status:** Accepted
**Date:** 2026-04

## Context

Phase 1 produces 5 fully documented canonical components. Phase 2 audits each against a real implementation (Atelier UI first; Radix and others later, per the roadmap). Without an explicit token concept in the canonical schema, the audit has nowhere to record token-level divergence — every difference in spacing, radius, or color collapses into either a `divergence: reshaped` row or a free-form `notes` paragraph. Both options lose signal:

- `reshaped` is reserved for structural anatomy changes (per ADR-004); using it for token differences inflates the divergence count and mixes two unrelated concerns
- Free-form notes are not queryable and cannot drive the Designer view's token tables or the Bridge view's "what changes when this becomes Atelier" comparison

The canonical reference also has a Bridge-view gap today. Designers ask "what spacing scale does this slot use?" and the canon answers nothing. Developers ask "which color token belongs on the title?" and the canon answers nothing. Both are reasonable questions for a reference about UI anatomy, and both require a vocabulary the canon currently lacks.

A token layer must be added before the schema migration in backlog item P1-5 and before `implementations/atelier/` is populated, so neither can be rebuilt afterwards.

ADR-001 (Canon first) and ADR-004 (Strict data separation) constrain the design. The canon must remain library-agnostic, and concrete values must not appear in `content/components/`.

## Decision

Tokens enter the schema as a **two-layer model**:

1. **Canonical layer** — `content/components/<id>.yaml` declares **token names** per anatomy slot. Names are semantic (`spacing.compact`, `radius.md`, `color.text.primary`), not values (`8px`, `0.5rem`, `#0F172A`).
2. **Implementation layer** — `implementations/<lib>/<id>.yaml` binds canonical token names to concrete values and source tokens (`$ds-spacing-3`, `--ds-color-text-primary`).

Tokens attach **per slot**, on the existing `anatomy[]` entries, in five fixed categories: `spacing`, `radius`, `color`, `elevation`, `typography`. All five categories and the `tokens` field itself are optional.

## Rationale

### Author hygiene (canon stays library-agnostic)

Putting concrete values in `content/components/` would silently couple the canon to whichever design system was documented first. ADR-001 already forbids this for components and variants; tokens need the same forcing function. The canonical schema literally has no slot for `'8px'` — it only accepts a name. A canonical author who tries to write `padding: 8px` gets a schema error; a canonical author who writes `padding: spacing.compact` is doing the right thing by construction.

This mirrors ADR-004's discipline: separation by file structure, not by good intentions.

### Independent evolution (values churn, semantics don't)

Token *values* change frequently — across libraries, across themes, across versions of the same library. Token *meanings* (what "compact spacing" or "elevated surface" denotes) change rarely. Storing names in the canon and values in implementations lets each lifecycle move at its own pace:

- A library bumps `--ds-spacing-3` from `12px` to `14px` → only `implementations/<lib>/<id>.yaml` changes
- A new theme is added → a new `implementations/<lib>/` directory; canon untouched
- The semantic token vocabulary itself shifts (e.g., adding `spacing.dense` between `compact` and `tight`) → canonical schema migration, version-bump ADR

### Why per-slot, not top-level

The same slot name carries different token expectations across components. `Card.title` and `Modal.title` share the slot id `title` but want different typography weights, different spacing, and arguably different color treatments. A top-level `tokens:` map keyed by category (`tokens.spacing.compact: ...`) cannot express this — it forces every `title` slot in the canon to share a single token assignment, or forces authors to invent slot-prefixed token names (`title-card-padding`, `title-modal-padding`), which is just per-slot tokens with worse ergonomics.

Per-slot attachment also keeps the data model regular: the slot is already where every other domain (figma/code/a11y) attaches. Tokens become the fourth domain on the same anchor.

### Why these five categories, no more

`spacing`, `radius`, `color`, `elevation`, `typography` cover what every mature design-token system exposes (W3C Design Tokens Format, Material 3, Polaris, Spectrum). Adding more (motion, breakpoints, opacity) is tempting but premature: backlog items P1-6 (motion) and P1-7 (responsive) have their own dedicated sections, with their own concerns (durations + easing for motion, breakpoint transitions for responsive). Keeping the token categories static prevents this ADR from becoming a junk drawer.

## Schema sketch

Canonical side — extend `anatomySlotSchema` in `shared/src/schema.ts` (deferred to P1-5; this ADR fixes only the form):

```yaml
anatomy:
  - id: title
    required: true
    purpose: Primary heading of the card
    layout: { row: 2, col: 1 }
    figma: { type: text, hint: '...' }
    code: { slot: title, semantic: heading }
    a11y: { hint: '...' }
    tokens:                                # NEW, optional
      spacing:
        padding: spacing.compact
      typography:
        size: text.lg
        weight: weight.semibold
        lineHeight: leading.tight
      color:
        foreground: color.text.primary
```

Each category is an optional map from a slot-property name (`padding`, `size`, `foreground`) to a canonical token name (`spacing.compact`, `text.lg`). Token names follow `category.scaleStep` dotted notation. The canon does not enumerate the legal set of names — that vocabulary will be defined by P1-5 alongside the schema migration, and recorded in `docs/schema.md`.

Implementation side — new `tokenBindings` field in `implementations/<lib>/<id>.yaml`, parallel to the existing `divergence` field:

```yaml
componentId: card
libraryId: atelier
componentName: ui-card
divergence: [...]                          # existing, structural divergence
tokenBindings:                             # NEW
  - slot: title
    category: spacing
    property: padding
    canonicalToken: spacing.compact
    value: '12px'
    sourceToken: '$ds-spacing-3'
  - slot: title
    category: typography
    property: size
    canonicalToken: text.lg
    value: '1.125rem'
    sourceToken: '$ds-text-lg'
lastReviewed: 2026-04-15
```

Each binding states the canonical name, the resolved value, and the implementation's own source token reference. This is queryable, auditable, and survives the library renaming its tokens (the `canonicalToken` stays stable; `sourceToken` updates).

## Phase 1 implication

The `tokens` field on canonical anatomy slots is **optional**. Phase 1 ships **without migrating the existing 5 YAMLs**. Backlog item P1-5 owns the schema change in `shared/src/schema.ts`, the migration of all five components, and the Designer-view `TokensTable.astro` render. P1-5 runs in its own plan session.

`implementations/atelier/` does not yet exist. When it is created in Phase 2, `tokenBindings` is the field that records every concrete value Atelier resolves.

The MCP tool surface stays unchanged in Phase 1. Backlog item P4-24 adds `get_tokens` once token data exists in real YAMLs.

## Consequences

**Positive:**

- Phase 2 audits can record token-level divergence without inflating `divergence: reshaped` or relying on free-form notes
- Designer view gains a real token table per component once P1-5 lands
- Bridge view can show "canonical name → Atelier value → Radix value" three-way comparison
- Library-specific value churn never touches canonical files
- The schema captures a long-asked question ("which spacing belongs here?") in its own first-class section

**Negative:**

- Two more nouns to keep straight (`tokens` in canonical, `tokenBindings` in implementation) — mitigated by both following the same domain-attachment pattern as ADR-004's `divergence`
- Canonical authors now have to choose token names; the vocabulary is one more thing to learn — mitigated by P1-5 publishing the legal name set in `docs/schema.md`
- Adds a sixth concern to anatomy slots (figma, code, a11y, layout, required, tokens), increasing per-slot density — accepted because the alternative (separate top-level `tokens:` block) loses slot identity

**Neutral:**

- A future ADR may add `motion` and `responsive` categories alongside the existing five; deferred per backlog P1-6 / P1-7, where those concerns get their own structured sections rather than being squeezed into tokens
- Some token concepts straddle categories (e.g., focus ring is part `color`, part `elevation`); these are documented as multiple bindings on the same slot, not as a new "focus" category

## Alternatives considered

**Concrete values directly in canonical YAML:** rejected. Violates ADR-001 (canon-first); couples the canon to the design system that gets documented first; makes theme/library swap a canonical-data migration. The whole point of separation is that canon remains the library-agnostic layer.

**Top-level `tokens:` map keyed by category, not per slot:** rejected. The same slot id (`title`, `body`, `media`) appears in multiple components with different token expectations; a top-level map cannot express per-component-per-slot variance without slot-prefixed token names, which reintroduces per-slot attachment with worse ergonomics. Also breaks symmetry with how figma / code / a11y already attach to each slot.

**Token data only in implementations, never in canon:** rejected. The Designer view loses any Phase-1 answer to "what spacing scale does this slot use?" until at least one implementation exists. Canonical *names* are the right level of canon-side commitment — they describe semantics, not values, and semantics is what the canon is for.

**Adopt the W3C Design Tokens Format Module verbatim:** considered. Rejected as the canonical surface because DTCG describes a token catalogue (a flat namespace of named values), while the canon needs a *binding* model (which slot uses which token). DTCG is the right shape for `implementations/<lib>/`-side `sourceToken` references and may be adopted there in Phase 2 if a library exposes its tokens in DTCG format; the canonical layer keeps the simpler dotted-name vocabulary.
