# ADR 018: Performance Thresholds

**Status:** Accepted
**Date:** 2026-04

## Context

Phase-1 components encode performance-related thresholds implicitly in `mistakes` prose:

- Combobox `mistake.combobox-non-virtualised-large-list` says "virtualise the option list when it exceeds ~200 items" — the 200 threshold is buried in a paragraph.
- Tabs `mistake.tabs-overflow-no-scroll-into-view` recovers from overflow but does not name a maximum-tab-count threshold; the existing `whenToUse.avoid` mentions ≤7 panels but doesn't make it queryable.
- Modal mistakes touch on stacking ("avoid stacked modals") without quantifying the canonical maximum.

Implementers building against the canon need numeric thresholds for capacity-planning decisions: "do I bring in `react-window`?" "do I lazy-mount tabs?" "is two open modals worth a redesign?". Today they have to grep prose. Backlog item P2-16 surfaces these thresholds as first-class structured data.

## Decision

`performance` enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`, `responsive`, `events`, `whenToUse`, `a11yAcceptance`, `propertyMap`, `formIntegration`, `i18n`. A non-empty array of structured threshold records:

```yaml
performance:                          # optional, non-empty when present
  - name: virtualisedListbox          # camelCase identifier
    metric: option-count              # what is measured
    threshold: 200                    # numeric value (positive)
    unit: items                       # what unit the value is in
    rationale: >-                     # required prose
      Above ~200 options, render virtualisation becomes necessary.
```

The schema:

```ts
const perfMetricName = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

export const performanceThresholdSchema = z.object({
  name: perfMetricName,
  metric: z.string().min(1),
  threshold: z.number().positive(),
  unit: z.string().min(1),
  rationale: z.string().min(1),
}).strict();

export const performanceSchema = z.array(performanceThresholdSchema).min(1);

// componentSchema gains: performance: performanceSchema.optional()
```

Render: `PerformanceSection.astro` slots into Dev view (after FormIntegration, before Accessibility) and Bridge view (after FormIntegration, before I18n). Designer view does not render the section — performance thresholds are dev capacity-planning content; designers care about the underlying UX rules (e.g. "≤7 panels" lives in `whenToUse.avoid`), not the implementation thresholds.

## Rationale

### Why a top-level field, not embedded in `axes.properties` or `mistakes`

The backlog text said "aus Mistakes nach oben in `properties` ziehen" (move out of mistakes up into properties). On reflection, **neither** location is right:

- `axes.properties` is for *parameterised values the consumer sets* (`size: sm | md | lg`). Performance thresholds are *runtime advice the consumer reads* — a different concern.
- `mistakes` is prose for "common errors and their fixes". Thresholds quantify the boundary at which an approach starts being a mistake. Embedding them keeps them coupled to a specific failure narrative, when the threshold itself is a separate structured fact.

A dedicated top-level field matches the precedent set by motion (timing facts), responsive (breakpoint facts), and events (callback facts) — all are structured facts the consumer queries against. Performance thresholds belong in the same tier.

### Why `name` is camelCase id, not free string

Future MCP tooling (`get_performance_threshold(componentId, name)`) needs a stable lookup key. CamelCase identifiers are the convention used elsewhere (motion duration keys, event names, axis property names). The regex `/^[a-z][a-zA-Z0-9]*$/` enforces shape; review enforces meaningful names.

### Why threshold is a single positive number, not a range or expression

Phase-1 thresholds are all single-point capacity boundaries: 200 items, 7 tabs, 1 modal, 100kb, 150ms. Encoding as `{ min, max }` would force authors to fill nullables for the unbounded direction; encoding as an expression string ("≥200") would lose the numeric type for tooling. A single number plus a separate `unit` and `rationale` carries everything needed; the `metric` field documents the *direction* of the threshold ("option-count" implies "above triggers virtualisation").

If a future component genuinely has a range threshold (e.g. "between 30fps and 60fps the animation is acceptable, below 30fps it stutters, above 60fps the budget is wasted"), file a follow-up to extend the shape with optional `min` / `max` fields. Out of scope for Phase 1.

### Why `metric` and `unit` are separate free-string fields

A closed enum for `unit` (`items | ms | tabs | modals | kb`) was considered. Rejected: the unit vocabulary is open and component-specific — Combobox measures items, Tabs measures tabs and kb, Modal measures modals, future components will measure frames, bytes, levels, characters. The free string keeps authoring flexible; review enforces consistency within a component.

`metric` is the *what is measured* dimension (`option-count`, `tab-count`, `panel-payload-size`). `unit` is the *unit of measurement* (`items`, `tabs`, `kb`). Both prose, both required. They are not redundant — the same metric can have different units in different components (panel-payload-size in kb vs in DOM nodes), and the same unit can measure different things (items can be options, tabs, list rows).

### Why per-component, not per-anatomy-slot

Performance thresholds are component-wide consequences. Combobox's listbox virtualisation is a property of the component's overall capacity, not of any single slot. Tabs's tablist overflow spans the tablist + indicator + tabpanel as a system. Same anchor as the other top-level fields.

### Why Dev + Bridge views, not Designer

Performance thresholds are dev capacity-planning content (numeric boundaries, implementation strategy switches like virtualisation or lazy-mount). Designers care about the *UX rule* derived from the threshold ("avoid >7 tabs because it's hard to scan") — that rule lives in `whenToUse.avoid`. The structured threshold is the implementation backing for that UX rule; surfacing both in Designer view duplicates the message.

Bridge view earns the section because the cross-team mismatch is real ("designer thinks the limit is fuzzy ux advice; developer needs an exact threshold to gate `react-window` import").

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P2-16):

```ts
const perfMetricName = z.string().regex(/^[a-z][a-zA-Z0-9]*$/);

export const performanceThresholdSchema = z.object({
  name: perfMetricName,
  metric: z.string().min(1),
  threshold: z.number().positive(),
  unit: z.string().min(1),
  rationale: z.string().min(1),
}).strict();

export const performanceSchema = z.array(performanceThresholdSchema).min(1);

// componentSchema gains: performance: performanceSchema.optional()
```

Implementation side — none. Performance thresholds are canonical capacity advice; per-implementation deltas (Radix's actual virtualisation strategy, Headless UI's debounce default) are divergence-row territory referencing `performance[*].threshold`.

## Phase 1 implication

Three components migrate: Combobox (virtualisedListbox + asyncFilterDebounce), Tabs (tablistOverflow + lazyPanelRender), Modal (stackDepth). Card and Button stay unmigrated — neither has canonical performance thresholds worth surfacing.

The render component (`PerformanceSection.astro`) lands in Dev view (after FormIntegration, before Accessibility) and Bridge view (after FormIntegration, before I18n). Designer view stays unchanged.

The MCP tool surface gains `get_performance` once a future Phase-2 batch lands tools for all post-P4-24 fields.

## Consequences

**Positive:**

- Capacity-planning thresholds become queryable structured data instead of prose buried in `mistakes`. Future tooling (build-time linters, CI checks) can read `combobox.performance[name=virtualisedListbox].threshold` to validate that an implementation has virtualisation enabled when the listbox will exceed 200 items in production.
- Bridge view captures the cross-team translation: designer's "≤7 panels" UX rule and developer's `tablistOverflow: 7 tabs` implementation threshold are now visibly the same concept.
- Phase-2 implementation audits can record per-library deltas as divergence rows pointing at `performance[*]` paths (e.g. "Headless UI ships built-in virtualisation at 100 items; canonical threshold is 200").
- Closes the P2 content-section bucket. Phase 1 schema is now structurally complete: every field reserved by ADRs 006–018 has shipped.

**Negative:**

- Authoring overhead per migrant (~5–10 lines per threshold, 1–2 thresholds per component). Mitigated by the small migrant set (3 of 5) and the high signal — the prose was previously implicit and re-derived per implementation review.
- The threshold model is single-point-numeric. Range thresholds and conditional thresholds ("if X then threshold = Y else Z") are not supported. Mitigated: extend the shape in a follow-up ADR if a real component needs it.

**Neutral:**

- A future "threshold-driven CI lint" (read each component's performance entries and run them against actual implementation code) is a logical follow-up. Out of scope for P2-16.
- A future `metricCategory` field (capacity / latency / bandwidth / cognitive) for grouping thresholds may emerge if the threshold count grows large. File when more than ~5 thresholds per component become common.

## Alternatives considered

**Embed in `axes.properties`** (per backlog text): rejected. Properties are parameterised values consumers set; thresholds are runtime advice consumers read. Different concerns.

**Embed in `mistakes`**: rejected. Couples thresholds to a specific failure narrative; the threshold is a separable structured fact.

**`unit` as closed enum**: rejected. Vocabulary is open and component-specific; free string with review-enforced consistency is right.

**`threshold` as range `{ min, max }`**: rejected. Phase-1 thresholds are single-point. Extend if a real component needs it.

**`threshold` as expression string** (`"≥200"`): rejected. Loses numeric type for tooling and queries. The metric description handles directionality.

**Render in Designer view**: rejected. Performance thresholds are dev capacity-planning; the UX rule derived from a threshold lives in `whenToUse.avoid`. Avoid duplicating.

**Combine `name` and `metric` into one field**: rejected. `name` is the lookup key (stable, camelCase); `metric` is human-readable describing what is measured. Both earn their keep.
