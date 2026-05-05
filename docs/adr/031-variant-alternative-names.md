# ADR 031: Per-variant `alternativeNames`

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** none (additive)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-010](./010-property-type-union.md) (axes shape precedent), [ADR-023](./023-versioning.md) (variantDeprecations parallel-array decision), [ADR-029](./029-severity-vocabulary.md) (severity synonyms)

## Context

Variant identifiers in `content/components/<id>.yaml` are bare strings:

```yaml
axes:
  variants: [default, dot]
```

Several canonical variants ship under one name in `uianatomy` but appear under different names across libraries / spec / colloquial use. Examples:

- `Badge.dot` is called `compact` by Polaris and `minimal` by Atlassian Badge; an agent searching `compact badge` does not hit `Badge.dot` today.
- `Stepper.linear` is called `sequential` in Carbon Stepper and Material 3 Stepper; same recall miss.
- Severity-cluster variants (`Toast.error`, `Alert.error`, `Banner.error`) collide with the colloquial `danger` / `destructive` / `critical` synonyms — partly mitigated by the `SEVERITY_SYNONYMS` reverse-index in `mcp-server/src/server.ts:11`, but that synonym map is component-name-blind: it cannot disambiguate "the `danger` variant of Toast" from "any component named `danger`".
- `Drawer.inline-start` was renamed from `start` (P6-117 logical-vs-physical migration); legacy callers still type `start`.

P6-62a introduced component-level `alternateNames: string[]` on `componentSchema` (rendered as a hero-aliases-row in `ComponentPageShell.astro`, indexed by Pagefind, joined into the `search_components` haystack). That field solves the *component*-level alias problem (Modal ≈ Dialog, Toast ≈ Snackbar) but not the *variant*-level problem (which is a per-axis-entry concern, not a per-component concern).

Three options surfaced:

1. **Strict object reshape** — `variants: string[]` → `variants: Array<{ name, alternativeNames? }>`. All 41 component yamls migrate. Backlog spec (P6-127) names this shape explicitly.
2. **Sidecar map** — keep `variants: string[]`; add `axes.variantAliases?: Record<variantName, string[]>` parallel. Non-breaking, but two source-of-truth (variant name lives in array, aliases in map; drift risk on rename).
3. **Permissive union** — `variants: Array<string | { name, alternativeNames? }>`. Bridge-shape, lets call sites opt-in. Type-narrowing overhead in every consumer (`compare.ts`, `validate.ts`, `mcp-server`, `AxesTable.astro`, `consistency.test.ts`).

## Decision

Adopt **option 1, strict object reshape**:

```ts
export const variantEntrySchema = z
  .object({
    name: z.string().min(1),
    alternativeNames: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

axes.variants = z.array(variantEntrySchema).min(1);
```

YAML form:

```yaml
axes:
  variants:
    - name: default
    - name: dot
      alternativeNames: [compact, minimal]
```

Refines on `axesSchema.superRefine` extend with:

- `variants[i].name` unique within the array.
- `variants[i].alternativeNames[k]` does not collide with any other `variants[j].name` nor duplicate within its own array.
- `variantDeprecations[k].name` cross-refine reads `Set(axes.variants.map((v) => v.name))` instead of `Set(axes.variants)` directly.

Render-side: `AxesTable.astro` reads `v.name` for the variant chip; if `v.alternativeNames` is non-empty, an italic muted line "aka compact · minimal" appears beneath the chip. CSS class `.variant-aliases` mirrors the P6-62a hero-aliases-row pattern.

Search-side: `mcp-server` `search_components` haystack joins `c.axes.variants.flatMap((v) => [v.name, ...(v.alternativeNames ?? [])])` so `search_components({ query: "compact" })` returns Badge.

## Rationale

- **Symmetry with P6-62a.** Component-level `alternateNames` is the precedent. Per-variant `alternativeNames` is the same idea one level deeper in the schema. Naming uses `alternativeNames` (not `alternateNames`) because the morpheme already shipped on `componentSchema.alternateNames` — we keep that exact key on the component, and pick the closest neighbour key on the variant entry to avoid future-confusion that the two fields might be the same shape (they are not — component is `string[]`, variant is `string[]` *per entry*). [Update post-implementation: harmonised on `alternativeNames` only after weighing both names; either reads naturally and the per-variant shape is never confused with the per-component shape because they live on different schemas.]
- **Search recall is the goal.** The whole point is that an agent typing `compact` finds Badge. Sidecar maps achieve this too, but at the cost of drift (variant rename leaves orphaned alias keys). Strict reshape couples name + aliases so the lint already exists for free.
- **Drift cost is fixed.** All 41 yamls migrate in one pass via Python script (idempotent regex on `^\s+-\s+([\w-]+)\s*$` under `^  variants:` anchor). Implementations YAMLs do not declare variants (`grep variants: implementations/*/*.yaml` = 0). Pattern YAMLs do not declare axes. Total YAML blast radius = canon only.
- **Permissive union loses precision.** Every consumer (`compare.ts:111`, `validate.ts:91`, `mcp-server/src/server.ts:329`, `AxesTable.astro:17`, `consistency.test.ts` SEVERITY_AXIS_REGISTRY loop) would carry `typeof v === 'string' ? v : v.name`-checks. Strict reshape eliminates that branch.

## Rejected alternatives

- **Sidecar `axes.variantAliases?: Record<name, string[]>`** — two source of truth; rename of a variant requires editing both the array and the map; drift undetectable without a cross-refine that re-creates option 1's complexity at a lower-quality entry point.
- **Permissive union** — type-narrowing overhead, no migration discipline (some yamls would land as bare strings, others as objects, no enforcement of one canonical shape over time).
- **Bundling `variantDeprecations` consolidation** — ADR-023 deliberately kept `variantDeprecations` as a parallel array because variants were string-shape at the time. With variants now object-shape, consolidation into per-entry `deprecated?: { since, reason, replacement? }` is reachable. This ADR explicitly defers that consolidation to a follow-up item: one-thing-per-cycle, ADR-023 stays accurate until the consolidation lands.

## Consequences

- 41 component yamls migrated; `axes.variants` items become `- name: foo` shape.
- 9 high-value `alternativeNames` backfilled in the same change (Badge.dot, Stepper.linear, Toast/Alert/Banner severity-cluster, Drawer.inline-start/inline-end logical hints).
- `mcp-server` `search_components` recall expanded; `SEVERITY_SYNONYM_REVERSE` becomes redundant for the severity-variants because the same synonyms now live on the variant entry itself. Decommissioning that reverse-index is tracked as a follow-up item.
- `AxesTable.astro` adds an aliases-row beneath the variant chip when `alternativeNames` is non-empty; absent on the negative-control `Button.variants` (which has no aliases).
- `variantDeprecations`-Refine reads `axes.variants.map((v) => v.name)` for its known-set; existing `variantDeprecations`-tests stay green.
- `consistency.test.ts` `SEVERITY_AXIS_REGISTRY` lint iterates `comp.axes.variants` and pulls `v.name` for the canonical-severity-membership check.
- ADR-023 stays accurate (variantDeprecations parallel-array choice still holds; consolidation is a separate decision).
- Out of scope: `variantDeprecations` consolidation; `validate_implementation` substring-haystack only treats `alternativeNames` as bonus matches (does not count toward `variantsDeclared`/`variantsMatched` ratios).
