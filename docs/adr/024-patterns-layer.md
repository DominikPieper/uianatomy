# ADR 024: Patterns Layer (Compositions on top of Canonical Atomics)

**Status:** Proposed
**Date:** 2026-05

## Context

The canon today is exclusively atomic — 23 individual components, each documented in isolation. Real product UI is compositional: a login flow is `Card + Form + Button + Link`; a settings page is `SidebarNav + Tabs + ListItem + SegmentedControl`; a confirmation flow is `Modal (alertdialog) + Button (destructive)`. The "how do I assemble these?" question is currently unanswered by UI Anatomy.

Three concrete drivers:

1. **SEO + AI-citation surface gap.** Polaris, Carbon, Material 3, Atlassian, GOV.UK all have a "patterns" / "recipes" / "templates" section, and that's a disproportionate share of their inbound search traffic — long-tail queries like "how to build a delete confirmation modal" or "checkout flow component pattern" land there, not on atomic component pages. UI Anatomy currently has zero answer surface for compositional questions.
2. **Persona gap from `docs/personas.md`.** The DS-maintainer persona explicitly asks "which combinations of these components are canonical, and which are anti-patterns?" Atomic anatomy doesn't answer that.
3. **Decision-fatigue gap.** Even when both `Card` and `Modal` are documented, choosing between "an inline Card with form fields" and "a Modal with form fields" for a specific UX problem requires a third document — the comparison, the trade-offs, the rationale. The atomic pages are wrong place for that prose.

The risk is real too: every popular DS site eventually drifts from "atomic reference" to "yet another component library docs site" once they add patterns. UI Anatomy's USP is the *bridge* — Figma↔code, mistakes, mismatches, divergences. A patterns layer must serve that bridge, not dilute it.

## Decision

Add a **Patterns layer** as a new top-level concern parallel to `content/components/`. Each pattern is a *composition of two or more canonical components*, documented with the same canon-first discipline (ADR-001) — library-agnostic, prose-rich, evidence-triangulated.

Two design questions to resolve at landing time. This ADR proposes A1 + B1 + C2 + D1 + E1 + F1 below; alternatives are listed for visibility.

### A. Schema vs free-form Markdown

- **A1 (preferred): Structured Zod schema, modeled on `componentSchema`.** A pattern declares: `id`, `name`, `description`, `composition: Array<{ componentId, role, notes? }>` (at least 2 entries; refine validates each `componentId` against the canon roster), `whenToUse: { use, avoid }`, `decisions: Array<{ question, answer, rationale }>` (at least 1; the "why this composition not the alternative"-content), `mistakes: Array<{ id, title, description, fix }>` (at least 3, mirrors `componentSchema.mistakes`), `frameworkSkeletons: { webComponents, react, vue, angularSignals }` (each a multi-line code string showing the bare composition), `lastReviewed`, optional `figmaSlots?: Array<...>` reusing `figmaHintSchema` for Designer-view rendering.
  - Pro: queryable via MCP (`list_patterns`, `get_pattern`, `get_patterns_for_component`); enforced consistency across patterns; validation prevents drift; same Zod-discipline that proved out for components.
  - Con: high authoring cost per pattern (estimated 4-6h per substantive pattern). Schema-first means slow incremental adoption.
- A2: Pure-Markdown content collection, no Zod schema beyond `{ title, summary, components: string[], lastReviewed }`. Authors write prose freely.
  - Pro: low friction; first 5 patterns can land in a week.
  - Con: drift inevitable; not MCP-queryable; not bridge-discipline-enforceable.

### B. Cross-component surfacing on canonical pages

- **B1 (preferred): "Used in patterns" section** on every component page that appears in any pattern's `composition[]`. Renders as bullet list of `{patternName, role}` pairs at the bottom of the Designer + Bridge views (not Dev — Dev-view is implementation-focused, patterns are conceptual). Auto-derived from the patterns roster at build time; no per-component YAML edit.
- B2: No cross-link. Patterns are a separate site section. Cleaner separation, but loses the discovery path "I'm reading about Card; what's it used in?"

### C. URL structure

- C1: `/patterns/<id>` flat.
- **C2 (preferred): `/patterns/<id>` + `/patterns` index page** mirroring the components-index pattern. Index uses the same `ComponentCard`-style grid with pattern names + descriptions. SEO-wise the index gives a strong landing surface for "design pattern X" queries.

### D. View parity

- **D1 (preferred): Three views per pattern (designer/dev/bridge)** mirroring components — same per-URL-routing strategy from P4-25. Designer = composition diagram + when-to-use + decisions + Figma-side guidance for the composite frame structure. Dev = framework-skeleton code per framework + composition rules + a11y considerations. Bridge = the "what designers and developers misalign on" section, mistakes, and the "vs other patterns" comparison.
- D2: Single page per pattern with collapsible sections. Lower build complexity but loses the canon's signature three-perspective discipline.

### E. MCP exposure

- **E1 (preferred): Three new tools.** `list_patterns` (`{}` → array of `{id, name, description, componentCount}`), `get_pattern({id})` (full pattern record), `get_patterns_for_component({componentId})` (array of patterns where `composition[].componentId === id`). Tool count moves to 22.
- E2: Defer MCP exposure until ≥10 patterns land. Atomic-only MCP is still useful; patterns can be retrofitted.

### F. SVG composition diagram

- **F1 (preferred): Reuse `renderAnatomySVG` mechanics with an outer "composition box" + nested per-component anatomy frames at fixed slot positions.** Each component's role label sits in the composition's parent-strip; the per-component slots remain visible but greyed (decorative-stroke style) so the eye reads "two components, here's how they nest." Builds on ADR-005 + ADR-020 (slotKind) without inventing a second renderer.
- F2: Skip SVG; render composition as a labeled list ("Card containing Form containing [Input, Input, Button]"). Cheaper but loses the visual-vocabulary parity with components.

## Rationale

### Why structured schema (A1) despite higher authoring cost

The canon's USP is bridge-discipline, not "lots of content fast." Markdown-only patterns optimise for the latter at the cost of the former — within a year the patterns section would have inconsistent mistake-counts, missing rationale, and drift between framework-skeletons and the canonical-component data they reference. The same drift the atomic-canon-Zod-schema prevents. Patterns deserve the same discipline.

The authoring-cost concern is real but bounded: a 5-pattern MVP (Login, Settings, Confirmation, Dashboard-shell, Empty-state) covers most discovery-traffic pattern queries based on Polaris/Carbon analytics. Five well-researched patterns over markdown-fast-30 patterns is the right trade for a canon-first site.

### Why "Used in patterns" cross-link (B1) instead of cleaner separation (B2)

Discovery beats purity. A reader landing on `/components/card` because they searched "Card component anatomy" should see "Card is used in: Login form, Empty state, Dashboard tile, Settings group." That's three new pages of relevant content per atomic landing. The cross-link is auto-derived from the patterns roster — no per-component YAML edit, no drift risk.

### Why three views (D1) despite the build-complexity cost

The three-views architecture is the canon's strongest brand-distinguishing feature. Patterns rendered as flat single-page documents would visually break that — readers who switched views on `/components/modal` would land on `/patterns/confirmation-flow` and see a single document, undoing the muscle-memory. Per-URL routing (P4-25) means three pages per pattern; with five patterns at MVP that's 15 additional build outputs, marginal cost.

### Why MCP exposure at landing (E1) instead of deferring (E2)

The MCP server is now the project's most-active consumption surface — agent skills, validate_implementation, etc. Patterns landing without MCP exposure means agents can't answer "how do I compose these components into a confirmation flow?" through the MCP — they'd fall back to scraping the HTML or the .md sidecars. Better to expose the structured data through the same protocol from day one.

### Why a separate ADR rather than extending ADR-001

ADR-001 is "canon first, no implementation references in canonical content." Patterns inherit that — a Login pattern's `frameworkSkeletons.react` shows the *composition*, not the imports from a specific library. But patterns are a new categorical layer (compositions, not atomics) and warrant a separate ADR for their own decisions (composition-schema, "Used in patterns" cross-link discipline, framework-skeleton format). Implementations stay in `implementations/<lib>/<id>.yaml`; patterns are canonical compositions, not implementations of compositions.

## Consequences

### Concretely lands in the repo

- New `content/patterns/` directory (parallel to `content/components/`, `implementations/`).
- `shared/src/schema.ts` gains `compositionEntrySchema`, `patternDecisionSchema`, `patternSchema`. Cross-field refines validate `composition[].componentId` against the components roster (loaded via the same `loadComponents` already in shared).
- New site routes: `/patterns` (index), `/patterns/<id>` (designer), `/patterns/<id>/dev`, `/patterns/<id>/bridge`.
- New SVG-generator extension `renderPatternSVG` (or option flag on the existing renderer).
- MCP tools: `list_patterns`, `get_pattern`, `get_patterns_for_component`. Tool count 19 → 22. SKILL.md regen.
- "Used in patterns" cross-link section on every component page, auto-derived.
- New Astro content collection `patterns` with `loader: glob({pattern: '*.yaml', base: '../content/patterns'})` and the new `patternSchema`.
- New JSON API `/api/patterns.json` + `/api/patterns/<id>.json` mirroring the components endpoints.
- Each pattern emits a Markdown sidecar via the existing astro-llms-md integration; sitemap + Pagefind picks them up automatically.
- New SEO graph node `Dataset.distribution` adds a third entry for `/api/patterns.json`. Each pattern page gets `HowTo` JSON-LD (this is the one place where HowTo is *not* a forced fit — patterns *are* literally how-tos).

### MVP roster (5 patterns, ordered by SEO + persona-coverage value)

1. **Login form** (Card + form fields + primary Button + secondary Link). Highest-volume pattern query category.
2. **Confirmation flow** (Modal alertdialog + destructive Button). DS-maintainer + a11y bridge gold — confirmation-dialog mistakes are the single most-cited a11y-failure category in component reviews.
3. **Empty state** (Card + Banner + primary Button). UX-discipline beacon; cited by Polaris + Carbon as a make-or-break detail.
4. **Settings page** (SidebarNav + Tabs + ListItem + SegmentedControl). Compositional density max — exercises the schema's `composition[]` validation hardest.
5. **Dashboard shell** (SidebarNav + Card grid + Banner). Common starting-template pattern.

Each pattern: 4-6h research + writing per ADR-001 discipline (≥3 spec/library/DS sources, decisions + mistakes + frameworkSkeletons). Estimate: 25-30h total for MVP across two to three sessions.

### Out of scope at MVP

- Per-pattern divergence-from-implementation audits (Phase 2 for patterns; equivalent to Phase 2 for components — wait until ≥3 mature DS-pattern-libraries audited).
- Pattern-to-pattern relationships (`vsRelated` for patterns). Add when the roster passes ≥10 entries.
- Visual-density / layout-density metadata (`patterns.layout: 'compact' | 'spacious'`). Wait for real demand.
- "Anti-patterns" as a separate type. Document anti-patterns *inside* a pattern's `mistakes[]` rather than as their own document — keeps the positive-pattern-as-primary-surface discipline.
- Per-pattern OG-image generation. Reuse the existing `astro-og-canvas` template with pattern-name as title; no new design.

### Risk and mitigation

- **Risk**: Patterns drift toward "another component library docs site," losing the bridge USP. **Mitigation**: every pattern's required Bridge-view documents the figma↔code mismatches *for the composition*, not just the components. If a pattern has no compositional bridge content, it doesn't pass review.
- **Risk**: Patterns become a maintenance burden parallel to atomic canon. **Mitigation**: hard cap at 10 patterns until 6+ months of usage data. Resist roster-growth pressure.
- **Risk**: Schema-design mistakes lock in poor authoring ergonomics across the roster. **Mitigation**: write the first pattern (Login form) end-to-end *before* committing the schema; iterate the schema on real data, not paper. ADR-013 (implementation-schema) used the same pattern and surfaced one regex-widening mid-flight.
