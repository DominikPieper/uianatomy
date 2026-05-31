# ADR 030: Sub-anatomy — referenced canonical slot patterns

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** none (additive)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-004](./004-data-separation.md) (data separation), [ADR-013](./013-implementation-schema.md) (divergence pattern reused), [ADR-020](./020-slot-kind.md) (slot kind)

> **2026-05-31 amendment (P6-165).** This ADR is also the home of the
> **[sub-anatomy registry](#sub-anatomy-registry)** — the canonical index of every
> sub-anatomy. The original convention (each new sub-anatomy gets its own ADR)
> produced one ADR per *application* of this mechanism (ADR-032 close-button,
> ADR-033 header-bar, ADR-034 icon-leading-text), which read as process overhead
> rather than architectural decisions. New convention: **a new sub-anatomy is a
> registry row below, not a new ADR.** ADRs 032–034 are folded in (status changed,
> bodies kept as detailed historical rationale). Mint a new ADR only when the
> sub-anatomy *mechanism itself* changes (e.g. an `extended` override arm).

## Context

Five components in `content/components/` re-declare a button-group slot with near-identical structure but inconsistent slot-ids and partial divergence on accessibility rules:

| Component | Slot id      | Nesting              | `slotKind`    | `code.semantic` | Multiplicity |
|-----------|--------------|----------------------|---------------|-----------------|--------------|
| `card`    | `actions`    | top-level            | `structural`  | `button-group`  | 1 group      |
| `alert`   | `actions`    | top-level            | `structural`  | `button-group`  | 1–2 buttons  |
| `modal`   | `footer`     | nested under `container` | `structural` | `button-group` | 1 (wrapper)  |
| `drawer`  | `footer`     | nested under `container` | `structural` | `button-group` | 1 (wrapper)  |
| `toast`   | `action`     | top-level            | `interactive` | `button`        | ≤1 button    |

Drift risk is real today:

- **Card** documents the RTL action-order rule in `i18n.rtl` (component-level prose).
- **Alert** documents primary-first DOM order in the slot's `a11y.hint`.
- **Modal/Drawer** document focus-target-on-destructive in the `footer` `a11y.hint`.
- **Card/Alert** do not encode any focus-on-destructive rule.

Four of these slots represent the same canonical pattern — a horizontal cluster of one-to-three buttons that commit, dismiss, or defer a decision — but the canon currently expresses it four times. ADR-001 (canon-first) calls for a single source of truth.

The 2026-05-03 audit-batch B flagged this:

> `actions` button-group recurs identically on Card, Alert, Toast, Modal, Drawer. Define canonical sub-anatomy `action-group` and reference via `$ref`-style indirection.

Three questions surface:

1. Where does the canonical pattern live (TypeScript constant vs YAML file)?
2. How are call-site differences expressed without reverting to copy-paste?
3. Do consumers (render, MCP, SVG, tests) need to know about the indirection?

## Decision

**Introduce a sub-anatomy mechanism** with four parts:

1. **`subAnatomySchema`** in `shared/src/schema.ts` — defines the canonical pattern (id, name, description, slots, optional group/focus a11y rules, lastReviewed).
2. **`anatomySlotRefSchema`** in `shared/src/schema.ts` — what a component YAML writes at the call site: `{ $ref, parent?, row?, overrides? }`. `componentSchema.anatomy` becomes a `z.union([anatomySlotSchema, anatomySlotRefSchema])` array.
3. **`resolveAnatomyRefs()`** in `shared/src/loader.ts` — eager post-parse resolution. Sub-anatomy slots are flattened into `component.anatomy` with provenance preserved as a non-enumerable `__subAnatomy: { id, slot }` property on each resolved slot.
4. **`content/sub-anatomies/<id>.yaml`** — sub-anatomy bodies live as YAML files alongside `content/components/` and `content/patterns/`. The directory listing is the registry; no separate registry constant in `vocabulary.ts`.

**Override mechanism** — discriminated union mirroring `divergenceSchema` (ADR-013):

```ts
subAnatomyOverrideSchema = z.discriminatedUnion('type', [
  // omitted: drop the named slot from the resolved anatomy
  { slot, type: 'omitted',    rationale },
  // renamed: change the slot's id; sibling layout.parent refs follow
  { slot, type: 'renamed',    to, rationale },
  // overridden: shallow-merge top-level fields, deep-merge tokens/layout
  { slot, type: 'overridden', rationale, /* partial slot fields */ },
]);
```

`extended` (call-site adds a slot to the canonical pattern) is **deliberately omitted**. Call-site cannot extend the canonical pattern, only specialize it. If extended-need surfaces in real authoring, it becomes an additive future change.

**First sub-anatomy:** `action-group` with three slots (`primary-action`, `secondary-action`, `tertiary-action`). Default a11y rules cover canonical button order (primary first in DOM, inline-end visually with logical-property RTL mirroring) and default focus target (primary-action; destructive operations override to secondary-action).

**Migration scope:**

- **Card** — replace inline `actions` with `$ref: action-group`. Card's RTL action-order rule stays in `i18n.rtl` (component-level concern, not slot-level). Override: `tertiary-action` omitted (Card capped at 2 actions).
- **Alert** — replace inline `actions` with `$ref: action-group`. Override: `tertiary-action` omitted; `primary-action` layout overridden (label is typically Retry/Undo).
- **Modal** — keep `footer` slot as-is (carries container-level a11y, padding, "right-aligned by default" Figma hint). Add a new `$ref: action-group` entry with `parent: footer`. Override: destructive-default-focus rule on `primary-action.a11y.hint`.
- **Drawer** — same treatment as Modal. Override: `tertiary-action` omitted (Drawer capped at 2 actions).
- **Toast** — **excluded.** Toast's `action` slot is a single `interactive` button with `code.semantic: button` (not `button-group`), structurally distinct from the cluster pattern. Forcing it through `action-group` would dilute the abstraction to a 1-button case.

## Rationale

- **Single source of truth.** Four components share one canonical button-group definition. The RTL mirroring rule, primary-first DOM order, and default focus target live once.
- **Eager resolution = zero blast radius.** Loader produces a flat `anatomy: AnatomySlot[]`. SVG renderer (`shared/src/svg.ts`), Astro components (`AnatomyDiagram.astro`, `AnatomyTable.astro`, `CodeSlotTable.astro`, `FigmaSlotTable.astro`), MCP tools (`get_anatomy`, `get_component_view`), and depth/consistency tests all keep iterating a flat array unchanged.
- **Provenance via non-enumerable property.** `__subAnatomy: { id, slot }` is invisible to `JSON.stringify` (so MCP serialization is unchanged), but available to render-side tooling (deferred P6-126b: an "from action-group" badge in `AnatomyTable`).
- **Override pattern reuses `divergenceSchema` (ADR-013).** Authors already know the `omitted / renamed / overridden` discriminator from `implementationSchema`. Explicit `type` forces author intent — no silent merging.
- **YAML storage matches canon-first.** Sub-anatomy bodies are editorial content (purpose prose, a11y rules, token map). TypeScript-as-source would force authors to learn the Zod surface. Filenames are the registry — same convention as components and patterns.
- **No extra registry constant in `vocabulary.ts`.** Adding `KNOWN_SUB_ANATOMIES` would force two-place updates on every new sub-anatomy and contradict canon-first.

### Why a registry-based abstraction now vs lint-only conformance

A lighter alternative — a consistency-test that asserts every `code.semantic === 'button-group'` slot conforms in shape — would prevent drift but not enable referenceability. MCP clients cannot ask "what canonical patterns exist?" through a lint; they need a first-class data structure. The schema cost (~100 LOC + one-time ADR) is paid once; lint cost would recur per pattern.

### Why eager resolution vs lazy

Lazy (consumers expand refs on demand) would force every consumer to learn the union shape. SVG renderer, Astro slot tables, MCP `get_anatomy`, depth-test, consistency-test — all six iterate a flat anatomy today. Eager keeps them ignorant of the indirection.

### Why no `extended` arm

Two reasons. First, the `extended` override on `divergenceSchema` exists because *implementations* legitimately add concepts the canon doesn't have (Radix's `Trigger` slot inside Modal, etc.). Sub-anatomy is canonical-to-canonical reuse — call-sites should specialize, not extend. Second, an extended-heavy ref is structurally equivalent to inline anatomy; the abstraction loses value. If a future component genuinely needs to add a slot to action-group, that component re-inlines or this ADR is amended. Premature extension dilutes the canonical-pattern story.

### Why Toast is excluded

Toast's `action` is `slotKind: interactive` with `code.semantic: button` (singular), not `button-group`. Toast canonically caps at one button — the purpose statement says "multi-action toasts are a redesign signal (use Alert or Modal instead)". Migrating Toast to `action-group` with both `secondary-action` and `tertiary-action` omitted would produce a 1-slot resolved sub-anatomy — semantically misleading. If product later wants 2-button toasts, that's a structural redesign of Toast, not an action-group migration.

### Backlog ADR-number correction

`docs/backlog.md:195` (P6-126 entry) cites "ADR-029". That number is taken by [severity-vocabulary](./029-severity-vocabulary.md). This ADR claims **030**.

## Consequences

**Positive:**
- Four components share one canonical button-group source — drift impossible without an explicit override.
- MCP gains `list_sub_anatomies` + `get_sub_anatomy` tools — agents discover canonical patterns directly.
- `search_components` extended to match referenced sub-anatomy ids — `search_components({ query: "action-group" })` returns Card/Alert/Modal/Drawer.
- Future sub-anatomies (`header-bar`, `close-button`, `icon-leading-text`) become additive — schema and loader machinery are reusable.
- Provenance preserved on every resolved slot for downstream tooling.

**Negative:**
- Loader gains a resolution step (extra cognitive load for first-time readers).
- `componentSchema.anatomy` becomes a union — error messages on malformed YAML are slightly less precise (`z.union` doesn't pick a discriminator arm before reporting).
- Worker bundle pipeline must pre-resolve sub-anatomies at bundle generation so the worker never sees `$ref` (its loader is a stripped-down variant).
- Toast's permanent exclusion creates an asymmetry: four components reference action-group, one declares its own button slot. Documented here as deliberate.

**Migration footprint:**
- `shared/src/schema.ts` gains `subAnatomySchema`, `anatomySlotRefSchema`, `subAnatomyOverrideSchema`, `ResolvedComponent` type. ~80 LOC.
- `shared/src/loader.ts` gains `loadSubAnatomy`, `loadSubAnatomies`, `resolveAnatomyRefs`, `SubAnatomyValidationError`, `SubAnatomyResolutionError`. ~120 LOC.
- `shared/src/vocabulary.ts` extends `CanonicalVocabularies` with `subAnatomies: readonly string[]`. +5 LOC.
- `shared/tests/sub-anatomy.test.ts` — new file, ~150 LOC.
- `content/sub-anatomies/action-group.yaml` — new file.
- `content/components/{card,alert,modal,drawer}.yaml` — migration edits.
- `mcp-server/src/data.ts` + `server.ts` — load sub-anatomies, two new tools, search/vocabulary extensions.
- `docs/schema.md` — section for sub-anatomy.

## Sub-anatomy registry

The canonical index of every sub-anatomy. **A new sub-anatomy is a row here, not a
new ADR** (P6-165). Each body lives at `content/sub-anatomies/<id>.yaml` — that file
plus this row are the source of truth; the per-instance ADRs (032–034) remain only as
detailed historical rationale. Add a row when a new sub-anatomy lands; mint an ADR only
if the sub-anatomy *mechanism* changes.

| id | slots | consumers | rationale (one line) | detail |
|----|-------|-----------|----------------------|--------|
| `action-group` | `primary-action`, `secondary-action`, `tertiary-action` | Card, Alert, Modal, Drawer (footer) | One canonical commit/dismiss/defer button cluster; DOM order + RTL mirroring + destructive-focus live once. | this ADR (Decision) |
| `close-button` | `close-button`, `close-icon`, `close-label` | Modal, Drawer, Popover, Alert, Banner, Toast | Icon-only dismiss affordance; canonical `close` name + `close-label` makes the WCAG 4.1.2 accessible-name dependency structural. | [ADR-032](./032-close-button-sub-anatomy.md) |
| `header-bar` | `header`, `title` | Modal, Drawer, Popover | Top wrapper region grouping a heading and dismiss affordances on overlay surfaces. | [ADR-033](./033-header-bar-sub-anatomy.md) |
| `icon-leading-text` | `icon-leading`, `label`, `icon-trailing` | Button, List-item, Tab, Breadcrumb-item, Badge, Link | Leading/trailing icon around a text label; `aria-hidden` icons + label drives the host's accessible name. `omitted`-override exercised for partial-arity adopters. | [ADR-034](./034-icon-leading-text-sub-anatomy.md) |

## Phase-2 follow-ups

- **P6-126b** — provenance UI badge in `AnatomyTable.astro` ("from action-group" tag on slots resolved from a sub-anatomy ref). Reads `__subAnatomy.id` from each slot. Deferred to keep the data-model PR focused.
- **Future sub-anatomies** — add a row to the [sub-anatomy registry](#sub-anatomy-registry) above (no new ADR). The originally-anticipated `header-bar` / `close-button` / `icon-leading-text` all landed and are now registry rows.

## Alternatives considered

- **Lint-only shape conformance:** rejected — prevents drift but blocks MCP discoverability. ~50 LOC test, no canonical-pattern surface.
- **TypeScript constant in `vocabulary.ts`:** rejected — sub-anatomy bodies are editorial prose; YAML storage matches canon-first ethos.
- **Lazy resolution at consumer side:** rejected — six consumers would need to learn the union shape. Eager keeps the blast radius zero.
- **Include Toast:** rejected — single-button slot is structurally not a group; forcing dilutes the abstraction.
- **Replace Modal/Drawer `footer` outright:** rejected — `footer` carries container-level concerns (padding, "right-aligned by default" Figma hint, focus-target-on-destructive a11y rule) that are not button-concerns. Keeping `footer` as wrapper + adding child `$ref` separates layers cleanly.
- **`extended` arm from day one:** rejected — call-site cannot extend canonical pattern, only specialize. Additive future change if real need surfaces.
