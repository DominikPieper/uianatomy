# ADR 019: Cross-Component Consistency Audit Script

**Status:** Accepted
**Date:** 2026-04

## Context

The canonical roster grew from 5 to 23 components in rapid succession. Phase-1 ADRs (006 Tokens, 007 Motion, 008 Responsive) defined canonical vocabularies — `spacing.compact`, `motion.duration.fast`, `breakpoint.sm`, etc. — but the Zod schema only enforces *shape* (dotted lower-kebab regex), not *membership*. An author writing `motion.duration.medium` (not in the canonical set) parses fine; the canon silently drifts.

With 23 components, drift is no longer hypothetical. Manually reviewing every YAML for vocabulary consistency is impractical. The first concrete drift surfaced during this audit: `drawer.axes.properties[size].values` is `[sm, md, lg, full]` while every other component's `size` property is `[sm, md, lg, xl]` — `full` is a semantic extension (full-viewport variant) that needed to be acknowledged or rejected.

Backlog item P4-21 (filed when the canon had only 5 components and consistency was easy to eyeball) calls for a Cross-Component Konsistenz-Audit-Script that runs in CI. With 23 components the item is now ripe.

## Decision

Implement consistency as a vitest test suite in `shared/tests/consistency.test.ts`, mirroring the existing `depth.test.ts` editorial-floor pattern. Tests load all components via `loadComponents`, iterate, and accumulate failures into a single assertion per check. CI integration is automatic — `pnpm -r test` already runs vitest across packages.

Eight checks ship in P4-21:

1. **Token vocabularies** — every `anatomy[].tokens.{spacing|radius|color|elevation|typography}` value is a member of the canonical lookup set from ADR-006.
2. **Motion vocabularies** — every `motion.durations.*` value and `motion.easing` value is a member of the canonical motion-token set from ADR-007.
3. **Breakpoint vocabularies** — every `responsive.breakpoints[].at` value is a member of the canonical `breakpoint.{xs,sm,md,lg,xl}` set from ADR-008.
4. **Property-vocab uniformity** — properties with canonical names (`density`) must declare canonical values (`[comfortable, compact]`) verbatim.
5. **Property-vocab boundedness** — properties with bounded vocabularies (`size` ∈ `[sm, md, lg, xl, full]`) accept only members of that set.
6. **Interactive-state vocabulary** — `axes.states.interactive` items are from `{hover, focus-visible, active, disabled, visited, current}`.
7. **Focus-ring token uniformity** — `anatomy[].tokens.color.ring`, when present, equals `color.border.focus` exactly.
8. **Identifier shape** — axe rule ids are kebab-case (also catches snake_case typos that the regex alone might admit on edge cases); event names are camelCase.

The canonical vocabularies are mirrored *into the test file* as exported constants, deliberately duplicating the `docs/schema.md` lookup tables. Drift between docs and the lookup is itself a thing to catch — when the canonical set is widened (e.g. P4-21 adds `full` to `size`), both `docs/schema.md` and the test constants update in the same commit.

## Rationale

### Why a vitest test, not a standalone CLI script

Three reasons:

1. **Existing CI loop runs it for free.** `pnpm -r test` already runs vitest. Adding consistency.test.ts hooks into the existing infrastructure with zero new orchestration.
2. **Pattern matches `depth.test.ts`.** Editorial-floor checks (≥3 anatomy slots, ≥4 mistakes) live in vitest; vocabulary-consistency checks belong next to them. The split would be arbitrary.
3. **Vitest's failure aggregation is the right shape.** Each `it()` block accumulates per-component failures into a single array, asserts the array is empty, and prints the joined failure list on assertion. Custom CLI would re-implement this.

### Why mirror the canonical vocabulary into the test file

A "single source of truth" version (read `docs/schema.md` and parse the Markdown tables) was considered. Rejected:

1. **Markdown is not a typed source.** Parsing tables introduces fragility and complexity for a benefit we don't need — the lookup tables change rarely (when an ADR explicitly extends them).
2. **Drift between docs and test is a meaningful signal.** When the canonical set extends, both files update in the same PR; reviewer sees both changes side-by-side. A doc that quietly diverges from the test is a thing to catch.
3. **Type narrowing inside the test is cleaner with `Set<string>`.** Direct `.has()` lookups, no parser, no edge cases.

### Why drawer's `full` becomes canonical, not rejected

Drawer's `size: full` describes a viewport-filling variant (`/components/drawer` mobile pattern). It is semantically distinct from `xl` (which means "extra large within the canonical scale") — Modal might also legitimately want `full` for fullscreen mode. The test's discovery of drift is the moment to make the canonical decision.

Decision: extend the canonical `size` bounded set to `[sm, md, lg, xl, full]`. Every component's `size` enum may use any subset. This admits Drawer's existing values without forcing rename, and pre-acknowledges the same need for Modal/Sheet/Drawer-family components.

The constants in `consistency.test.ts` document this widening with a brief comment. Future re-evaluations follow the same loop: drift surfaces in CI; review decides accept-as-canonical or reject-as-typo.

### Why mirror the constants vs. import from a shared module

A future improvement is to move these vocabularies into `shared/src/vocabularies.ts` and import them both into the test and into runtime helpers (e.g. for documentation rendering or for downstream tooling). For Phase-1 the test file mirroring is sufficient — moving them to a shared module is YAGNI until a runtime consumer needs them.

### Why not enforce vocabulary membership in Zod schema

Zod can enforce membership via `z.enum`. Was considered for tokens. Rejected:

1. **Vocabulary extends slowly but it does extend.** New token names (e.g. `spacing.snug`, `radius.xl`) land in ADRs and propagate to all consumers. Enforcing membership at schema-validation time means a `z.enum` change requires a schema bump every time vocabulary extends — feels heavy for a vocabulary that wants to be reviewable.
2. **Test-level enforcement is reviewable.** When the test fails on a new token, the author sees the test failure, decides to add the token to canonical set OR rename the proposed token, and updates both `docs/schema.md` and the test in the same PR. Schema-level enforcement would force the same flow but with worse error messages (Zod's `Invalid enum value` vs the test's `not in canonical X vocabulary`).
3. **The dotted-token regex already catches typos.** `motion.duration.fasr` parses as syntactically valid but the consistency test catches it as not-in-canonical-set. Two-tier validation: regex for shape, test for membership.

## Schema sketch

The test is the spec. Test file location: `shared/tests/consistency.test.ts`.

Canonical vocabularies (sourced from ADR-006, ADR-007, ADR-008, plus this ADR's `size` extension):

```ts
const CANON_SPACING = new Set([
  'spacing.tight', 'spacing.compact', 'spacing.cozy',
  'spacing.comfortable', 'spacing.loose',
]);
// (radius, color, elevation, typography, motion-duration, motion-easing,
//  breakpoint, all sourced from existing ADRs)

const PROPERTY_VOCAB = {
  density: new Set(['comfortable', 'compact']),
};
const PROPERTY_BOUNDED = {
  // 'full' added 2026-04-30 per ADR-019 to admit drawer's full-viewport variant.
  size: new Set(['sm', 'md', 'lg', 'xl', 'full']),
};

const CANON_INTERACTIVE_STATES = new Set([
  'hover', 'focus-visible', 'active', 'disabled', 'visited', 'current',
]);
```

Eight `it()` blocks, each iterating all components and accumulating per-component failures. Each block's assertion: `expect(failures).toEqual([])` with the joined failure list as the message — gives reviewers a copy-pasteable diagnostic in CI logs.

## Phase 1 implication

The test ships with 23 components. One real drift surfaced and was resolved in the same commit (`size: full` admitted into the canonical bounded set). Eight consistency checks now run in CI on every push. Any future component or schema field change that violates a check fails fast.

The MCP tool surface gains nothing — consistency is a build-time guarantee, not a query.

## Consequences

**Positive:**

- Drift between `docs/schema.md` vocabularies and YAML content is caught in CI before merge.
- New components (when added) are forced to use canonical token / motion / breakpoint vocabularies; reviewers see explicit failures rather than absorbing "looks fine" cognitive load.
- The vocabulary-extension flow is now explicit: drift surfaces → review → either accept (extend the canonical set) or reject (rename the proposed token to canonical). Both branches force a same-commit update of canonical reference + test.
- Editorial floor (depth.test.ts) and vocabulary floor (consistency.test.ts) cover complementary axes — depth ensures every component has substance, consistency ensures the substance uses canonical vocabulary.

**Negative:**

- The canonical vocabulary is now duplicated between `docs/schema.md` and `shared/tests/consistency.test.ts`. Mitigated by the small surface (8 vocabularies × ~6 entries each) and by the deliberate drift-detection-as-feature framing.
- A new component author must learn the canonical vocabularies before writing YAML. Mitigated by the test's explicit failure messages naming both the offending value and the canonical set.

**Neutral:**

- A future `shared/src/vocabularies.ts` extraction (constants importable into both test and runtime) is a logical follow-up if a runtime consumer (documentation generator, IDE plugin, MCP tool) ever needs the vocabularies. Out of scope for P4-21.
- Additional consistency checks are filed as follow-ups when drift surfaces — examples: aria-current values consistent across nav components, `data-state` attribute names consistent across data-driven components, common patterns in mistake `id` slugs.

## Alternatives considered

**Standalone CLI script (`pnpm consistency`):** rejected. Existing vitest CI runs cover this; extra orchestration adds complexity without benefit.

**Enforce vocabulary membership in Zod (`z.enum`):** rejected. Too rigid; vocabulary extensions become schema-bumps; error messages are worse than custom test assertions.

**Read `docs/schema.md` as source of truth, parse Markdown:** rejected. Parser fragility, complexity not earned by Phase 1's vocabulary stability. Drift between docs and test is itself useful as a review signal.

**Accept `drawer.size: full` as legitimate per-component divergence (no canonical widening):** rejected. Without a documented canonical answer, the next component (Modal-fullscreen, Sheet, Tray) re-asks the same question. Better to widen once, name the semantic ("full = viewport-filling"), and let future components reuse the answer.

**Run the test as an opt-in (skipped by default, `vitest --runOnly consistency`):** rejected. The whole point is CI enforcement; opt-in defeats the goal.
