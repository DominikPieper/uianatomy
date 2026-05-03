---
name: canon-component-author
description: Research and author a new canonical component YAML in content/components/<id>.yaml from scratch — synthesizing anatomy, axes, mismatches, mistakes, frameworkMap, motion, responsive, and all P2 sections from W3C APG, MDN, WCAG, and at least three mature headless libraries (Radix, React Aria, Headless UI, Spectrum) plus two design systems (Polaris, Carbon, Material 3, Atlassian, GOV.UK). Use whenever the user asks to add, draft, or research a new canonical component — phrases like "neue komponente X", "draft canonical Y", "research and write the Z anatomy", "add component", "author canon for component", "synthesize component anatomy". Strictly canon-first per ADR-001 — never references implementations like Atelier UI. Validates against the depth contract in shared/tests/depth.test.ts before declaring done.
---

# canon-component-author

Drives the full author cycle for a new canonical component, end-to-end. The canon is uianatomy's most expensive content surface — getting one component wrong propagates through SVG generation, MCP tools, site rendering, and all phase-2 implementation audits. This skill enforces the methodology in `docs/methodology.md` mechanically.

## When to use

Trigger when the user says any of:

- "neue komponente: <name>" / "add component <name>"
- "research the <name> anatomy" / "draft canonical <name>"
- "author canon for <id>"
- "wir brauchen <name> in content/components/"
- A backlog item names a missing component and the user says "go" / "fang an"

Do **not** trigger for:

- Implementation YAMLs (`implementations/<lib>/<id>.yaml`) — different schema, different research method
- Pattern files (`content/patterns/<id>.yaml`) — different schema (`patternSchema`)
- Edits to existing components — those are field-level changes, often go through `schema-field-add` instead

## The author cycle

### Step 1: Confirm scope and id

Ask exactly these before researching:

- **id** (kebab-case slug, e.g. `tag-input`)
- **name** (display, e.g. "Tag Input")
- **canonical or implementation-specific?** If the user describes "our X" or names a library, redirect: canon is library-agnostic per ADR-001. The component must exist as a recognized industry pattern across ≥ 3 mature libraries before it deserves canonical status.

If id collides with existing `content/components/<id>.yaml`, stop and ask if this is an edit or a rename.

### Step 2: Research from at least 3 source categories

`docs/methodology.md` mandates:

1. **Normative specs** (always required): W3C ARIA Authoring Practices Guide (APG), MDN Web Docs, WCAG.
2. **Mature headless libraries** (≥ 3 of: Radix UI, React Aria / React Spectrum, Headless UI, Spectrum Web Components, Reach UI, Aria Components by Adobe).
3. **Real design systems** (≥ 2 of: Shopify Polaris, IBM Carbon, Atlassian Design System, Material Design 3, GOV.UK Design System, Atlassian, Fluent UI).
4. **Platform conventions** (where the component is interaction-heavy: macOS HIG, Windows UX, Android Material).

Use `WebSearch` and `WebFetch` for source pull. Note dates of library docs cited (APIs change; canon must be timestampable).

Synthesis recipe per `methodology.md`:

- **Anatomy slots**: what slots/regions appear consistently? Where do names diverge? Pick the canonical name (often the one used by the most mature spec-compliant library; document the divergence in `mismatches`).
- **Variants vs properties vs states**: apply the test
  - Variant = "different version" (different visual treatment, different use case)
  - Property = "same component, parameterized" (modifies an existing variant)
  - State = "same component, currently in this situation" (interaction or app state)
- **Mismatches**: where do designers and developers misunderstand each other on this component?
- **Mistakes** (≥ 4 per depth contract): what are the typical implementation errors? Each needs a clear correct alternative.
- **Cross-framework map**: how does the canonical anatomy translate to Web Components, React, Angular, Vue?

### Step 3: Honor the minimum depth contract

`shared/tests/depth.test.ts` enforces editorial minimums. The component **fails test suite** if any threshold is below:

| Dimension | Minimum | Note |
|---|---|---|
| Anatomy slots | ≥ 3 | Below 3 the component is a primitive |
| Variants | ≥ 2 | Single-variant components do not justify a `variants` axis |
| Properties | ≥ 2 | Real components have parameterizable surfaces |
| States (interactive + data combined) | ≥ 4 | Modal-heavy on data, Button-heavy on interactive |
| Mistakes | ≥ 4 | Three feels editorial, four forces a fourth angle |

Per-component overrides exist in `shared/tests/depth.test.ts` for genuine primitives (Card, Link, Button-with-no-data-states). Override only with explicit user OK.

### Step 4: Fill all required schema sections

Required top-level fields (`shared/src/schema.ts` is the contract):

```yaml
id: <kebab-id>
name: <Display Name>
description: <one-paragraph what-it-is>

anatomy:                                # ≥ 3 slots
  - id: <slot-id>
    required: true | false
    purpose: <prose>
    layout: { row: N, span: 'full' | 'half' | …, aspect?: '16:9' | … }
    slotKind: structural | content | interactive | decorative   # ADR-020
    figma: { type: <enum>, hint: <prose> }
    code: { slot: <slot-name>, semantic: <element-or-role> }
    a11y: { hint: <prose> }
    tokens?: { spacing?: {...}, radius?: {...}, color?: {...}, elevation?: {...}, typography?: {...} }
    repeats?: 2..5                     # SVG sample count only

axes:
  variants: [...]                       # ≥ 2 entries
  properties: [...]                     # ≥ 2 entries; type: discriminated union (ADR-010)
  states:
    interactive: [...]
    data: [...]
    transitions?: [...]                 # cross-refine: from/to ∈ interactive ∪ data

mismatches: [...]
mistakes: [...]                         # ≥ 4; each with severity: blocker|major|minor (P6-72)
frameworkMap: {...}                     # webComponents | react | angularSignals | vue
```

Required P2 sections (most components have all):

- `whenToUse: { use, avoid, vsRelated? }` — vsRelated must be **bidirectional** per P6-79. Every reverse-ref must be authored from the target's perspective. If you reference an existing component, also edit that component's `whenToUse.vsRelated[]` to add the reverse-ref.
- `i18n: { rtl: { mirroring }, textExpansion }` — both required when present.
- `a11yAcceptance: { keyboardWalk?, announcements?, axeRules? }` — at least one of three; `axeCoreVersion: 4.10.2` when `axeRules` present (P6-71).
- `propertyMap: [{ figma, code, kind: enum|boolean|text|slot|number, notes? }]` — `kind` is tool-neutral per ADR-025.
- `events: [{ name (camelCase), payload, frameworkNotes: { webComponents, react, angularSignals, vue }, optional? }]` — `optional: true` only when context-sensitive canonical (P6-76).

Optional sections (declare only when meaningful):

- `motion: { durations, easing, reducedMotionFallback }` — declare when ordered phases / mode-dependent / async meaningful return; omit when states are mutually-independent flags (Button, Card, Link omit per P6-68).
- `responsive: { breakpoints: [{ at, change }] }` — declare when cross-breakpoint behavior shifts.
- `formIntegration: { name?, formData?, reset?, validation? }` — declare for form controls and form containers.
- `performance: [...]` — declare only when there is a real numeric capacity threshold (Combobox virtualization, Tabs overflow). Single-entry omits like Modal `stackDepth` belong in `whenToUse.avoid` prose, not here (P6-75).
- `contracts: { nonNegotiable?, vocabularyDrift? }` — extract structurable content from notes per ADR-027.
- `notes` — freeform residue for prose that doesn't fit any structured field. Use sparingly.

### Step 5: Validate before render

```bash
pnpm -F @uianatomy/shared build
pnpm -r test
pnpm -r typecheck
```

Specifically watch for:

- Zod parse errors (point at the YAML line in the error path)
- Depth-contract failures (`<id>: <dimension> N < M`)
- vsRelated bidirectional lint (you forgot to author the reverse-ref)
- Vocabulary lint (you used a non-canonical token name; check `shared/src/vocabulary.ts`)

### Step 6: Verify all three views render

```bash
cd site && pnpm dev
```

Open `http://localhost:4321/components/<id>` and switch through Designer / Dev / Bridge views. Each must render coherently. The anatomy SVG must auto-generate from `anatomy[].layout` — if it looks wrong, fix the `layout` data, not the SVG. (Per ADR-005 and the project's anatomy-data-as-source-of-truth principle.)

If the SVG override is required (rare), document why in `notes`.

### Step 7: Update bidirectional refs and backlog

- For every `whenToUse.vsRelated[].id` you authored, open that component and add the reverse-ref. The lint test catches missing reverse-refs but the prose must be **authored from the target's perspective** — generic "see X" is rejected.
- If a backlog item named this component, flip `[ ]` → `[x]` per `docs/CLAUDE.md` convention.

## Authoring guidelines specific to this repo

- **Rationale, not just rules.** Every slot, variant, mistake, mismatch needs a *because*. The anatomy is "no better than reading APG" without rationale.
- **No framework partisanship.** The cross-framework map is descriptive. No "React is the canonical answer."
- **Date library claims.** Any "Library X currently does Y" gets a verifiable timestamp inline or in `notes`.
- **Atelier UI is invisible.** Per ADR-001. Do not consult Atelier source. Do not match its anatomy.
- **Disagreement is named.** If Radix and React Aria disagree on Tab semantics in an open Combobox, name the disagreement and pick a recommendation with rationale.
- **Tone**: declarative, no hedging. Sentence-case headings. "Anatomy" = slot/region structure, never visual styling. "Variant" / "Property" / "State" are technical terms with precise meanings — use them precisely.

## Final summary template

```
Canonical component: <name> (<id>)
Sources: APG (<url>), MDN (<url>), Radix (<lib-version>), React Aria (<lib-version>), Headless UI (<lib-version>), Polaris (<date>), Material 3 (<date>)
Schema sections: anatomy(N slots), axes(V variants/P properties/S states), mismatches(N), mistakes(N) — severities <blocker:N major:N minor:N>, frameworkMap, propertyMap(N entries), whenToUse(<vsRelated:N>), i18n, a11yAcceptance(axeRules:<N> keyboardWalk:<N> announcements:<N>), events(N), <optional sections declared>
Bidirectional refs added: <list of components with reverse-refs authored>
Tests: <count> green (<delta vs baseline>); typecheck: pass.
Site renders: designer ✓ dev ✓ bridge ✓ ; SVG auto-generated.
Backlog: <PX-NN> flipped to [x] | no backlog item.
```

## What not to do

- Do not start writing YAML before the research is complete; you will end up reverse-justifying gaps.
- Do not skip the depth contract; sub-threshold YAMLs **fail the test suite**, not just the editorial review.
- Do not author reverse-refs as boilerplate ("see X"); the lint accepts them syntactically but the canon loses value. Each `vsRelated` reverse-ref needs prose authored from the target's perspective.
- Do not declare done before the site renders all three views and `pnpm -r test && pnpm -r typecheck` pass green.
- Do not bundle two components in one cycle. Each gets its own research, validation, and render-check.
