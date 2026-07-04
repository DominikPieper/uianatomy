# ADR 035: Depth Contract Moves from Count Floors to a Smoke Floor

**Status:** Accepted
**Date:** 2026-07
**Supersedes:** none (amends the depth contract established alongside `depth.test.ts`, no ADR of record)
**Related:** Design-review 2026-07-03 (P6-186, P6-204)

## Context

`shared/tests/depth.test.ts` enforces a uniform editorial-depth floor across every canonical component:

```ts
const MIN = {
  anatomySlots: 3,
  variants: 2,
  properties: 2,
  statesCombined: 4,
  mistakes: 4,
  mismatches: 4,
  sources: 3,
} as const;
```

The same floor applies to Icon and to Combobox. The intent (per `docs/methodology.md`) was to stop a component from shipping with a blank or perfunctory section — a genuine risk when content is largely agent-authored. An `overrides: Record<string, Partial<typeof MIN>>` escape hatch exists for components that legitimately have less to say, but it has sat empty since the file was written.

The empty override list is the tell. The 2026-07-03 design review's data-model pass found the floor inducing exactly the failure mode a Goodhart-style metric predicts: `mistakes ≥ 4` and `mismatches ≥ 4` measure volume, not substance, and volume is what authors optimize for when a test gates the commit. P6-186 (closed 2026-07-03, same day) had to hand-replace padded mismatch entries on 11 components — Avatar, AvatarGroup, Icon, Link, Tile, Switch, TagInput, Disclosure, Stepper, TextInput, Checkbox — where a fourth entry had been synthesized purely to clear the count, not because a fourth genuine Figma↔code divergence existed. The override mechanism was available the whole time; nobody used it, because padding a list to 4 costs nothing and arguing for an exception costs a paragraph. A floor that is cheaper to satisfy by fabrication than by honest exception will get satisfied by fabrication.

The real quality gate for corpus content is not a count — it is semantic review, already running as the `canon-auditor` / `component-review` skills, which read each entry and judge whether it says something true and specific. `depth.test.ts` should do the one thing a mechanical test can do reliably: catch a section that is missing or trivially thin (0–1 entries where the schema clearly expects a populated list), not police how many entries constitute "enough."

## Decision

Lower `MIN.mistakes` and `MIN.mismatches` from 4 to 2. Both become a smoke floor — enough to confirm the section was actually populated with distinct content, not a target volume every component must hit regardless of how much genuine material it has. `anatomySlots`, `variants`, `properties`, `statesCombined`, and `sources` are unchanged; the review's finding was specific to `mistakes`/`mismatches`, which are exactly the two free-prose-list sections that gained padding under the old floor.

```ts
const MIN = {
  anatomySlots: 3,
  variants: 2,
  properties: 2,
  statesCombined: 4,
  mistakes: 2,   // was 4 — smoke floor, not a volume target (ADR-035)
  mismatches: 2, // was 4 — smoke floor, not a volume target (ADR-035)
  sources: 3,
} as const;
```

The `overrides` escape hatch stays in place unchanged — a lower default floor does not remove the need for a documented exception when even 2 is too many for a genuinely simple component.

## Rationale

**Why lower the number instead of adding a citation lint.** The design review's data-model finding proposed, as one option, gating on evidence instead of volume — "lint that each mismatch/mistake cites a source or maps to a ruleId." That is the more rigorous fix, but it requires a schema field that does not exist yet: neither `mistakeSchema` nor `mismatchSchema` carries a per-entry source citation today, only the component-level `sources[]` (which cites where the component's research came from, not which source backs which specific mistake). Adding that field is a real schema-field-add cycle of its own — new optional field, schema.md doc, a migration decision for the corpus's existing ~250 mistake/mismatch entries, a consistency test. Bundling it into this ADR would conflate a policy change (how strict is the floor) with a schema change (what can be cited), and the schema change deserves its own review of whether per-entry citation is worth the authoring overhead across 41 components. This ADR is scoped to the floor-count change only; per-entry citation is left as a candidate follow-up (see Alternatives).

**Why 2 and not, say, 1 or 3.** 1 does not confirm the section generalizes past a single example — a component with exactly one documented mismatch might have a real corpus gap rather than genuine simplicity. 2 is the smallest number that demonstrates the author looked for more than the first thing they noticed, without demanding a specific volume. 3+ reintroduces the same incentive to pad that this ADR is trying to remove, just at a lower number.

**Why not delete the floor entirely.** A floor of 0 would stop catching the actual regression the test exists for — a component shipped with an empty `mistakes: []` because the author ran out of time. The smoke floor still catches that; it just stops dictating how much is "enough" beyond "not nothing."

**Consistency with the project's own quality mechanism.** `docs/CLAUDE.md` and the `component-review` skill already treat semantic audit as the mechanism that finds real gaps ("component-review... audit... against every schema section... emit a structured gap report"). `depth.test.ts` duplicating that job with a blunter, count-based instrument is redundant at best and actively counterproductive once the count becomes the thing authors optimize for instead of the content.

## Consequences

**Positive:**
- Removes the incentive to synthesize a fourth mismatch/mistake purely to pass CI. Future content additions (P6-188's Slider/DatePicker/Tree, and any future components) are not pushed toward padding by the test suite itself.
- The `overrides` escape hatch keeps its stated purpose without needing to be exercised for every simple component — most components already clear the smoke floor honestly, so the override list can stay near-empty for the right reason (nothing to override) rather than the wrong one (nobody bothered).
- No migration: every existing component already has ≥ 4 mistakes and ≥ 4 mismatches (that was the old floor), so lowering the floor cannot break anything today. The change is purely forward-looking — it changes what future authoring is pressured toward, not what already shipped.

**Negative:**
- The test no longer catches a "thin but not empty" section (e.g., 2 mismatches where 4+ genuine ones exist and the author simply stopped early). That gap is intentionally deferred to semantic review (`component-review`/`canon-auditor`), which is better positioned to judge "thin" than a count ever was.
- Does not by itself fix any already-shipped padding beyond what P6-186 already corrected — this ADR changes the going-forward incentive, not historical content.

## Alternatives considered

**Evidence/citation lint (add a per-entry `sourceRef` to mistakes/mismatches, lint that it resolves).** More rigorous — ties every claim to a checkable source — but requires new schema surface with its own migration question (backfill ~250 existing entries, or leave optional and accept a mixed corpus) and its own ADR. Rejected for *this* decision, not rejected outright: worth revisiting as a dedicated schema-field-add cycle if the smoke floor alone proves insufficient.

**Leave the floor at 4, rely on manual override requests instead.** Rejected — this is the status quo, and the status quo is what produced the P6-186 padding. An override that requires justification will always lose to padding that requires none, unless the default floor itself stops asking for more than a component genuinely has.

**Per-component floor tuned by actual complexity (e.g., derived from anatomy slot count).** More precise in theory, but adds a formula nobody could audit at a glance and re-introduces a volume target just computed differently. Rejected as unnecessary complexity for what the smoke floor already achieves at zero configuration cost.
