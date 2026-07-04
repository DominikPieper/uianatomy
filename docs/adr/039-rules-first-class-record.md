# ADR 039: `rules[]` as a First-Class Top-Level Record

**Status:** Accepted
**Date:** 2026-07
**Supersedes:** none (promotes `contracts.nonNegotiable` to a new top-level field; removes the superseded shape)
**Related:** [ADR-027](./027-contracts-section.md) (introduced `contracts.nonNegotiable`), P6-201 Step 1 (2026-07-04, `mismatch.id` + `contracts.nonNegotiable[].relatedMistakes`), Design-review 2026-07-03 (P6-201 Step 2)

## Context

ADR-027 introduced `contracts.nonNegotiable[]` to structure the hard-binding rules that were previously buried in freeform `notes:` prose. It worked — 41/41 components now declare it, 133 rules total — but the 2026-07-03 design review's data-model pass found the same underlying fact frequently restated across three separate sections: a `mistakes[]` entry documents a failure mode, a `mismatches[]` entry documents the Figma-vs-code translation gap, and a `contracts.nonNegotiable[]` entry states the rule itself — often about the exact same constraint, in three different prose renderings with no structural link between them. P6-185 (2026-07-03, same review cycle) already hand-trimmed the worst 15 cases by shortening `nonNegotiable` prose to cross-reference a `mistakes[].id` instead of restating it — but that was an editorial fix, not a structural one; nothing enforced the cross-reference or made it queryable.

P6-201 Step 1 (2026-07-04) built the first piece of structural plumbing: `mismatchSchema.id` (optional, symmetric with `mistakeSchema.id`) and `nonNegotiableContractSchema.relatedMistakes: [slug]` (optional, resolved against `mistakes[].id` by a new consistency test). That was deliberately small and additive — no ADR needed, no migration. But it kept the rule content living inside `contracts.nonNegotiable`, with mistakes as the *target* of a reference from contracts. That's backwards for what a "rule" actually is: a rule is not a property of the contracts section, it's an atomic canonical fact that a mistake or a mismatch can point *at*, the same way both already point at canonical anatomy slots and axis values. Nesting it inside `contracts` also made it impossible to reference from a `divergence[].from` path in an implementation audit without inventing a nonstandard path shape (`contracts.nonNegotiable[slug]`) that the P6-202 consistency-test resolver could only check for existence, not identity — because `nonNegotiable` entries had no `id` at all until this ADR.

## Decision

Promote the rule content to a new top-level array, `rules[]`, on both `componentSchema` and `patternSchema` (both already share one `contractsSchema`, and both have real `nonNegotiable` content — 2 patterns, 41 components).

```ts
export const ruleSchema = z
  .object({
    id: slug,
    statement: z.string().min(1),
    source: contractSourceSchema,       // apg | wcag | html-spec | platform | canon
    sourceRef: z.string().min(1).optional(),
    consequence: z.string().min(1),
  })
  .strict()
  .refine(/* same sourceRef-shape-per-source check nonNegotiableContractSchema had */);

// on componentSchema and patternSchema:
rules: z.array(ruleSchema).min(1).optional(),
```

`contractsSchema` sheds `nonNegotiable` entirely — it now carries only `vocabularyDrift`:

```ts
export const contractsSchema = z
  .object({
    vocabularyDrift: z.array(vocabularyDriftEntrySchema).min(1).optional(),
  })
  .strict();
```

`mistakeSchema` and `mismatchSchema` each gain an optional `ruleId: slug`, replacing the removed `nonNegotiableContractSchema.relatedMistakes` — the reference now flows from the failure-mode-or-translation-gap record *to* the rule it violates, not from the rule outward:

```yaml
rules:
  - id: disabled-tabs-use-aria-disabled
    statement: >-
      A disabled tab keeps role="tab" and carries aria-disabled="true" —
      it is never removed from the tablist or given tabindex="-1"
      permanently, because that would corrupt the roving-tabindex
      arrow-key contract for the remaining enabled tabs.
    source: apg
    consequence: >-
      Removing a disabled tab from the arrow-key cycle breaks Home/End
      and wrap-around for the remaining tabs; giving it a persistent
      -1 tabindex silently drops it from the one-tab-is-always-the-stop
      invariant the roving-tabindex pattern depends on.

mistakes:
  - id: tabs-disabled-via-removal
    ruleId: disabled-tabs-use-aria-disabled
    severity: major
    title: Disabled tab removed from the DOM instead of aria-disabled
    description: ...
    fix: ...
```

`id` is a **canon-wide-namespaced-per-component** slug, same convention as `mistakes[].id` and the new `mismatchSchema.id` from Step 1 — unique within the component, not across the corpus.

## Rationale

**Why a new top-level array instead of extending `contracts.nonNegotiable` in place.** Keeping the rule content nested under `contracts` while adding forward-references from `mistakes`/`mismatches` into it would work mechanically, but it keeps modeling a rule as a property of "the contracts section" rather than as a fact in its own right — the same category error ADR-027 itself was correcting for (rules used to live in freeform `notes`, which was the wrong *place* for them; nesting under `contracts.nonNegotiable` was progress, but `contracts` is a rendering-and-dispatch grouping, not a data model). Promoting `rules[]` to the same level as `mistakes[]`/`mismatches[]`/`anatomy[]` matches what a rule structurally *is*: an atomic canonical fact other sections reference, exactly like `anatomy[].id` or `mistakes[].id` already are.

**Why the reference direction flips (mistakes/mismatches → rule, not rule → mistakes).** Step 1's `relatedMistakes` had contracts reaching outward to name the mistakes that violate it. But a single rule can be violated in more than one *specific* way (documented as separate mistakes) and can also be the reason a specific mismatch exists — modeling the fan-out from the rule's side means the rule entry has to enumerate every consumer of it, which drifts the moment a new mistake or mismatch is added without updating the rule. Modeling it from the mistake/mismatch's side (`ruleId`) means each failure-mode entry names the one rule it's about, which is the natural cardinality (a mistake is usually about one rule; a rule can have zero, one, or many mistakes referencing it, discoverable by scanning rather than maintained as a list).

**Why `ruleId` is optional with no adoption target in this migration.** Populating `ruleId` on the *correct* mistake/mismatch for each of 133 rules requires editorial judgment about which specific failure-mode entries a rule is about — the same judgment P6-185 already exercised by hand on 15 components' worst cases. Backfilling all 133 in this pass would mean re-deriving that judgment call for entries P6-185 never touched, at real risk of wrong or forced pairings. The structural capability (field + resolution lint) is what this ADR delivers; backfill is deliberately left to future editorial passes, the same way Step 1 left `relatedMistakes`/`mismatch.id` unadopted and P6-203 didn't treat that as evidence of deadness (it's the difference between "nothing consumes this" and "nothing has populated this yet").

**Why `rule` renames to `statement`.** Once the object is itself an element of `rules[]`, keeping the field named `rule` produces `rules[].rule` — redundant and slightly confusing next to `rules[].id`. `statement` names what the field actually holds (the rule's normative text) without repeating the array's own name.

**Consequence for `divergence[].from` paths (P6-202).** The one real implementation reference to `contracts.nonNegotiable[...]` (`implementations/radix/tabs.yaml`) used the descriptive slug `disabled-tabs-use-aria-disabled` — which becomes the *actual* rule id in this migration (chosen deliberately to match), upgrading that reference from the P6-202 resolver's existence-only check (no stored key existed to match against) to a real, resolvable `rules[X]` id match.

## Migration

Automated, format-preserving (ruamel.yaml round-trip mode — preserves `>-` block-scalar style, quoting, and untouched sections byte-for-byte) across all 41 components + 2 patterns carrying `contracts.nonNegotiable`:

1. For each `contracts.nonNegotiable[]` entry, generate a slug id from the first clause of its `rule` text (word-boundary-safe, stopword-filtered, deduplicated within the file if two rules would otherwise collide).
2. Move the entry to the top-level `rules[]` array (creating it if absent), renaming `rule` → `statement`, preserving `source`/`sourceRef`/`consequence` verbatim.
3. Delete `contracts.nonNegotiable`; delete the `contracts` key entirely if `vocabularyDrift` was its only remaining sibling and is itself absent (no component hits this — all 41 with `nonNegotiable` also have `vocabularyDrift`, per P6-171's backfill).
4. Update the one real `divergence[].from: contracts.nonNegotiable[disabled-tabs-use-aria-disabled]` reference to `rules[disabled-tabs-use-aria-disabled]`.
5. No `ruleId` backfill on `mistakes[]`/`mismatches[]` (see Rationale) — the field exists and is guarded, adoption is a future editorial pass.

Automated ids are a first-pass, not hand-curated prose — reviewable and renamable later without a schema concern (renaming a `rules[].id` is a `slug`-typed value like any other canonical id).

## Consequences

**Positive:**
- The rule content has a stable, addressable id per entry (133 of them), enabling real cross-references from `mistakes`/`mismatches`/implementation `divergence[].from` instead of prose restatement or existence-only checks.
- `get_contracts` (MCP) and `ContractsSection.astro` (site) both already dispatch on component-or-pattern by id; both get a small, mechanical update to read `rules` from the top level instead of `contracts.nonNegotiable`.
- Sets up the actual triple-encoding fix (backfilling `ruleId` on the clearest duplicate cases) as a well-scoped follow-up that doesn't require another schema change.

**Negative:**
- Breaking, non-additive change: every consumer that read `component.contracts.nonNegotiable` must update (2 render/MCP call sites, plus the P6-202 resolver's `contracts.nonNegotiable[X]` case, plus every test asserting the old shape).
- 133 ids are auto-generated in one pass; a few may read awkwardly (a slug is not prose) and are candidates for manual polish over time — accepted because 133 hand-authored ids in one sitting isn't a better use of editorial time than the structural capability itself.

## Alternatives considered

**Keep `contracts.nonNegotiable`, add `id` to it in place, keep Step 1's `relatedMistakes` direction.** Rejected — see Rationale on reference direction and on why nesting under `contracts` is the wrong home. Would have been the smaller, ADR-free diff, but perpetuates the exact modeling mismatch the design review flagged.

**Full triple-encoding fix now — auto-backfill `ruleId` by fuzzy-matching mistake/mismatch prose against rule prose.** Rejected — fuzzy text matching would produce false pairings that read as confidently structural while being editorially wrong, worse than leaving the field visibly unadopted. Real backfill needs a human (or an agent doing real reading, not string similarity) judging each pairing, matching how P6-185 was actually done.
