# ADR 015: Figma ↔ Code Property Map

**Status:** Accepted
**Date:** 2026-04

## Context

Figma encodes component properties using a fixed vocabulary (Boolean, Variant, Text, Instance Swap) and tends to use human-readable names ("Has Leading Icon", "Variant", "Filter Mode"). Code uses framework-idiomatic identifiers (`hasLeadingIcon`, `variant`, `filterMode`) and richer types (booleans, string unions, slot children, generic component refs). The two surfaces describe the same thing but speak different languages.

The canon today documents code-side properties via `axes.properties[].type` (a P1-9 discriminated union of primitive vs enum) and Figma-side anatomy via `anatomy[].figma.{type, hint}` (per-slot Figma frame/instance/text/rectangle vocabulary). What is missing is the *mapping* — a designer reading "Has Leading Icon (Boolean)" in Figma cannot find which code prop it drives without prose-parsing the mistakes / mismatches sections; a developer reading `iconLeading` cannot reverse-look-up which Figma property corresponds.

The Figma↔Code mismatch in the existing `mismatches` section is a *behavior* gap (what designers think happens vs what happens in code). Property mapping is a *vocabulary* gap (what designers call it vs what code calls it). Both deserve their own structural surface.

Backlog item P2-11 closes the vocabulary gap with a top-level `propertyMap` field. The render target (per backlog) is Designer + Bridge view — both audiences benefit, the dev-only View does not need the cross-team translation.

## Decision

`propertyMap` enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`, `responsive`, `events`, `whenToUse`, `a11yAcceptance`. A non-empty array of structured `{ figma, code, type, notes? }` records:

```yaml
propertyMap:
  - figma: Variant
    code: variant
    type: Variant
    notes: Maps the visual variant set.
  - figma: Has Leading Icon
    code: iconLeading
    type: Boolean
    notes: >-
      Toggles slot visibility in Figma. Code does not have a matching
      boolean — the icon-leading slot is conditionally rendered based
      on whether a child is provided.
  - figma: Leading Icon
    code: iconLeading
    type: Instance Swap
  - figma: Label
    code: children
    type: Text
```

The schema:

```ts
export const figmaPropertyTypeSchema = z.enum([
  'Boolean',
  'Variant',
  'Text',
  'Instance Swap',
]);

export const propertyMapEntrySchema = z
  .object({
    figma: z.string().min(1),
    code: z.string().min(1),
    type: figmaPropertyTypeSchema,
    notes: z.string().min(1).optional(),
  })
  .strict();

export const propertyMapSchema = z.array(propertyMapEntrySchema).min(1);

// componentSchema gains: propertyMap: propertyMapSchema.optional()
```

Render: `PropertyMapTable.astro` slots into Designer view (between TokensTable and MotionTable) and Bridge view (after AxesTable). Dev view does not render it — Dev view's audience reads code-side prop signatures from `axes.properties` and `frameworkMap`, not the cross-team translation.

## Rationale

### Why `type` uses Figma's vocabulary, not code's

A code-side type field would duplicate `axes.properties[].type` (the P1-9 discriminated union). The new information `propertyMap` brings is the *Figma-side type* — what designers see in the Properties panel: Boolean, Variant, Text, Instance Swap. These four values are the entire Figma component-property type vocabulary; a closed enum is the right shape.

The most informative bridge entries are exactly the cross-vocabulary ones:

- **Variant ↔ enum** — Figma's `Variant` property maps to a code string-union (e.g. `'primary' | 'secondary'`). Both encode "pick one from a fixed list" but the syntax differs.
- **Boolean ↔ slot-visibility-toggle** — Figma's `Boolean` often gates slot visibility (`Has Leading Icon`); code may not have a matching boolean prop because the slot is conditionally rendered when a child is passed. The `notes` field carries this nuance.
- **Instance Swap ↔ slot child** — Figma swaps a component instance (`Leading Icon`); code receives the icon as a slot child or named prop value. No code primitive matches Instance Swap.
- **Text ↔ slot child / string prop** — Figma's `Text` property often maps to `children` (default slot) rather than a prop with a literal name.

If the bridge degenerates to "Variant ↔ Variant, Boolean ↔ boolean, Text ↔ string", the table is uninformative. Picking Figma's vocabulary surfaces the asymmetries that designers and developers actually disagree about.

### Why `code` is a free string, not a reference into `axes.properties`

A cross-field refine validating `propertyMap[].code` against `axes.properties[].name` (or `frameworkMap.<framework>` prop names) was considered. Rejected:

1. **`propertyMap.code` is broader than `axes.properties`.** The label maps to `children` (default slot); slot-visibility booleans (`Has Leading Icon`) map to slot ids (`iconLeading`), not properties; `state` in Combobox maps to `data-state` attribute, not a prop. Forcing a 1:1 with axes.properties would either blacklist these legitimate entries or force them through a "ghost property" workaround.
2. **`propertyMap` is a *bridge view*, not a *contract*.** The contract for the code surface is `axes.properties` plus `frameworkMap`. The bridge documents what designers and developers should call the same conceptual handle. Looser coupling matches the purpose.
3. **Stale-typo audits are low-value here.** A typo in `propertyMap[i].code` is a documentation error caught by the next reader, not a runtime regression. The `.strict()` per entry catches *structural* typos (`figmaa: ...`) immediately; semantic typos (`iconLeadingg` vs `iconLeading`) are review-caught.

### Why per-component, not per-anatomy-slot

Property maps span the component as a whole. Modal's `Variant: dialog | alertdialog | fullscreen` is a single Figma property that controls all slots simultaneously; per-slot attachment would force "which slot owns the variant?" tiebreakers. Same anchor as motion (ADR-007), responsive (ADR-008), events (ADR-011), whenToUse (ADR-012), a11yAcceptance (ADR-014).

### Why `notes` is optional but `min(1)` when present

Some entries are trivial (`Variant: variant: Variant` — no nuance worth a paragraph). Forcing `notes` would invent prose for prose's sake. Empty `notes: ''` is the dead-letter rejection — `min(1)` when present, omitted entirely when not. Same discipline as ADR-013's optional `exampleCode`.

### Why Designer + Bridge views, not Dev

Dev view's audience reads code-side prop signatures from `axes.properties` (canonical type) and `frameworkMap` (per-framework idiom). Adding a Figma-side translation reads as cross-team noise in a dev-focused page. Designer view needs the bridge most (designer reading the Figma file wants to find the corresponding code prop); Bridge view is the cross-team alignment surface and earns the duplication.

If dev feedback later requests the table in Dev view too, it lands as a one-line edit.

### Why a closed enum for `type`, not free string

Figma's component-property types are exhaustively four values — Boolean, Variant, Text, Instance Swap. Adding free-string would let authors invent "Number" or "Enum" — both tempting and both wrong (Figma has no Number type; "Variant" is the Figma name for what programmers call enum). The closed enum forces authors to use the Figma vocabulary and makes the render mapping (type → badge color) trivially exhaustive.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P2-11):

```ts
export const figmaPropertyTypeSchema = z.enum([
  'Boolean',
  'Variant',
  'Text',
  'Instance Swap',
]);

export const propertyMapEntrySchema = z.object({
  figma: z.string().min(1),
  code: z.string().min(1),
  type: figmaPropertyTypeSchema,
  notes: z.string().min(1).optional(),
}).strict();

export const propertyMapSchema = z.array(propertyMapEntrySchema).min(1);

// componentSchema gains: propertyMap: propertyMapSchema.optional()
```

Implementation side — none. `propertyMap` is canonical-vs-Figma; per-implementation library specifics (Radix prop names, Headless UI composition) live in `frameworkMap` and the implementation YAMLs. A future Phase-2 audit could record per-library prop-name deltas (`Radix's Dialog uses 'modal' instead of 'variant: dialog'`), but that is divergence (ADR-013) territory, not propertyMap.

## Phase 1 implication

All five Phase-1 components migrate. Counts:

- Button: 8 entries (Variant, Size, Has Leading Icon, Has Trailing Icon, Leading Icon, Label, Loading, Full Width)
- Card: 14 entries (Variant, Orientation, Density, Interactive, Has Media, Media, Has Eyebrow, Eyebrow, Title, Has Subtitle, Subtitle, Body, Has Actions, Has Footer)
- Modal: 10 entries (Variant, Size, Title, Has Description, Description, Body, Has Footer, Footer, Dismissible, Scroll Behavior)
- Tabs: 6 entries (Variant, Orientation, Density, Activation, Tab Count, Selected)
- Combobox: 9 entries (Variant, Filter Mode, State, Has Clear Button, Has Trigger Button, Strict, Async, Virtualised, Placeholder)

The PropertyMapTable renders in Designer view between Tokens and Motion, and in Bridge view after Axes. Dev view stays unchanged.

The MCP tool surface gains `get_property_map` once Phase-2 audits surface a concrete consumer — file as follow-up.

## Consequences

**Positive:**

- Designers reading the Figma file can locate the code-side handle for any Figma property. Developers reading the code can reverse-look-up the Figma property name.
- Bridge view gains another structural cross-team surface — the canonical "designers and developers spell the same thing differently" mismatch is captured in data, not just in prose.
- Slot-visibility-toggle vs slot-content patterns (Figma's `Has Leading Icon` Boolean vs `Leading Icon` Instance Swap) are made explicit, surfacing a common source of confusion.
- Future Figma plugin tooling can read `propertyMap` to auto-generate Figma component property panels from the canonical reference.

**Negative:**

- Authoring overhead per component grows (~8–14 entries each, ~5–60 lines depending on the volume of `notes` prose). Mitigated by the high signal: most entries are short (figma + code + type + no notes), only the asymmetric ones need a paragraph.
- The closed `type` enum means new Figma component-property types (if Figma ever adds one) require a schema bump. Acceptable — Figma's vocabulary has been stable for years and a fifth type would warrant a coordinated update across designers, developers, and the canon.

**Neutral:**

- The relationship between `propertyMap.code` and `axes.properties[].name` is intentionally loose (no cross-field refine). If a future audit shows propertyMap entries drifting from axes.properties names due to typos, file a referential-integrity refine as a follow-up; do not preemptively constrain.
- A future `figmaCanvas` field (Figma file URLs, frame node ids per component) is out of scope. PropertyMap documents the *vocabulary* bridge; Figma-source provenance is its own ADR if a real need lands.

## Alternatives considered

**`type` as code-side type (reuse P1-9 discriminated union)**: rejected. Duplicates `axes.properties[].type`; the new value is the Figma vocabulary, not the code vocabulary.

**`type` as a free string**: rejected. Lets authors invent "Number" or "Enum"; closed enum forces the Figma vocabulary and makes render-side mapping (type → badge) trivially exhaustive.

**Cross-field refine `code → axes.properties.name`**: rejected. PropertyMap entries legitimately reference slot ids (`iconLeading`), default-slot children (`children`), and DOM attributes (`data-state`) — none of these live in `axes.properties`. Loose coupling matches the bridge purpose.

**Per-anatomy-slot `propertyMap`**: rejected. Maps span the whole component; per-slot duplicates or invents tiebreakers.

**Render in Dev view**: rejected for now. Dev audience reads code-side props from `axes.properties` + `frameworkMap`; cross-team translation is noise there. If feedback requests it, one-line edit lands it.

**Required `notes` field**: rejected. Trivial entries (Variant ↔ variant) need no notes; forcing it invents prose.

**Three sub-arrays (one per Figma type)**: rejected. The four Figma types interleave naturally per component; splitting would force readers to scan three tables to find a single entry. Single flat array sorted by Figma name (or author-chosen order) reads top-to-bottom.
