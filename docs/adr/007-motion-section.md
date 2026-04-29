# ADR 007: Motion Section as a Top-Level Component Concern

**Status:** Accepted
**Date:** 2026-04

## Context

Three of the five Phase-1 canonical components — Modal, Combobox, Tabs — already encode motion implicitly:

- Modal carries data states `opening / open / closing / closed`, a mismatch row that explicitly names "transition states" against Figma variants, and a mistake the canonical reference does not yet document by name (developers ship without enter/exit animations).
- Combobox carries a transition-state mismatch ("data states (`open`, `busy`) toggled by the application; interactive states are CSS pseudo-classes") plus a `data-state="open"` reference in its frameworkMap.
- Tabs carries the mistake `tabs-indicator-not-rtl-aware`, which is wholly about how the indicator *moves*, not about what it looks like.

Without an explicit field, this knowledge stays trapped in prose. The Designer view has no motion section. Phase 2 audits cannot record per-implementation duration values per slot. The mistake `tabs-indicator-not-rtl-aware` has no structural counterpart that says "under reduced motion the indicator must jump, not slide."

ADR-006 (Token layer) reserved this slot in its Consequences:

> A future ADR may add `motion` and `responsive` categories alongside the existing five; deferred per backlog P1-6 / P1-7, where those concerns get their own structured sections rather than being squeezed into tokens.

This ADR is that future ADR for motion. It is the precondition for backlog item P1-6, the same way ADR-006 was the precondition for P1-5.

ADR-001 (Canon first) and ADR-006 (canonical names, not values) constrain the design. Canonical motion entries store *names*; concrete millisecond values live in `implementations/<lib>/`.

## Decision

Motion enters the schema as **one optional top-level field on `componentSchema`**, parallel to `axes`, `mismatches`, `mistakes`, `frameworkMap`. Not on `anatomySlotSchema`.

Three required keys when the field is present:

```yaml
motion:
  reducedMotionFallback: instant            # instant | reduced | preserved
  durations:                                # open-ended map; values are dotted token names
    open: motion.duration.base
    close: motion.duration.fast
  easing: motion.easing.standard            # single dotted token name
```

Vocabulary published in `docs/schema.md`:

- `motion.duration.{instant, fast, base, slow, slower}`
- `motion.easing.{standard, decelerate, accelerate, sharp}`

Conventional duration keys (open-ended; not enforced by schema): `open`, `close`, `backdrop`, `indicator`, `filter`, `panelEnter`, `panelExit`.

## Rationale

### Why per-component, not per-slot

The backlog vocabulary `{ open, close, indicator }` is component-state language, not slot-styling language. Modal's "open" duration spans backdrop, container, header, body, and footer simultaneously — the dialog opens as one motion event. Tabs's "indicator" duration belongs to one slot in name only; the value is component-wide because it parameterises a single transition triggered by selection. Per-slot attachment would force every component to either duplicate the same number across multiple slots or invent a "which slot's `open` wins?" tiebreaker rule. Neither earns its complexity.

This also keeps motion symmetric with `axes.states` (interactive / data) — both describe component-level vocabulary, not per-slot vocabulary. Per-slot tokens (ADR-006) describe styling that varies by slot identity; motion describes behaviour that varies by transition identity. Different anchors for different concerns.

### Why durations is an open-ended record

Modal needs `open / close / backdrop`. Tabs needs `indicator`. Combobox needs `open / close / filter`. Future components will introduce keys we cannot enumerate today (Drawer's `slide`, Toast's `enter / exit / dismiss`, Carousel's `slide`). Fixing the keys to a closed enum would punish three out of three Phase-1 components. The regex enforces *shape* (camelCase, single-word friendly), the vocabulary table in `docs/schema.md` enforces *convention*, and review enforces *appropriateness*. Same discipline as `axes.properties[].name`.

### Why duration values are dotted token names, not raw `Nms`

ADR-006 already settled this question for spacing, radius, color, elevation, and typography: canon stores *semantic names*; implementations bind names to concrete values. Motion is no different. A canonical author writing `open: 220ms` couples the canon to a single design system's motion scale; a canonical author writing `open: motion.duration.base` lets each implementation answer "what is base?" with its own number (Material 3 says 200ms, Polaris says 200ms, Atlassian says 220ms, Apple HIG declines to answer).

The existing `tokenName` regex from `shared/src/schema.ts:55-60` is reused verbatim — no new regex is added.

### Why reducedMotionFallback is a three-value enum

"What should happen when `prefers-reduced-motion: reduce` is set" is not a kill switch. It is a three-way choice:

- `instant` — jump cut. The animation is purely decorative; comprehension survives without it. Modal opening, Combobox opening, Combobox filtering all qualify.
- `reduced` — shorten the duration but keep the animation shape. Motion communicates spatial relationship the user needs (e.g., a sortable-list reorder animation that explains where an item moved).
- `preserved` — keep the animation as authored. Motion is essential to the component's meaning; removing it would change what is communicated. None of Phase 1's components qualify, but the value exists for future components (e.g., a route-transition that hides loading time, where instant cut would feel broken).

A boolean (`disableMotion: true | false`) collapses `reduced` and `instant` into one bucket and forces every author to pick the wrong default for at least one case. The three-value enum names what the W3C, Material 3, and Apple HIG already document as three distinct behaviours.

### Why a single global easing, not a per-duration map

Per-duration easing (Modal `open: decelerate`, Modal `close: accelerate`) is a real pattern in mature design systems (Material 3 emphasised vs. accelerated). It is also YAGNI for Phase 1: each of the three migrated components has one dominant transition character, and the canon does not yet record any case where opening and closing want different curves. If a future component surfaces a real need, the field extends to `easing: tokenName | Record<key, tokenName>` without breaking existing YAMLs (a single token still parses). Holding the simpler shape now keeps the Designer-view render trivial and the migration cost low.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P1-6):

```ts
const motionDurationKey = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

export const motionDurationMap = z
  .record(motionDurationKey, tokenName)        // tokenName reused from line 55
  .refine((m) => Object.keys(m).length > 0, {
    message: 'durations must declare at least one entry',
  });

export const reducedMotionFallbackSchema = z.enum([
  'instant',
  'reduced',
  'preserved',
]);

export const motionSchema = z
  .object({
    durations: motionDurationMap,
    easing: tokenName,
    reducedMotionFallback: reducedMotionFallbackSchema,
  })
  .strict();

// componentSchema gains: motion: motionSchema.optional()
```

Implementation side — deferred. When `implementations/<lib>/<id>.yaml` is created in Phase 2, motion bindings parallel ADR-006's `tokenBindings`:

```yaml
motionBindings:
  - durationKey: open
    canonicalToken: motion.duration.base
    value: '200ms'
    sourceToken: '$ds-motion-duration-base'
  - easing: motion.easing.standard
    value: 'cubic-bezier(0.4, 0.0, 0.2, 1)'
    sourceToken: '$ds-motion-easing-standard'
```

The shape is sketched here for review continuity; the schema entry for `motionBindings` is filed as a Phase-2 backlog item, not added in P1-6.

## Phase 1 implication

The `motion` field on `componentSchema` is **optional**. Phase 1 ships migrating only the three components whose anatomy already encodes motion (Modal, Combobox, Tabs). Card and Button stay unmigrated — their canonical entries record no transition vocabulary, and the optional field absent is the correct state.

The Designer view gains a Motion section between Tokens and Axes (`site/src/components/views/DesignerView.astro`). Bridge view and Dev view do not render motion in Phase 1; durations are visual spec, and the dev side gets concrete values via Phase 2 `motionBindings` rather than canonical names.

The MCP tool surface stays unchanged. Backlog item P4-24 picks up `get_motion` once token data has been stable for one or more Phase-2 audits.

## Consequences

**Positive:**

- Modal's "developers ship without enter/exit animations" mismatch row gains a structural counterpart.
- The mistake `tabs-indicator-not-rtl-aware` gains a structural counterpart: `reducedMotionFallback: instant` is the canonical answer to "indicator slide direction under reduced motion" — the indicator does not slide, so direction is moot.
- Designer view gains a real motion section.
- Phase 2 audits can record per-implementation duration and easing values via a future `motionBindings` field without touching the canon.
- The vocabulary `motion.duration.*` and `motion.easing.*` joins the existing dotted-token namespace from ADR-006 — no new regex, no new parser, no new type discipline.

**Negative:**

- One more optional top-level field on `componentSchema`. Mitigated: optional fields have zero migration cost for unaffected components, and motion concerns only three of five Phase-1 components.
- One more vocabulary table in `docs/schema.md`. Mitigated: the table is small (5 + 4 names), sits next to the existing Tokens vocabulary, and is review-enforced rather than regex-enforced.

**Neutral:**

- A future ADR may add `responsive` (P1-7) and `state-machine` (P1-8) sections alongside motion. Each gets its own concern: motion = durations/easing/fallback, responsive = breakpoints, state-machine = transitions. The boundary between them is "what concept does this field describe?", not "where does it attach?".
- Some motion concepts straddle the boundary with state machines (P1-8): a duration like `open` implies a transition like `closed → opening → open`. ADR-007 owns the *timing* of the transition; ADR-008 (when written) owns the *shape* of the transition graph. They reference each other but stay separate.

## Alternatives considered

**Sixth token category (`tokens.motion`):** rejected. ADR-006 explicitly anchors token categories per slot; motion durations are component-wide. Forcing motion into the per-slot model either duplicates values across slots (every slot of Modal carries `motion.duration.open: motion.duration.base`) or introduces a "which slot's value wins?" rule. ADR-006 line 130–131 already telegraphed this rejection.

**Raw `Nms` strings as duration values:** rejected. Violates ADR-006's name-vs-value separation. Couples canon to a single design system's millisecond scale. Makes theme/library swap a canonical-data migration. Also defeats the Bridge-view three-way comparison ("canon says `motion.duration.base`; Atelier resolves to 200ms; Radix resolves to 250ms" is informative; "canon says `200ms`; Atelier says 200ms; Radix says 250ms" is not).

**Motion attached per state under `axes.states.transitions`:** rejected. Conflates two ADRs. State machines (P1-8) describe transition *graphs* (`closed → opening → open → closing → closed`); motion describes transition *timing*. A state with no canonical timing (e.g., a fast hover transition) would have to invent a placeholder timing entry. Better to keep ADR-007 timing-only and let ADR-008 reference it from the graph side ("the `closed → opening` transition uses `motion.duration.open`").

**Boolean `disableMotion`:** rejected. Collapses the three-way choice (instant / reduced / preserved) into a binary that picks the wrong default for at least one component family. APG, Material 3, and Apple HIG all document three behaviours under reduced motion; the schema mirrors the documented vocabulary.

**Per-duration easing map from day one:** considered. Rejected as YAGNI for Phase 1 — none of Modal, Combobox, Tabs records different curves for different transitions today. The shape extends naturally (`easing: tokenName | Record<key, tokenName>`) when a real case lands.
