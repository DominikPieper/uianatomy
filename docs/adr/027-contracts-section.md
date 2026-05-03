# ADR 027: Structured `contracts` Section

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** none (additive)
**Related:** [ADR-005](./005-anatomy-doc-format.md) (notes is canonical catch-all), Atelier-feedback v2 P6-50

## Context

The Atelier-v2 review (2026-05-02) flagged the `notes:` field as carrying high-load-bearing canonical content in unstructured prose:

> notes is freeform prose containing critical contracts. Structure into `nonNegotiableContracts[]`, `vocabularyDrift[]`, `commonMisuses[]`.

An audit of the 24-component canon confirms the observation. 19 of 24 components declare `notes:` (461–801 characters each). Three structural patterns recur across those blocks:

1. **Vocabulary drift** — "Material 3 calls this Snackbar; Atlassian uses Flag; the canonical name matches Radix / Sonner." Found in 11 components (alert, banner, drawer, list-item, segmented-control, select, sidebar-nav, stepper, tag-input, tile, toast).
2. **Non-negotiable contracts** — "trigger inside heading is non-negotiable per APG"; "non-interactive content rule is non-negotiable per APG"; "list-vs-card distinction is the highest-load-bearing canonical decision". Found in 7+ components (accordion, menu-button, popover, segmented-control, tooltip, tile, stepper).
3. **Implementation-audit guidance** — "implementations layer on top of native HTML"; "Radix ships X; Headless UI ships Y"; "audits document this via componentName". Found in 6+ components (drawer, link, search-input, select, text-input, toast).

Two more patterns appear but are already covered by other surfaces:

- **Common misuses** are already structured in `mistakes[]` (each with `id`, `severity`, `title`, `description`, `fix`). Re-extracting them into a `contracts.commonMisuses[]` list duplicates that surface.
- **Pattern-vs-component boundary** is already structured in `whenToUse.vsRelated[]` (each with `id`, `difference` prose, now bidirectional per P6-79/P6-86).

What is *not* covered today, and is worth structuring:

- The vocabulary-drift attribution (which system uses which term, with our canonical choice).
- The non-negotiable contracts (which canonical rules are hard-binding vs. style-guidance).

## Decision

Add an **optional** top-level `contracts` field to `componentSchema` (and to `patternSchema` — patterns can have contracts too). Two sub-arrays:

```yaml
contracts:                                     # optional
  nonNegotiable:                               # optional, .min(1) when present
    - rule: >-
        Trigger element wrapped in a heading element of an
        appropriate level for the document outline.
      source: apg                              # apg | wcag | html-spec | platform | canon
      sourceRef: 'accordion#header'            # optional, free-form pointer
      consequence: >-
        Without the heading wrapper, the accordion is invisible to
        AT users navigating by headings; the entire section is
        unreachable through the canonical SR navigation flow.
  vocabularyDrift:                             # optional, .min(1) when present
    - system: Material 3
      theirTerm: Snackbar
      note: >-                                 # optional
        Material's "Snackbar" matches our Toast on the queue and
        viewport contract; canonical name picked Radix / Sonner
        precedent because that is the React-ecosystem default.
    - system: Atlassian
      theirTerm: Flag
    - system: Polaris
      theirTerm: Toast
```

`notes:` is **unchanged** — it remains the canonical catch-all for prose that does not fit either structured array (lineage notes, philosophical observations, history, cross-cutting guidance that does not bind a specific rule). The migration is *additive*: extract structurable content into `contracts`, leave the residue in `notes`.

### Schema sketch

```ts
export const contractSourceSchema = z.enum(['apg', 'wcag', 'html-spec', 'platform', 'canon']);

export const nonNegotiableContractSchema = z.object({
  rule: z.string().min(1),
  source: contractSourceSchema,
  sourceRef: z.string().min(1).optional(),
  consequence: z.string().min(1),
}).strict();

export const vocabularyDriftEntrySchema = z.object({
  system: z.string().min(1),
  theirTerm: z.string().min(1),
  note: z.string().min(1).optional(),
}).strict();

export const contractsSchema = z.object({
  nonNegotiable: z.array(nonNegotiableContractSchema).min(1).optional(),
  vocabularyDrift: z.array(vocabularyDriftEntrySchema).min(1).optional(),
}).strict().refine(
  (v) => v.nonNegotiable !== undefined || v.vocabularyDrift !== undefined,
  { message: 'contracts must declare at least one of nonNegotiable, vocabularyDrift' },
);

// componentSchema + patternSchema gain: contracts: contractsSchema.optional()
```

### Render

- **Designer view**: `vocabularyDrift` renders as a compact "also known as" list ("Material 3 → Snackbar · Atlassian → Flag · Polaris → Toast"), inline near the alternateNames row. Distinct from alternateNames (P6-62a) — alternateNames is flat search-index synonyms; vocabularyDrift carries system attribution.
- **Dev view**: `nonNegotiable` renders as a callout/badge list with the `source` rendered as a tag (APG, WCAG, HTML spec, platform, canon). Each entry shows the rule, the source-badge, the optional sourceRef link, and the consequence prose.
- **Bridge view**: both render. Bridge audience reads contracts as the cross-team checklist.

### MCP

New tool `get_contracts({ id })` returning `{ componentId, nonNegotiable[], vocabularyDrift[] }` (or `{ patternId, ... }` for patterns). Tool-count 25 → 26.

Optional follow-up tool `list_non_negotiable_rules()` aggregates across canon roster — useful for "build a global a11y-audit checklist" agent flows. Defer until first consumer asks; analogous to how `get_pattern_a11y_aggregate` deferred until P6-83.

## Rationale

### Why split into two arrays, not one `contracts[]`

The two arrays carry different shapes (rule + source + consequence vs. system + theirTerm + note) and feed different views (Dev/Bridge vs. Designer). Merging them into a discriminated union by `kind` would force render-side discrimination on every read; two named arrays read more naturally per-section.

### Why `source` is a closed enum

`apg | wcag | html-spec | platform | canon` exhaustively covers the binding sources we have observed. APG is the W3C ARIA Authoring Practices Guide. WCAG is success criteria binding for legal-conformance. HTML spec is the platform contract. Platform is OS-level (mobile picker behaviour, native form integration). Canon means "the canon itself enforces this; not derivable from upstream". A free-string `source` would let authors invent "best-practice" or "design-system-convention" — both are slippery and undermine the "non-negotiable" framing.

### Why `notes:` stays

Three reasons:

1. **Catch-all is canonical**. ADR-005 made `notes:` the deliberately-loose surface for prose that does not fit elsewhere; that role survives the extraction. Lineage observations ("anatomy is effectively the native HTML element"), philosophical framings ("most contract-rigid component"), implementation-audit-guidance ("audits should clarify naming via componentName") — none of these fit cleanly into either structured array, and inventing more sub-arrays for each turns the canon into a parts catalogue.
2. **Migration cost stays low**. An optional additive field means components migrate at the author's pace. Components without rich notes (button, card, combobox, modal, tabs already have no notes block) skip the migration entirely.
3. **Authoring discipline survives**. New components write notes first as prose; structurable content gets extracted in review or in follow-up audits. ADR-013-style "author first, then commit schema" stays the working pattern.

### Why not extract `commonMisuses` and `patternBoundary`

Both are already structured elsewhere:

- `commonMisuses` belongs in `mistakes[]` — that field is exactly "things that go wrong in production with their fixes". P6-72 added severity tiers. Re-extracting prose mentions like "the most-overlooked APG behaviour" into a separate array would duplicate the surface mistakes already cover.
- `patternBoundary` belongs in `whenToUse.vsRelated[]` — bidirectional cross-references with `difference` prose (P6-79/P6-86). The notes-prose mentions ("the role-vs-pattern distinction is the most-overlooked semantic decision") are *meta-statements about* `vsRelated` content, not new content.

ADR-027 narrows to the two patterns that have no canonical home today.

### Why `vocabularyDrift` and not extending `alternateNames`

`alternateNames` (P6-62a) is a flat array of synonyms — search-index for users typing "Dialog" or "Alert dialog" expecting Modal. It does not carry attribution: just the term.

`vocabularyDrift` carries the *attribution and reasoning*: which design system uses which term, why the canon picked its name, which other systems map to the canonical concept. The two surfaces are complementary:

- **alternateNames** answers "what would users search for?"
- **vocabularyDrift** answers "where does the canonical name come from?"

Merging would mean either losing attribution (alternateNames already does) or forcing every flat synonym to carry system metadata it does not have (Modal's "Alert dialog" is not Material 3's term — it is just an APG synonym).

### Why patterns also gain `contracts`

The two patterns shipped today (Confirmation Flow, Login Form) both have non-negotiable contracts that today live in pattern.notes prose:

- Confirmation Flow: "alertdialog vs dialog is non-negotiable per APG"; "destructive button initial focus is canonical".
- Login Form: "autocomplete tokens (`username` for the email field, `current-password` for password) are non-negotiable for password-manager interop"; "enumeration-leak in error messages is a security contract".

Patterns benefit from the same structured extraction. The schema gains `contracts: contractsSchema.optional()` on both `componentSchema` and `patternSchema`; the render component is shared.

## Migration plan

This ADR is the *design contract*. The migration is **multi-session** and lands in stages:

### Stage 1 (this ADR + schema-stub)

- Land ADR-027 with Status: Proposed.
- No schema change yet — wait for pilot validation.

### Stage 2 (schema + pilot)

- Land `contractsSchema` in `shared/src/schema.ts`.
- Add `contracts:` to 3 pilot components chosen for richest notes-content: **accordion** (non-negotiable: "trigger inside heading", "aria-expanded as source of truth"), **drawer** (vocabularyDrift: 4 systems with split-naming), **toast** (vocabularyDrift: 3 systems + Sonner-architecture-canonical).
- Validate that the schema absorbs the prose without distortion. If not, adjust shape and re-pilot before scaling.
- Render `ContractsSection.astro` and wire into Designer + Dev + Bridge views.
- Flip ADR-027 status to Accepted.

### Stage 3 (full migration)

- Extract `contracts` from the remaining 16 components with notes (alert, banner, disclosure, link, list-item, menu-button, popover, search-input, segmented-control, select, sidebar-nav, stepper, tag-input, text-input, tile, tooltip).
- Components without notes (button, card, combobox, modal, tabs) stay unchanged unless an explicit contract is identified.
- Pattern migration: Confirmation Flow + Login Form gain contracts in same stage.
- After every batch, re-read original `notes:` and confirm the residue still reads coherently — extraction must not turn `notes:` into a hollow stub.

### Stage 4 (MCP tool)

- Add `get_contracts({ id })` MCP tool. Tool-count 25 → 26.
- Document in SKILL.md.
- `list_non_negotiable_rules()` aggregator deferred to first consumer ask.

## Consequences

**Positive:**

- Non-negotiable contracts become queryable. An agent reading `get_contracts(modal)` sees a structured list of binding rules with source attribution, not a prose paragraph it has to summarize.
- Vocabulary drift attribution becomes a structured surface — useful for cross-system migration tooling (Material 3 → canon mapping), for translation guidance, and for the agents we expect to consume the canon when they encounter their host system's terms.
- Canon's authority signal strengthens. "Source: APG" / "Source: WCAG" tags on rules make the conformance basis explicit and audit-friendly.

**Negative:**

- Authoring overhead per component grows by an estimated 5–15 minutes for components with rich notes — extracting requires reading the existing prose and deciding which sentences are rules vs. observations.
- Migration touches 19 components × notes (plus 2 patterns). A multi-session effort; backlog tracks the staging.
- Renderer adds one more section, which marginally lengthens component pages. Mitigated by the section being optional and short.

**Neutral:**

- `notes:` survives in its current role. Existing readers do not lose anything; they gain a structured complement.
- The `source` enum is closeable but extensible via future ADR if a sixth attribution category emerges (current expectation: none).

## Alternatives considered

**Restructure `notes:` into a single discriminated-union array** (`notes: { kind: 'rule' | 'drift' | 'lineage' | 'misuse', ... }[]`): rejected. Mixes shapes that read differently per view; forces render-side discrimination; loses the catch-all role.

**Keep prose, add MCP-side extraction tooling** (LLM extracts non-negotiable rules from `notes:` at query time): rejected. Non-deterministic, expensive, and the extraction quality depends on the model — a structured field is the source of truth.

**Extract into 4+ sub-arrays (nonNegotiable / vocabularyDrift / commonMisuses / patternBoundary)**: rejected for `commonMisuses` (already in `mistakes[]`) and `patternBoundary` (already in `vsRelated`). The narrow scope of two new arrays minimises duplication.

**Make `contracts` required when `notes:` exceeds N characters**: rejected. Forces premature extraction; better to leave as optional and let authors decide per component.

**Render `nonNegotiable` as a section heading with bullets, vs. as inline callouts**: deferred to Stage 2 pilot. The first 3 components will validate the rendering; the choice of section vs. callout is a UI decision, not a schema decision.
