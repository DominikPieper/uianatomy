# ADR 025: PropertyMap `kind` — tool-neutral abstraction

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** [ADR-015](./015-property-map.md)

## Context

ADR-015 introduced `propertyMap` with a closed enum `type: 'Boolean' | 'Variant' | 'Text' | 'Instance Swap'` — Figma's component-property type vocabulary. The decision was deliberate: Figma's vocabulary is exhaustive (those four values are everything Figma offers) and the asymmetric pairings (Variant↔code-enum, Boolean↔slot-visibility-toggle, Instance Swap↔slot-child) are the most informative bridge entries.

The Atelier-feedback v2 review (2026-05-02, P6-50) flagged the same field as "tied to one tool":

> propertyMap uses Figma-specific terms (Variant/Boolean/Instance Swap/Text). Tied to one tool. Abstract to `kind: enum | boolean | text | slot | number`.

The critique is valid in scope but not in framing. `propertyMap` is *intentionally* a Figma↔code bridge — that is what the field documents. ADR-015 picked Figma vocabulary for `type` because it makes the asymmetric pairings legible. But the canon now serves three concrete consumer surfaces beyond Figma:

1. **Other authoring tools.** Penpot, Sketch, native code (no design-tool source-of-truth). All four "Figma" type names are nonsensical to a Penpot designer or a code-first author.
2. **AI agents.** A canon consumed by an agent that emits code (or reviews code) cannot map "Instance Swap" to anything in its working vocabulary; it has to translate to "slot" mentally on every read.
3. **Tool-neutral docs.** `docs/schema.md` describes the canon as library-agnostic. A field whose type vocabulary is single-vendor undermines that claim.

The fix is to keep the bridge structure (figma + code + kind columns) and replace the `type`-enum's contents with a tool-neutral vocabulary that designers, developers, and tooling-authors can all agree on.

## Decision

`propertyMap[].type` becomes `propertyMap[].kind` with a new closed enum:

```ts
export const propertyKindSchema = z.enum([
  'enum',     // string-union, "pick one from a fixed list"
  'boolean',  // on/off toggle
  'text',     // free-form string
  'slot',     // child or instance swap (designer-side composition surface)
  'number',   // numeric count, threshold, step (rare today, reserved for future)
]);

export const propertyMapEntrySchema = z
  .object({
    figma: z.string().min(1),
    code: z.string().min(1),
    kind: propertyKindSchema,
    notes: z.string().min(1).optional(),
  })
  .strict();
```

The field rename (`type → kind`) reinforces that the value names a *role* shared across surfaces, not a *type-system tag* native to one tool. It also avoids collision with `axes.properties[].type` (the P1-9 code-side primitive-vs-enum discriminated union) — readers who see both fields can distinguish them by name alone.

Migration mapping (24 components × 221 entries):

| ADR-015 `type` | ADR-025 `kind` | Count today |
|---|---|---|
| `'Variant'`        | `'enum'`     | 77 |
| `'Boolean'`        | `'boolean'`  | 88 |
| `'Text'`           | `'text'`     | 31 |
| `'Instance Swap'`  | `'slot'`     | 25 |
| (none)             | `'number'`   | 0 (reserved) |

The `figma` column keeps its Figma-vocabulary string (`"Variant"`, `"Has Leading Icon"`, `"Leading Icon"`) — that is *literally* what designers see in the Figma Properties panel and is the whole point of having a Figma column. Only the closed-enum tag changes vocabulary.

## Rationale

### Why `kind`, not `type`

`type` collides cognitively with `axes.properties[].type` (P1-9), which is the actual code-side type system (primitive vs enum discriminated union). Reusing the field name on a different surface invites readers to assume the values are interoperable. `kind` reads as a high-level role tag in a way that `type` does not.

### Why this enum, not a free string

The same argument from ADR-015 carries: a closed enum forces authors into a shared vocabulary, makes render-side mapping (kind → badge color) trivially exhaustive, and resists author-invented variants ("Number" vs "Numeric" vs "Num"). The members change; the discipline does not.

### Why `slot` instead of `instance-swap`

`instance-swap` is the Figma name for what every code framework calls a slot, child, or composition point. Other design tools use other words (Penpot calls it a "shared element"; Sketch had nothing equivalent). `slot` matches the canon's existing anatomy vocabulary (`anatomy[].id` is a slot id; `anatomy[].slotKind` is a slot's role) and matches every code framework's mental model (Web Components `<slot>`, React children, Vue named slots, Angular content projection, Lit slots).

### Why add `number` even though zero entries use it today

Forward-coverage. Components like Stepper (`current` step), Combobox (max-suggestions), and any future numeric-input wrapper (NumberInput) will eventually want a numeric `propertyMap` entry. Adding `'number'` to the enum costs nothing today (no migration) and avoids a re-bump when the first authoring case appears. ADR-015's enum was tight to Figma's actual surface area; ADR-025's enum is tight to the *roles* a property can carry, which is a slightly broader concept that admits one extra value without losing discipline.

### Why migrate now rather than maintain both

Keeping both `type` and `kind` (one as deprecated alias) was considered. Rejected. The canon roster is small enough (24 components) that a single migration is cheap; carrying two parallel vocabularies forever would muddy schema-doc, render code, and downstream consumers. ADR-001 favors discipline over softness on canon shape.

### Why the `figma` column is unchanged

The Figma column is *the* designer-facing artifact this field documents. Designers reading their Figma file still see "Has Leading Icon" in the Properties panel; the canonical entry mirrors that exact string. Hiding the Figma name behind a tool-neutral wrapper would defeat the bridge purpose. Tool-neutrality belongs to the *role* tag (the closed enum), not the per-tool labels in the columns.

A future Penpot-side `penpot:` column or a Sketch-side `sketch:` column is a separate ADR if a real consumer ever needs it. The current columns (figma + code + kind + notes) cover the dominant Figma↔code workflow without prejudging multi-tool support.

## Render

`PropertyMapTable.astro` reads from `kind` instead of `type`. The badge label becomes the `kind` value capitalised (`Enum`, `Boolean`, `Text`, `Slot`, `Number`). Color mapping stays consistent with the surface taxonomy used elsewhere in the site:

- `enum` → tabular accent (mirrors variant badges in the axes table)
- `boolean` → muted neutral (toggle aesthetic)
- `text` → text-tone (matches free-string-prop styling)
- `slot` → composition accent (matches anatomy-slot color)
- `number` → numeric accent (reserved color, pick at first usage)

Designer view + Bridge view continue to render the table; Dev view continues to omit it. (ADR-015 made this call; ADR-025 inherits.)

## Schema lineage

`shared/src/schema.ts`:

- `figmaPropertyTypeSchema` is removed.
- `propertyKindSchema = z.enum(['enum', 'boolean', 'text', 'slot', 'number'])` is added.
- `propertyMapEntrySchema` keeps shape `{ figma, code, kind, notes? }` with `.strict()`.
- `propertyMapSchema` is unchanged: `z.array(propertyMapEntrySchema).min(1)`.

`docs/schema.md`:

- The `propertyMap` section migrates from "Figma vocabulary" prose to "tool-neutral kind vocabulary" prose.
- The migration table above is mirrored as a single-paragraph note for future contributors.

ADR-015 status flips from `Accepted` to `Superseded by ADR-025` with a back-reference.

## Phase 2 implication

Implementation YAMLs (Phase 2) do not carry `propertyMap`; the field is canonical-only. No change to `implementations/<lib>/<id>.yaml` shape.

## Consequences

**Positive:**

- The canon claim of library- and tool-agnosticism extends to the `propertyMap` row — no field forces readers to parse Figma-specific vocabulary.
- `kind` aligns with the canon's existing slot vocabulary (`anatomy[].slotKind`) and with code-framework mental models.
- `'number'` reserved without authoring cost; first numeric component-property entry lands as a one-line YAML edit.
- AI-agent consumers (the dominant new audience post-2025) read a working vocabulary instead of translating Figma names.

**Negative:**

- Migration touches 24 component YAMLs (221 entries). Done as a single mechanical regex pass; no prose-content reflow.
- ADR-015's "stable for years" argument for the Figma vocabulary is forfeit — `kind` may need extension if a sixth role emerges. Acceptable: the same one-line schema-bump cost applies to either vocabulary, and the new vocabulary is easier to extend without single-vendor-coordination.

**Neutral:**

- The `figma` column keeps its semantic. Authors continue to type the exact string designers see in the Figma Properties panel.
- Render code (PropertyMapTable.astro) reads `entry.kind` instead of `entry.type` — single-token rename per call site.

## Alternatives considered

**Keep `type` as field name, swap only the enum members**: rejected. Collision with `axes.properties[].type` remains; the value-name change is the smaller signal. Renaming the field at the same time as the vocabulary is the cleanest break.

**Tool-neutral wrapper with per-tool aliases (`kind: 'enum'`, `figma_type: 'Variant'`)**: rejected. Doubles the surface; no consumer needs the Figma type-tag preserved alongside the role-tag (the `figma` column already carries the human-readable Figma string). Re-introduces the same single-vendor coupling we are removing.

**Free-string `kind`**: rejected for the same reason ADR-015 rejected free-string `type` — no rendering exhaustivity, no authoring discipline.

**Drop `kind` entirely; let readers infer the role from `figma` + `code`**: rejected. The bridge entries are most informative *because* the role tag makes the asymmetry explicit (Boolean↔slot-visibility-toggle is the canonical example). Removing the tag erases the most valuable column.

**Rename only `'Instance Swap'` → `'slot'` and keep the rest**: rejected. The Atelier-feedback flagged the whole vocabulary as Figma-specific; one-row fix would still leave Variant + Text + Boolean as Figma names. Either commit to tool-neutrality or do not bother.
