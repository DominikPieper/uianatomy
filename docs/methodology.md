# Methodology

How component anatomies are researched, written, and validated.

## Core principle: canon first, implementations later

The canonical anatomy of a component is documented *without reference to any specific implementation*, including the maintainer's own libraries. Specific implementations are documented separately, after the canonical reference is stable.

This protects against a subtle bias: when you write canonical documentation while having a specific implementation in mind, the canon ends up shaped by that implementation rather than by accumulated industry wisdom. The canon must be *unbiased* to be useful as a reference for auditing implementations.

**Order of work:**

1. Canonical reference is built from research (this site, content/components/)
2. Specific implementations are then audited against the canon (separate workflow)
3. Divergences between an implementation and the canon are documented with rationale

## Sources

Each component anatomy is synthesized from at least three categories of source:

### 1. Normative specifications

- **W3C ARIA Authoring Practices Guide (APG)** — the authoritative reference for accessible patterns. Provides expected keyboard interactions, ARIA structures, and behavior requirements.
- **MDN Web Docs** — for HTML semantics and platform behavior
- **WCAG** — for accessibility constraints

### 2. Mature headless / unstyled libraries

These libraries reflect what production teams have converged on. They are *not* the canon, but their convergence indicates likely-correct defaults.

- Radix UI
- React Aria (Adobe)
- Headless UI (Tailwind Labs)
- Spectrum Web Components (Adobe)

### 3. Real design systems

These reflect how components are organized when they need to scale across many products and teams.

- Shopify Polaris
- IBM Carbon
- Atlassian Design System
- Material Design 3
- GOV.UK Design System

### 4. Platform conventions (where relevant)

For interaction patterns specifically — keyboard shortcuts, drag behaviors, etc.

- macOS Human Interface Guidelines
- Windows UX Guidelines
- Android Material Design (for mobile patterns)

## Synthesis approach

For each component:

1. **Identify the canonical anatomy** — what slots/regions appear consistently across mature implementations? What are the *names* used? Where do names diverge meaningfully (and is the divergence semantic or stylistic)?

2. **Distinguish variants from properties from states.** Apply the test:
   - **Variant** = "a different version of this component" (different visual treatment, often different use case)
   - **Property** = "the same component, parameterized" (modifies an existing variant)
   - **State** = "the same component, currently in this situation" (driven by user interaction or app state)

3. **Identify the figma/code mismatches.** Where do designers and developers typically misunderstand each other on this component?

4. **Document common mistakes.** What are the 3–6 typical implementation errors? Each should have a clear correct alternative.

5. **Provide cross-framework mapping.** How does the canonical anatomy translate to Web Components, React, Angular, Vue?

## Writing style

- **Provide rationale, not just rules.** Every slot, every variant cut, every recommended behavior has a *because*. Without rationale, the reference is no better than reading APG.
- **Avoid framework partisanship.** No framework is canonically "better." The cross-framework map is descriptive, not prescriptive.
- **Be specific about disagreement.** Where mature libraries diverge (e.g., what Tab does in an open Combobox), name the disagreement and pick a recommendation with rationale — don't paper over it.
- **Date library-specific claims.** Library APIs change. Any claim about how Library X currently behaves should be timestamped or verifiable against current docs at write-time.

## Review checklist per component

Before a component is considered ready:

- [ ] Anatomy researched against ≥3 mature libraries and ≥2 design systems
- [ ] Each slot has a documented purpose and rationale
- [ ] Variants/properties/states cleanly separated with test applied
- [ ] All library-specific claims verified against current docs (with date)
- [ ] Schema validation passes
- [ ] Anatomy SVG generates correctly
- [ ] All three views render coherently

## Minimum depth contract

These thresholds are the *editorial* minimum for any component on the site (separate from the structural Zod schema, which only enforces presence). They are enforced automatically by `shared/tests/depth.test.ts`; `pnpm -r test` fails when a component falls below.

| Dimension | Minimum | Rationale |
|---|---|---|
| Anatomy slots | ≥ 3 | Below 3 there is no real anatomy worth documenting; the component is a primitive |
| Variants | ≥ 2 | Single-variant components do not justify a `variants` axis |
| Properties | ≥ 2 | Reflects that real components have parameterisable surfaces |
| States (interactive + data combined) | ≥ 4 | Allows containers like Modal (few interactive states, many data states) and controls like Button (the inverse) |
| Mistakes | ≥ 4 | Three feels editorial, four forces a fourth angle the author had to think about |
| Mismatches | ≥ 4 | The Figma↔Code section is the project's USP — under-investing here defeats the point |
| Sources | ≥ 3 | Forces triangulation across spec / library / design-system categories |
| `lastReviewed` | present | Library claims rot; no entry means the file is implicitly stale |

State-matrix mutual-exclusivity (which states cannot co-occur) must be addressed in prose where non-obvious. A formal `transitions[]` schema is on the backlog (see `docs/backlog.md` P1-8) but not yet enforced.

If a component genuinely cannot meet a threshold (rare), document the exception inline in the YAML with a `notes:` block explaining why, and add a per-component override to the depth test rather than silently lowering the bar.

## Consistency across components

A real risk in long-form curated reference sites is *drift* — component 12 has a different style, structure, or depth than component 1. Mitigations:

- **Schema is a hard contract.** All components conform to the same Zod-validated schema. New fields are added consciously, not ad-hoc.
- **Anchor on previous components.** When writing a new component, use a previously-finalized component (e.g., Card or Modal) as a structural anchor.
- **Periodic re-read.** Every 5 components, re-read the earlier ones for tone and depth alignment.

## Versioning + changelog editorial trigger

The schema's `since` and `changelog` fields ([schema.md → Versioning](./schema.md#versioning-optional)) are dormant by editorial design until a component has a published change worth versioning. As of 2026-05-05 no canonical component declares either field, and the `get_changelog` MCP tool returns `null` for all 41 components — that is the intended state.

When a qualifying edit lands, the editor writes the changelog entry. Qualifying edits:

- **Schema rename of a published field.** A slot, axis, variant, property, or event renames to a new canonical name. The previous name moves to `variantDeprecations` / per-property `deprecated` / per-slot `deprecated` with `replacement` pointing at the new name. Bumps MAJOR or MINOR depending on whether the rename is breaking.
- **Mistake correction after publish.** A `mistakes[].id` is removed (no longer a real failure mode) or its `severity` is changed in a way that invalidates prior reader assumptions.
- **Canonical-name change of the component itself.** The `name` field changes (e.g. "Notification" → "Toast"). Bumps MAJOR.
- **Variant / property / event removed.** Anything that was in the canon and is now not. Bumps MAJOR.

Non-qualifying edits (prose rewrites, additive contracts / mistakes / mismatches, `lastReviewed` bumps, new components) flow through normal commit history and do not land in `changelog[]`. Adding a new component to the canon is a project-level event tracked elsewhere (the `since` field on a brand-new component starts blank — it gets populated on its first qualifying edit, not on initial publication).

The downstream consumer pattern (implementation audits, design-system bridges, MCP agents) caches `(componentId, lastSeenVersion)` and re-runs audits whenever `since` advances past the cached value. The `summary` text on each changelog entry tells the consumer whether the bump is breaking or additive; that is enough for triage.

## What this methodology is not

- Not academic. We don't cite every claim like a paper.
- Not exhaustive. We don't document every edge case in every library.
- Not prescriptive. We describe what reasonable defaults look like; we don't mandate them.
