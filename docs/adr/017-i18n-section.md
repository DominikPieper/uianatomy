# ADR 017: Internationalisation Section

**Status:** Accepted
**Date:** 2026-04

## Context

UI components built without RTL or text-expansion thinking ship to RTL locales (Arabic, Hebrew, Persian, Urdu) and to high-expansion locales (German, Russian, Finnish, Polish) with predictable failure modes:

- **RTL** — directional icons hard-code `transform: rotate(180deg)` instead of mirroring on `dir="rtl"`; the active-tab indicator slides in the wrong direction; close-button positioned with `right: 0` instead of `inset-inline-end: 0`.
- **Text expansion** — buttons truncate German labels because their `min-width` was sized for English; tab labels overflow on narrow viewports because the canonical density token assumed Latin character widths.

The canon currently encodes some of this implicitly — `mistakes.tabs-indicator-not-rtl-aware` mentions logical properties for the Tabs indicator; per-slot `a11y.hint` mentions text direction inheritance. But the canonical authority for "how does this component behave under RTL? Under text expansion?" is fragmented across mistakes and a11y prose. A developer auditing for i18n readiness has to grep multiple files per component.

Backlog item P2-14 fills the gap with a structured `i18n` field on `componentSchema`. Two facets — RTL mirroring and text expansion — cover the universal core; future facets (numerals, date formatting, bidi-text within mixed-direction documents) can extend the schema as concrete needs surface.

## Decision

`i18n` enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`, `responsive`, `events`, `whenToUse`, `a11yAcceptance`, `propertyMap`, `formIntegration`. Two required fields when present: `rtl.mirroring` (nested under `rtl` for extensibility) and `textExpansion`.

```yaml
i18n:                                   # optional
  rtl:                                  # required when i18n present
    mirroring: >-                       # required prose
      Leading and trailing icons swap visual position via logical
      `inline-start` / `inline-end` properties — what was on the left
      in LTR appears on the right in RTL.
  textExpansion: >-                     # required prose
    Labels can grow 30–50% longer in German, Russian, or Finnish. The
    canonical Button does not enforce a max-width; truncation is a
    last resort and requires a `title` attribute carrying the full
    label.
```

The schema:

```ts
export const i18nRtlSchema = z
  .object({
    mirroring: z.string().min(1),
  })
  .strict();

export const i18nSchema = z
  .object({
    rtl: i18nRtlSchema,
    textExpansion: z.string().min(1),
  })
  .strict();

// componentSchema gains: i18n: i18nSchema.optional()
```

Render: `I18nSection.astro` slots into Designer view (after Responsive, before Axes) and Bridge view (after FormIntegration, before Accessibility). Dev view does not render the section — RTL and text expansion are visual / layout concerns that designers and the cross-team Bridge audience care about most; dev-side guidance lives implicitly in the per-slot `a11y.hint` and `mistakes` (e.g. `tabs-indicator-not-rtl-aware`).

## Rationale

### Why nested `rtl: { mirroring }` instead of flat `rtlMirroring`

Future RTL concerns are likely to surface — `numerals` (Arabic vs Latin numeral sets per locale), `dates` (date-format mirroring under RTL), `dir-attribute` (when to set `dir="rtl"` on the component vs inherit), bidi-text handling for mixed-direction prose. A nested `rtl: {}` namespace lets these add fields without flat-namespace churn:

```yaml
i18n:
  rtl:
    mirroring: ...
    numerals: ...           # future
    dates: ...              # future
```

Flat `rtlMirroring` / `rtlNumerals` would force every i18n consumer to learn the prefix convention. Nested `rtl.{...}` mirrors how the schema treats `axes.states.{interactive,data,transitions}` — sub-namespaces grouped by domain.

### Why both fields required, not optional with refine

Most components have meaningful stories on both axes. Forcing both required:

1. Catches the "we forgot the text expansion story" gap at parse time.
2. Avoids the "do we need a refine?" decision (the refine pattern is for fields where some components legitimately have no story — `a11yAcceptance`, `formIntegration`).
3. Mirrors `responsive.breakpoints[].change` discipline — required prose, not opt-in.

A future component where one of the two is genuinely N/A (e.g. an icon-only component with no text to expand) can either omit `i18n` entirely or document the absence in prose ("Icon-only; text expansion does not apply"). The schema does not need to model the absence.

### Why prose, not structured payloads

A structured RTL shape (`rtl: { iconsMirror: true, indicatorDirection: 'inline-start', dirAttributePassthrough: true }`) was considered. Rejected for the same reasons ADR-008 / ADR-009 / ADR-016 rejected structured prose:

1. **The space of mirroring rules is open.** Tabs's "ArrowLeft moves to next tab in RTL" is a keyboard model fact; Modal's "footer button order reverses logically" is a layout fact; Combobox's "chevron rotation does *not* mirror" is a per-icon exception. Structured form would either over-fit to Phase-1 components or balloon into a "any string"-keyed bag with no validation gain.
2. **Implementation hooks are framework-specific.** Logical properties (`inset-inline-end`), `dir` attribute handling, `:dir(rtl)` pseudo-class, RTLCSS plugins — every framework has its own bag of tools. Prose explains the *spec*; the implementation choice is a Phase-2 concern.

### Why per-component, not per-anatomy-slot

RTL mirroring spans multiple slots simultaneously (Modal's close-button moves, footer-button order reverses, content direction inherits). Text expansion is a component-wide constraint (Card's title clamps to 2 lines while body free-flows). Per-slot attachment would force "which slot's mirroring story wins?" and duplicate prose across slots that share the same behaviour. Same anchor as the other top-level fields (motion / responsive / events / whenToUse / a11yAcceptance / propertyMap / formIntegration).

### Why Designer + Bridge views, not Dev

RTL and text expansion are primarily *visual* concerns for designers (does the mockup work mirrored? does the label fit?) and *cross-team alignment* concerns for Bridge view (designer assumes mirroring "just works"; developer needs `inset-inline-end` discipline). Dev view's existing surface (frameworkMap, mistakes like `tabs-indicator-not-rtl-aware`, per-slot `a11y.hint`) covers the implementation guidance.

If dev feedback later surfaces a real "we need i18n in Dev view too" case, it lands as a one-line edit. P2-14 ships Designer + Bridge.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P2-14):

```ts
export const i18nRtlSchema = z.object({
  mirroring: z.string().min(1),
}).strict();

export const i18nSchema = z.object({
  rtl: i18nRtlSchema,
  textExpansion: z.string().min(1),
}).strict();

// componentSchema gains: i18n: i18nSchema.optional()
```

Implementation side — none. `i18n` is canonical-vocabulary; per-implementation deltas (Radix's `dir` prop forwarding, Headless UI's `:dir(rtl)` use) live as Phase-2 divergence rows referencing `i18n.rtl.mirroring` paths.

## Phase 1 implication

All five Phase-1 components migrate. Each declares both `rtl.mirroring` and `textExpansion` prose. The render component (`I18nSection.astro`) lands in Designer view (after Responsive, before Axes) and Bridge view (after FormIntegration, before Accessibility).

The MCP tool surface gains `get_i18n` once Phase-2 audits surface a concrete consumer — file as a follow-up batch with other deferred Phase-2 tools.

## Consequences

**Positive:**

- Designers and developers get a structured i18n acceptance surface — the prose was previously implicit and re-derived per-locale audit.
- Bridge view captures real cross-team i18n mismatches (designer thinks "rotate icons 180°" works; developer needs `:dir(rtl)` discipline).
- Phase-2 implementation audits can record per-library i18n deltas as divergence rows pointing at `i18n.rtl.mirroring` etc.
- The "does this library work in RTL?" Phase-2 question gets a structured comparison surface.

**Negative:**

- Authoring overhead per component (~10–20 lines of prose). Mitigated by the high signal — i18n acceptance was previously an audit gap, formalising it costs less than re-deriving per locale.
- The two-facet model (rtl, textExpansion) is opinionated. Some real i18n concerns are not represented yet (numerals, dates, bidi-text within mixed-direction docs). Mitigated: the nested `rtl: {}` namespace allows extension without flat-namespace churn; future ADRs add facets when concrete components need them.

**Neutral:**

- A future `localisationKeys` field documenting which strings should be translation-managed (vs hardcoded UI chrome) is a logical follow-up. Out of scope for P2-14.
- A future `bidi` facet for components that handle mixed-direction text (e.g. a Tag input that accepts both Hebrew and English tags side by side) may surface. File when a component needs it.

## Alternatives considered

**Flat `rtlMirroring` and `textExpansion`**: rejected. Future RTL concerns force flat-namespace churn; nested `rtl: {}` allows extension without disrupting consumers.

**Three-facet model with `numerals` from day one**: rejected. None of the five Phase-1 components has a meaningful numerals story (no embedded counters or date displays). YAGNI for now; extend when a real component needs it.

**Optional `rtl` and `textExpansion` with refine "at least one"**: rejected. Most components have stories on both axes; forcing both required catches the "we forgot one" gap. Future N/A cases either omit `i18n` entirely or document the absence in prose.

**Structured `rtl.mirroring` payload**: rejected. The space of mirroring rules is open; prose carries the spec; implementation hooks are framework-specific.

**Per-slot `i18n`**: rejected. RTL mirroring spans multiple slots; text expansion is component-wide. Per-slot fragmentation duplicates prose and obscures the unified surface.

**Render in Dev view**: rejected. Dev guidance lives implicitly in mistakes / a11y.hint / frameworkMap; per-component i18n prose is primarily visual / cross-team content. Lands as a one-line edit if real feedback surfaces.
