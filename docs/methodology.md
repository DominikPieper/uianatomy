# Methodology

How component anatomies are researched, written, and validated.

## Core principle: canon first, implementations later

The canonical anatomy of a component is documented *without reference to any specific implementation*, including Dominik Pieper's own libraries. Specific implementations are documented separately, after the canonical reference is stable.

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
- [ ] At least 3 common mistakes documented with fixes
- [ ] Figma↔Code mismatches identified
- [ ] Cross-framework map populated
- [ ] All library-specific claims verified against current docs (with date)
- [ ] Schema validation passes
- [ ] Anatomy SVG generates correctly
- [ ] All three views render coherently

## Consistency across components

A real risk in long-form curated reference sites is *drift* — component 12 has a different style, structure, or depth than component 1. Mitigations:

- **Schema is a hard contract.** All components conform to the same Zod-validated schema. New fields are added consciously, not ad-hoc.
- **Anchor on previous components.** When writing a new component, use a previously-finalized component (e.g., Card or Modal) as a structural anchor.
- **Periodic re-read.** Every 5 components, re-read the earlier ones for tone and depth alignment.

## What this methodology is not

- Not academic. We don't cite every claim like a paper.
- Not exhaustive. We don't document every edge case in every library.
- Not prescriptive. We describe what reasonable defaults look like; we don't mandate them.
