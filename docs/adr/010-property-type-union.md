# ADR 010: `property.type` as a `kind`-Discriminated Union

**Status:** Accepted
**Date:** 2026-04

## Context

Phase-1 canonical components declare component properties under `axes.properties` as a list of `{ name, type }` records. The `type` field has been a free-form string from the first component onward. Real values across the five Phase-1 components fall into two distinct shapes:

- **Primitive type names**: `boolean` (six properties, e.g. `button.iconOnly`, `card.interactive`, `combobox.{strict, async, virtualised}`).
- **Pipe-encoded enum unions**: `'sm | md | lg'`, `'vertical | horizontal'`, `'startsWith | contains | fuzzy | none'` (nine properties).

The free-form representation has three concrete problems:

1. **Consumers cannot distinguish the two arms without re-parsing.** `AxesTable.astro` echoes the string verbatim; the future MCP `get_axes` tool and Phase-2 implementation bindings cannot ask "is this a primitive or an enum?" without splitting on `' | '` and guessing.
2. **The pipe encoding is unvalidated.** `'sm |  md| lg '`, `'sm | sm'`, and `''` all parse today. Trailing whitespace, duplicate values, and empty enums slip through review.
3. **The encoding conflates the literal string `'boolean'` (primitive type name) with a one-element enum whose only value happens to be `boolean`.** No consumer can tell them apart programmatically.

P1-9 closes the gap and is the last purely structural Phase-1 schema item before P1-10 (events).

## Decision

Replace `propertySchema.type: z.string()` with `z.discriminatedUnion('kind', [primitiveArm, enumArm])`.

```ts
const propertyPrimitiveSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('primitive'),
    of: z.enum(['boolean']),
  })
  .strict();

const propertyEnumSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('enum'),
    values: z
      .array(z.string().min(1))
      .min(2, 'enum must declare at least two values')
      .refine((v) => new Set(v).size === v.length, 'enum values must be unique'),
  })
  .strict();

export const propertySchema = z.discriminatedUnion('kind', [
  propertyPrimitiveSchema,
  propertyEnumSchema,
]);
```

YAML migration uses inline flow-style for the primitive arm (one line) and block style for the enum arm (the values list reads as an inline array):

```yaml
properties:
  - { name: iconOnly, kind: primitive, of: boolean }
  - name: size
    kind: enum
    values: [sm, md, lg]
```

Render-time display is preserved by a small helper `formatPropertyType` in `shared/src/format.ts`:

```ts
export function formatPropertyType(p: Property): string {
  return p.kind === 'primitive' ? p.of : p.values.join(' | ');
}
```

`AxesTable.astro` calls this helper instead of echoing the field. The visible string is unchanged from the pre-migration state — `iconOnly` still renders as `boolean`, `size` still renders as `sm | md | lg`. The change is invisible at the page level.

## Rationale

### Why two arms, not three

No Phase-1 property uses `string` or `number` primitives. Adding speculative `string` and `number` arms would be vocabulary that has never survived review, and the cost of a future widening is one line in the `of` enum plus an updated paragraph in this ADR. The discipline matches ADR-006's approach to the token vocabulary and ADR-007's `reducedMotionFallback` enum: keep the closed set tight until a concrete property forces an addition.

### Why `kind`-discrimination, not shape-discrimination

A shape-discriminated union — where a bare string means primitive, an array means enum, and an object means an explicit form — was considered. Rejected:

1. **Implicit discrimination forces every consumer to remember the rule.** `typeof p.type === 'string' ? primitive : Array.isArray(p.type) ? enum : explicit` is a chain that has to be re-derived in each consumer (site, MCP, future bindings). `kind === 'primitive'` reads at the call site.
2. **`z.discriminatedUnion` narrows in TypeScript.** Inside a branch of a `kind`-switch, the type system knows which payload is present; with shape discrimination, every consumer needs explicit `Array.isArray` / `typeof` guards.
3. **The pattern matches the rest of the schema.** `transitionSchema` (ADR-009) and `breakpointEntrySchema` (ADR-008) both use `.strict()` named records; `floatingHintSchema` uses a structured `position` enum. `kind`-discrimination keeps the schema visually consistent with how every other structured field was defined.

### Why `.strict()` per arm

`.strict()` causes Zod to reject objects with extra fields. `{ name: 'x', kind: 'enum', value: ['a','b'] }` (singular `value` instead of `values`) would silently drop the typo'd field on a non-strict schema and fail later with a confusing `min(2)` error on the missing array. With `.strict()`, the typo fails at parse time with `Unrecognized key(s) in object: 'value'`. This matches the pattern set by `transitionSchema` and `breakpointEntrySchema`.

### Why uniqueness and `min(2)` on enum values

A one-value enum is degenerate — it expresses no choice and is equivalent to a primitive whose only inhabitant is the named string. `min(2)` keeps the enum arm honest. Uniqueness via a `Set`-based refine catches `'sm | sm | lg'` typos that the previous free-form encoding silently accepted. Both refines exist because the migration is the right moment to lock down what the previous encoding could not validate.

### Why structured form everywhere, no pipe-string shortcut

A `z.preprocess` shortcut that lets authors continue writing `type: 'sm | md | lg'` was considered. Rejected because two YAML shapes mean readers have to learn both, the schema gains a tiny pipe-parser that lives in two places (the preprocess and the formatter), and the migration is a one-time cost — not a recurring one. Discriminated unions reward exactness; one canonical shape is the whole point.

### Why preserve the `' | '` join in the renderer

The visible properties table is reference data, not view-specific commentary. Keeping the rendered string identical to the pre-migration state means readers see no change, only the schema and downstream consumers do. View parity (Designer / Dev / Bridge all render the same string) matches how `name` is treated in the same table.

## Schema sketch

Canonical side — `shared/src/schema.ts`:

```ts
const propertyPrimitiveSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('primitive'),
    of: z.enum(['boolean']),
  })
  .strict();

const propertyEnumSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('enum'),
    values: z
      .array(z.string().min(1))
      .min(2)
      .refine((v) => new Set(v).size === v.length),
  })
  .strict();

export const propertySchema = z.discriminatedUnion('kind', [
  propertyPrimitiveSchema,
  propertyEnumSchema,
]);
```

Renderer side — `shared/src/format.ts` (new file, exported from the package via `@uianatomy/shared/format`):

```ts
import type { Property } from './schema.js';

export function formatPropertyType(p: Property): string {
  return p.kind === 'primitive' ? p.of : p.values.join(' | ');
}
```

`AxesTable.astro` is the only Phase-1 consumer. The MCP server does not currently read `property.type`; backlog item P4-24 (`get_axes`) will pick up the same `formatPropertyType` helper when it lands.

## Phase 1 implication

All five Phase-1 YAMLs migrate at once. Seventeen properties across `button`, `card`, `modal`, `tabs`, and `combobox` move from free-form strings to the discriminated union shape. Six properties land on the primitive arm; eleven on the enum arm. The render output is identical pre- and post-migration; the change is invisible at the page level but visible at the data level — the `/api/components/<id>.json` endpoint now returns structured `{ kind, of }` or `{ kind, values }` objects instead of strings.

The MCP tool surface stays unchanged. P4-24 picks up `get_axes` once Phase-2 audits surface a concrete consumer.

## Consequences

**Positive:**

- The schema validates what the previous encoding could not — duplicate enum values, single-value enums, empty strings inside enums, and ambiguity between primitive type names and one-element enums all fail at parse time.
- Phase-2 implementation bindings get a structured target. `propertyBindings` in a future `implementations/<lib>/<id>.yaml` can match against `kind: 'enum'` without parsing the pipe encoding.
- The MCP server's eventual `get_axes` tool can return structured property types directly, useful to LLM consumers that want to enumerate enum values for code generation.

**Negative:**

- One more piece of vocabulary (`kind`, `of`, `values`) for content authors to remember. Mitigated by the inline flow-style for primitives — `{ name: iconOnly, kind: primitive, of: boolean }` is one line — and by ADR-010 plus `docs/schema.md` documenting both arms with examples.
- The migration is structural, not additive — unlike P1-5 through P1-8, there is no opt-out. All five YAMLs ship in lockstep with the schema change. Mitigated by the small surface (17 properties total) and the test coverage that catches a missed migration immediately.

**Neutral:**

- Future widening of the `of` enum (to include `string`, `number`, or anything else a real property demands) is a one-line schema change plus a one-line ADR amendment.
- A Phase-2 binding shape `propertyBindings: [{ canonicalProperty: string, runtimeType: string }]` may eventually surface alongside the canonical type. The discriminated union is the spec; the implementation binding is the binding. Same separation as ADR-009's transitions vs. transition bindings.

## Alternatives considered

**Free-form string with regex validation** (`/^(boolean|string|number|[a-zA-Z]+(\s\|\s[a-zA-Z]+)+)$/`): rejected. The regex catches whitespace and basic shape but still cannot validate enum uniqueness, cannot distinguish primitive `'boolean'` from a one-element enum, and forces every consumer to re-parse to extract values. The discriminated union does the parsing once at schema time.

**Shape-discriminated union** (`string | string[] | { kind, values }`): rejected. Forces typeof / Array.isArray guards in every consumer, lacks self-documenting field names in the YAML (`kind: enum, values: [...]` reads as a labelled record; `[sm, md, lg]` reads as "an array, but of what semantic?").

**Three-arm union with `string` and `number` primitives**: rejected. No Phase-1 property uses them; speculative vocabulary fails the "ADR-006 schema is a contract" discipline. Widening later is one line.

**Pipe-string shortcut via `z.preprocess`**: rejected. Two YAML shapes for the same data; the schema picks up a tiny parser; the migration is one-time anyway. Discriminated unions reward exactness.

**Top-level `enums?: Record<string, string[]>` field referenced by name** (`type: { kind: 'enum', name: 'sizeScale' }`): rejected for Phase 1. The enum vocabularies are not yet shared across components — `card.density` and `tabs.density` happen to use `[comfortable, compact]` but no other property reuses an enum. Naming a small number of one-off enums is overhead with no payoff. If Phase-2 audits surface real cross-component enum reuse, file as a separate backlog item.
