---
name: component-review
description: Audit one or many existing canonical components in content/components/<id>.yaml against every schema section, the depth contract, recent schema additions, vsRelated bidirectional integrity, vocabulary drift, and source-claim staleness — emit a structured gap report with pre-formatted backlog items ready to drop into docs/backlog.md. Use whenever the user asks to review, audit, check, lint, or QA a component or the whole canon — phrases like "review tabs", "audit modal", "check accordion", "QA-Pass über alle komponenten", "find gaps in X", "atelier-v3 review", "ist X vollständig", "missing was bei Y". This is the systematic per-component version of the broad Atelier-v2 review pass that produced 22 backlog items in one go; running it on stale components catches schema-additions they didn't get migrated for.
---

# component-review

Systematic gap-audit for canonical components. The Atelier-v2 review (2026-05-02) was a one-shot pass over the whole canon that produced 22 backlog items. Schema has evolved since (mistake.severity, axeCoreVersion, propertyMap.kind, contracts, vsRelated-bidirectional) — components authored before those additions need a re-pass. This skill codifies that re-pass mechanically so it can run per-component on demand.

## When to use

Trigger when the user says any of:

- "review <id>" / "audit <id>" / "check <id>"
- "QA-Pass über X" / "Atelier-v3 review"
- "find gaps in <id>" / "what's missing on <id>"
- "ist <id> vollständig" / "is <id> complete"
- "lint the canon" / "review all components"
- "<id> bringt v2 nach"

Do **not** trigger for:

- New component authoring (use `canon-component-author`)
- Schema design (use `schema-field-add`)
- Pattern files — patterns have their own schema; only flag where pattern-specific checks differ

## Audit dimensions

Every component is checked against every dimension. Missing dimensions are gaps; gaps become backlog items.

### A. Schema-section presence

Top-level fields from `shared/src/schema.ts` — every component should have:

**Required** (parse fails without):
- `id`, `name`, `description`, `anatomy[]`, `axes`, `mismatches[]`, `mistakes[]`, `frameworkMap`

**Strongly recommended P2** (component is editorially incomplete without):
- `whenToUse: { use, avoid, vsRelated? }`
- `i18n: { rtl: { mirroring }, textExpansion }`
- `a11yAcceptance: { keyboardWalk?, announcements?, axeRules? }` — at least one of three
- `propertyMap: [{ figma, code, kind, notes? }]`

**Optional but interrogate omission**:
- `motion` — declare when ordered phases / mode-dependent / async meaningful return; omit only when states are mutually-independent flags (precedent: Button/Card/Link omit per P6-68). If component has data-state transitions but no `motion`, flag.
- `responsive` — declare when cross-breakpoint behavior shifts.
- `events` — declare for any component with interactive states.
- `formIntegration` — declare for form controls and form containers.
- `performance` — declare only when there is a real numeric capacity threshold (single-entry numeric warnings belong in `whenToUse.avoid` per P6-75).
- `contracts: { nonNegotiable?, vocabularyDrift? }` — extract structurable content from `notes` per ADR-027. Components with long `notes` blocks (> 400 chars) are candidates.

### B. Depth contract

Per `shared/tests/depth.test.ts`:

| Dimension | Threshold |
|---|---|
| Anatomy slots | ≥ 3 |
| Variants | ≥ 2 |
| Properties | ≥ 2 |
| States (interactive + data combined) | ≥ 4 |
| Mistakes | ≥ 4 |

Components below threshold should already fail `pnpm -r test` — but check anyway, in case override exists in `depth.test.ts` for a primitive (Card, Link, Button-with-no-data-states).

### C. Recent schema additions (post-Atelier-v2)

These rolled out 2026-05-01 → 2026-05-03. Pre-existing components need migration check:

- **`mistake.severity` (P6-72)** — every `mistakes[].severity` must be `'blocker' | 'major' | 'minor'`. Required field. No omissions.
- **`axeCoreVersion` (P6-71)** — when `a11yAcceptance.axeRules` is declared, `axeCoreVersion` should be pinned (current canon: `4.10.2`). Cross-refine: only meaningful when `axeRules` declared.
- **`propertyMap.kind` (P6-65 / ADR-025)** — must use tool-neutral vocabulary `enum | boolean | text | slot | number`. Old `Boolean | Variant | Text | Instance Swap` is rejected by Zod; flag any leftover prose in `notes` referencing old vocabulary. **Do not confuse with `axes.properties[].kind`** — that is a separate schema (ADR-010 / P1-9 discriminated-union: `kind: 'primitive', of: boolean` vs `kind: 'enum', values: [...]`). Same field name, different vocabularies, different ADRs. `axes.properties[].kind: primitive` is canonical and must never be flagged.
- **`events.optional` (P6-76)** — context-sensitive canonical events (auto-flip behaviors, manual-vs-automatic activation) should have `optional: true`. Audit: does any event's payload prose hedge ("when implementation chooses to emit") without the flag?
- **`vsRelated` bidirectional (P6-79 / P6-86)** — every `whenToUse.vsRelated[].id` must have a reverse-ref on the target. Lint enforces this; check the test passes for the component under review.
- **`contracts` (P6-73 / ADR-027)** — long `notes:` blocks should have structurable content extracted. Three patterns: vocabulary-drift, non-negotiable-contracts, implementation-audit-guidance.

### D. Cross-component integrity

- **`whenToUse.vsRelated[].id`** — every referenced id must resolve to an existing canonical component. Dangling refs are bugs.
- **Reverse-ref prose quality** — bidirectional lint accepts the link syntactically but the canon loses value if the reverse-ref is generic ("see X"). Read the target's vsRelated entry; if the prose is generic, flag for rewrite from the target's perspective.
- **Pattern composition** — if any `content/patterns/*.yaml` lists this component in `composition[]`, the pattern's `get_pattern_a11y_aggregate` output depends on this component's `a11yAcceptance`. Stale components cause stale aggregates.

### E. Vocabulary drift

- **Tokens** — every `anatomy[].tokens.*` value must match `shared/src/vocabulary.ts` canon (spacing, radius, color, elevation, typography). Non-canonical tokens are silently consumed but break aggregation.
- **Motion** — `motion.durations` and `motion.easing` must reference canonical vocab.
- **Breakpoints** — `responsive.breakpoints[].at` must reference `breakpoint.{xs,sm,md,lg,xl}`.
- **States** — `axes.states.transitions[].from|to` must exist in `axes.states.interactive ∪ data` (Zod refine catches; verify the test runs).

**Scope clarification:** vocabulary-drift covers *token references* only. Do **not** flag `axes.properties[].kind: primitive | enum` (ADR-010 discriminator) or `slotKind: structural | content | interactive | decorative` (ADR-020 vocabulary) — those are structural enums, not token canon. Only flag values that fail to match a list in `shared/src/vocabulary.ts`.

### F. Source-claim staleness

`docs/methodology.md`: "Date library-specific claims. Library APIs change. Any claim about how Library X currently behaves should be timestamped or verifiable against current docs at write-time."

- Search the YAML and any `notes` for library names (`Radix`, `React Aria`, `Headless UI`, `Spectrum`, `Polaris`, `Carbon`, `Material`, `Atlassian`, `GOV.UK`, `Sonner`, `Reach`).
- For each occurrence, look for a date-stamp or version reference. Bare "Radix does X" claims older than 6 months are stale candidates.
- Use `git log content/components/<id>.yaml` for last-touched date; if older than 6 months and library claims exist, flag.

### G. Render-side coherence

- Site renders all three views (Designer / Dev / Bridge).
- Component page resolves at `http://localhost:4321/components/<id>` if site-dev is running.
- Anatomy SVG generates from `anatomy[].layout` without override.

For full audit, the user runs `pnpm -C site dev` and the skill emits a manual checklist; for code-only audit, skip this dimension.

## Steps

### Step 1: Pick the target

Ask if not specified:

- Single component: id (kebab-case)
- All components: explicit "all" trigger
- Subset: list of ids

### Step 2: Read the YAML and the schema

Read `content/components/<id>.yaml` and `shared/src/schema.ts`. The schema is the contract; cross-reference every section.

For "all components", iterate; emit one report per component. Do not bundle into one mega-report — backlog items must be per-component.

### Step 3: Run mechanical checks

Run from project root:

```bash
pnpm -F @uianatomy/shared build
pnpm -r test
pnpm -r typecheck
```

If any test fails for the target component, that's the first finding. The depth contract test failure prints `<id>: <dimension> N < M` directly.

For schema-additions migration check, grep is fast:

```bash
# severity present on every mistake?
yq '.mistakes[] | select(.severity == null)' content/components/<id>.yaml

# axeCoreVersion pinned?
yq '.a11yAcceptance | select(.axeRules != null and .axeCoreVersion == null)' content/components/<id>.yaml

# propertyMap.kind on every entry?
yq '.propertyMap[] | select(.kind == null)' content/components/<id>.yaml

# notes block over 400 chars (contracts-extraction candidate)?
yq '.notes' content/components/<id>.yaml | wc -c
```

(Use `python3 -c "import yaml; ..."` if `yq` not installed; do not introduce a new dependency.)

### Step 4: Read the canon for cross-checks

- `shared/src/vocabulary.ts` for token / motion / breakpoint canons
- All other `content/components/*.yaml` for vsRelated reverse-ref check (faster: load all once and grep for the target id)
- `content/patterns/*.yaml` for composition references

### Step 5: Emit the gap report

Format the report in three sections:

```markdown
## Component review: <name> (<id>)
**Reviewed**: 2026-MM-DD
**Status**: <complete | gaps-found>

### Findings

#### Critical (blocking parse / test / canonical integrity)
- [list] | none

#### Major (editorially incomplete; component is below the depth or recent-schema bar)
- [list] | none

#### Minor (polish, source-staleness, vocabulary drift)
- [list] | none

### Backlog items (drop into docs/backlog.md)

- [ ] **PX-NN <Title>** — <one-line summary>. Datei: `content/components/<id>.yaml`.
- [ ] **PX-NN <Title>** — …
```

Each finding becomes a backlog item with a pre-assigned priority bucket:

- **Critical** → P0 (sofort, blockiert Phase 2)
- **Major P2-section gaps / depth-contract** → P2 or P6 (Atelier-v2 / persona-audit) depending on origin
- **Minor source-claim staleness, vocabulary** → P5 (long-tail polish) or P6

Pick the next sequential `NN` per bucket from current `docs/backlog.md`. Do not commit the items unless the user says go — emit them ready-to-paste.

### Step 6: Hand off to backlog-tick

Ask: "Append these N items to docs/backlog.md?" If yes, hand control to the `backlog-tick` skill which knows the format conventions and the maintenance-scan loop. If no, leave the report in the conversation for the user to triage manually.

## Conventions specific to this skill

- **Per-component reports, not bundles.** Each report is self-contained. The Atelier-v2 mega-bundle worked because it was a one-shot framing exercise; per-component re-passes belong in per-component reports.
- **Quote the original review** when the gap is a known-but-deferred Atelier-v2 item ("flagged in P6-50 review as: '…'"). Maintains traceability.
- **No false positives.** Single-variant primitives (Card, Link) have legitimate variants[] omissions. Always check `shared/tests/depth.test.ts` overrides before flagging a depth gap.
- **Flag prose, don't rewrite it.** The skill identifies what's stale or incomplete; authoring the replacement prose is a separate cycle (`canon-component-author` for full sections, or a hand-edit for line-level fixes).
- **Source-claim flags are advisory.** Library docs may not have changed; the date is the trigger to *re-verify*, not to *rewrite*. The flag asks: "is this still true in the current Radix?"

## What not to do

- Do not auto-edit the YAML during review. The audit is read-only. Edits go through `schema-field-add`, `canon-component-author`, or hand-edits.
- Do not skip the mechanical test run. The depth-contract test catches half the findings for free.
- Do not flag the same finding under both Critical and Major — pick the highest applicable severity.
- Do not bundle a 10-component sweep into one summary. Per-component reports are the contract.
- Do not invent gaps. If the schema doesn't require it and the depth contract doesn't require it and the recent-additions list doesn't require it, the component is fine.
- Do not rerun the audit on a component the user just finished editing without first running `pnpm -F @uianatomy/shared build` per the build-hygiene gotcha — stale dist makes the audit lie. (P6-211 — `rm -rf site/.astro` is now automatic via site's predev/prebuild, no longer a manual step.)

## Final summary template

```
Audit: <id> (<name>)
Schema sections present: <list> | missing: <list>
Depth contract: pass | fail (<dimension>: <N> < <M>)
Recent-additions: severity ✓/✗, axeCoreVersion ✓/✗, propertyMap.kind ✓/✗, events.optional ✓/✗, vsRelated-bidir ✓/✗, contracts-candidate ✓/✗
Cross-component integrity: vsRelated dangling refs <N>, reverse-ref prose quality <good|generic>
Vocabulary drift: <list>
Source-claim staleness: <N library-claims, last-touched YYYY-MM-DD>
Findings: <N> critical, <N> major, <N> minor
Backlog items emitted: <N> (P0:N P2:N P5:N P6:N)
```
