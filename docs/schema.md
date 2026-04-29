# Component Schema

The canonical structure for every component file in `content/components/*.yaml`.

This document explains the *why* behind the schema. The actual Zod schema lives in `shared/schema.ts` and is the runtime source of truth.

## Top-level structure

```yaml
id: card                    # URL slug, kebab-case
name: Card                  # Human-readable name
description: Container for a coherent unit of content...
related: [list-item, tile]  # IDs of conceptually adjacent components

anatomy: [...]              # Slot/region definitions
axes: {...}                 # Variants, properties, states
mismatches: [...]           # Figma↔Code translation issues
mistakes: [...]             # Common implementation errors
frameworkMap: {...}         # Cross-framework expression
motion: {...}               # Optional. Durations, easing, reduced-motion fallback
responsive: {...}           # Optional. Behaviour changes at viewport breakpoints
```

## `anatomy`

The list of slots/regions the component is composed of. Each entry:

```yaml
- id: media
  required: false
  purpose: Visual representation, typically full-bleed
  layout: { row: 1, span: 'full', aspect: '16:9' }  # for SVG generation
  figma:
    type: frame
    hint: Aspect-ratio-locked frame
  code:
    slot: media
    semantic: img-or-video
  a11y:
    hint: Alt text required, alt="" for decorative
```

**Why slots are documented per-domain (figma/code/a11y):** the same conceptual slot has different concerns in each domain. Designers care about the frame structure, developers care about the slot mechanism, and accessibility cares about semantic role. Splitting the concerns lets us render the appropriate detail per view.

**Why `layout` is structured data, not a freehand SVG:** so the anatomy diagram can be auto-generated from the YAML. Drift between data and diagram becomes impossible.

**Why `required` matters:** drives how the slot is rendered in the diagram (solid vs. dashed outline) and informs the implementation (slot-conditional vs. always-rendered container).

### `tokens` (optional, per slot)

Each anatomy slot may declare semantic token *names* — never values — across five fixed categories. Concrete values live in `implementations/<lib>/<id>.yaml` via `tokenBindings` (Phase 2). The full rationale is in [ADR-006](./adr/006-token-layer.md).

```yaml
- id: title
  required: true
  purpose: ...
  layout: { row: 3, col: 1, span: full }
  figma: { type: text, hint: '...' }
  code: { slot: title, semantic: heading-or-link }
  a11y: { hint: '...' }
  tokens:                                # optional
    spacing:
      blockPadding: spacing.tight
    typography:
      size: text.lg
      weight: weight.semibold
      lineHeight: leading.tight
    color:
      foreground: color.text.primary
```

**Shape rules:**

- The `tokens` field, every category inside it, and every property inside a category are all optional.
- Categories are exactly: `spacing`, `radius`, `color`, `elevation`, `typography`. The schema rejects unknown category names.
- Each category is a map from a *property key* (the slot-side concern, e.g. `padding`, `corner`, `foreground`) to a *canonical token name* (the semantic, e.g. `spacing.compact`).
- Token names follow dotted lower-kebab notation (`category.scaleStep` or `category.facet.scaleStep`). The schema enforces the regex `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/` — any name that fails this is a build error.
- Tokens describe the *default* variant of the slot (e.g. `primary` for Button, `elevated` for Card). Variant-specific overrides belong to implementations, not the canon.

**Legal token-name vocabulary:**

| Category | Legal names |
|---|---|
| `spacing` | `spacing.tight`, `spacing.compact`, `spacing.cozy`, `spacing.comfortable`, `spacing.loose` |
| `radius` | `radius.none`, `radius.sm`, `radius.md`, `radius.lg`, `radius.pill`, `radius.full` |
| `color` | `color.surface.bg`, `color.surface.raised`, `color.surface.sunken`, `color.surface.scrim`, `color.text.primary`, `color.text.muted`, `color.text.inverse`, `color.text.accent`, `color.border.subtle`, `color.border.strong`, `color.border.focus`, `color.accent.bg`, `color.accent.fg` |
| `elevation` | `elevation.none`, `elevation.sm`, `elevation.md`, `elevation.lg`, `elevation.overlay` |
| `typography` | size: `text.xs`, `text.sm`, `text.md`, `text.lg`, `text.xl` · weight: `weight.regular`, `weight.medium`, `weight.semibold`, `weight.bold` · line-height: `leading.tight`, `leading.snug`, `leading.normal`, `leading.relaxed` · tracking: `tracking.normal`, `tracking.wide` |

Adding a name to this set is a schema-doc change. The Zod regex does not enforce membership — out-of-vocabulary names parse, but they will not survive review and do not have a binding contract for Phase 2.

**Conventional property keys** (open-ended; pick the one that reads cleanly for the slot):

- `spacing` → `padding`, `gap`, `inlinePadding`, `blockPadding`, `inset`
- `radius` → `corner`
- `color` → `background`, `foreground`, `border`, `ring`
- `elevation` → `shadow`
- `typography` → `size`, `weight`, `lineHeight`, `tracking`, `case`

## `motion` (optional, top-level)

Components that animate as part of their definition declare a single `motion` block at the top level — parallel to `axes`, `mismatches`, `mistakes`, `frameworkMap`. Motion is **per-component**, not per-slot: durations like `open`, `close`, `indicator` parameterise transitions that span the component as a whole. The full rationale is in [ADR-007](./adr/007-motion-section.md).

```yaml
motion:                                   # optional
  reducedMotionFallback: instant          # instant | reduced | preserved
  durations:                              # required when motion present, non-empty
    open: motion.duration.base
    close: motion.duration.fast
    backdrop: motion.duration.fast
  easing: motion.easing.standard          # single dotted token name
```

**Shape rules:**

- `motion` itself is optional. Components without transition vocabulary (Card, Button) omit the field entirely.
- When present, all three keys (`durations`, `easing`, `reducedMotionFallback`) are required.
- `durations` is an open-ended map from a *duration key* (camelCase, e.g. `open`, `close`, `panelEnter`) to a *canonical token name* (e.g. `motion.duration.base`). It must declare at least one entry.
- `easing` is a single canonical token name, applied to every duration in the component. Per-duration easing overrides are deferred until a real case demands them.
- `reducedMotionFallback` is one of three values: `instant` (jump cut, the safe default for decorative motion), `reduced` (shortened duration, motion shape preserved), `preserved` (motion is essential to comprehension; keep it as authored).
- Token names follow the same dotted lower-kebab regex as ADR-006 tokens — the schema reuses the existing `tokenName` validator.

**Legal motion-token vocabulary:**

| Category | Legal names |
|---|---|
| `motion.duration.*` | `motion.duration.instant`, `motion.duration.fast`, `motion.duration.base`, `motion.duration.slow`, `motion.duration.slower` |
| `motion.easing.*`   | `motion.easing.standard`, `motion.easing.decelerate`, `motion.easing.accelerate`, `motion.easing.sharp` |

The duration scale mirrors Polaris (`motion-duration-{75,100,150,200,300}`) and Material 3 (Short / Medium / Long). The easing names mirror Material 3's Standard / Decelerated / Accelerated / Linear-out-Slow-in vocabulary. As with tokens, the Zod regex enforces shape but not membership — out-of-vocabulary names parse, but they will not survive review and have no Phase-2 binding contract.

**Conventional duration keys** (open-ended; pick the one that names the transition unambiguously):

- Modal-like surfaces → `open`, `close`, `backdrop`
- Combobox-like surfaces → `open`, `close`, `filter`
- Tab-like indicators → `indicator`
- Panel-swap surfaces → `panelEnter`, `panelExit`
- Tag/chip surfaces → `chipEnter`, `chipExit`

## `responsive` (optional, top-level)

Components that change behaviour, layout, or activation across viewport breakpoints declare a single `responsive` block at the top level. Like `motion`, responsive is **per-component**, not per-slot — breakpoint-driven changes span the component as a whole. The full rationale is in [ADR-008](./adr/008-responsive-section.md).

```yaml
responsive:                                 # optional
  breakpoints:                              # required when responsive present, non-empty
    - at: breakpoint.sm
      change: >-
        At and below, container fills the viewport, backdrop is suppressed,
        size property is ignored.
    - at: breakpoint.md
      change: >-
        Above this width, all variants render as authored.
```

**Shape rules:**

- `responsive` itself is optional. Components without breakpoint-driven behaviour (Button) omit the field entirely.
- When present, `breakpoints` is required and must be a non-empty array.
- Each breakpoint entry has exactly two fields: `at` (a canonical token name) and `change` (a free-text description of what happens around that threshold).
- Direction (above / below / between) is part of the `change` prose, not a separate schema field. The `at` token is the *threshold*; the prose says which side of the threshold the change applies to.
- Token names follow the same dotted lower-kebab regex as ADR-006 tokens — the schema reuses the existing `tokenName` validator.
- Order of entries is meaningful: write narrow-to-wide so the array reads top-to-bottom in the same direction as a viewport widening.

**Legal breakpoint vocabulary:**

| Category | Legal names |
|---|---|
| `breakpoint.*` | `breakpoint.xs`, `breakpoint.sm`, `breakpoint.md`, `breakpoint.lg`, `breakpoint.xl` |

The five-step scale mirrors Tailwind, Bootstrap, and Polaris. As with motion and tokens, the Zod regex enforces shape but not membership — out-of-vocabulary names parse, but will not survive review and have no Phase-2 binding contract.

**Conventional change-prose openings** (open-ended; pick the one that names the threshold side clearly):

- "At and below, …" — applies to the breakpoint and narrower viewports
- "At and above, …" — applies to the breakpoint and wider viewports
- "Above this width, …" — applies strictly wider than the breakpoint
- "Below this width, …" — applies strictly narrower than the breakpoint
- "Between sm and lg, …" — applies to a band; declare two adjacent entries to express it

## `whenToUse` (optional, top-level)

A structured "should I use this?" entry. Replaces the old bare `related: [slug, …]` field with a richer surface that names *use* and *avoid* prose plus per-related differentiators. The full rationale is in [ADR-012](./adr/012-when-to-use-section.md).

```yaml
whenToUse:                                  # optional
  use: >-                                   # required prose
    When the user must focus on a single decision or input that blocks
    the underlying flow.
  avoid: >-                                 # required prose
    For non-blocking notifications — that is `Toast`. For contextual
    content tied to a trigger — that is `Popover`.
  vsRelated:                                # optional, non-empty when present
    - id: drawer                            # slug of the related component
      difference: >-
        `Drawer` slides from a viewport edge and may be modal or
        non-modal; `Modal` always centres and is always modal.
    - id: popover
      difference: >-
        `Popover` is non-modal, anchored to a trigger, and dismissable
        by outside-click without ceremony.
```

**Shape rules:**

- `whenToUse` itself is optional. Components without a meaningful "use vs. avoid" distinction omit the field.
- When present, `use` and `avoid` are required prose, both non-empty.
- `vsRelated` is optional. When present, it is a non-empty array of `{ id, difference }` records. Each `id` follows the kebab-case slug regex (matches a canonical component id, even if that component is not yet documented).
- `difference` prose names the *distinguishing characteristic* between this component and the related one — not a description of the related component itself.
- The bare `related: [slug]` field is gone. Where you previously wrote `related: [tile, list-item]`, you now write `whenToUse.vsRelated[].id` paired with a `difference`. Templates render the chips from the structured form.

**Why dropped, not coexisting:** ADR-001's "single source of truth" plus ADR-012's "decisions need rationale" both point to a single structured entry. Two ways to spell the same data is the failure mode the schema is meant to prevent.

## `events` (optional, top-level)

Components that expose callback or event vocabulary worth recording cross-framework declare a single `events` block at the top level — parallel to `motion`, `responsive`, `axes`, `mismatches`, `mistakes`, `frameworkMap`. Like motion and responsive, events are **per-component**: the `selectedChange` event on Tabs is component-level, not slot-level. The full rationale is in [ADR-011](./adr/011-events-section.md).

```yaml
events:                                            # optional
  - name: selectedChange                           # camelCase identifier
    payload: >-                                    # free-text prose
      The id of the newly selected tab — always a string matching one of
      the rendered tab ids; never empty.
    frameworkNotes:                                # all four required
      webComponents: >-
        `change` CustomEvent on the host with `event.detail = { selectedId }`.
      react: >-
        `onValueChange(value: string)` (Radix) or `onSelectionChange(key)`
        (React Aria).
      angularSignals: >-
        `output<string>('selectedChange')`; pair with `[(selected)]`.
      vue: >-
        `@update:modelValue` for `v-model` on the selected id.
```

**Shape rules:**

- `events` itself is optional. Components without first-class event vocabulary (Card, Button) omit the field entirely.
- When present, `events` is a non-empty array. Each entry has exactly three required fields: `name`, `payload`, `frameworkNotes`.
- `name` is a camelCase identifier (`/^[a-z][a-zA-Z0-9]*$/`). Mirrors the conventional event-name shape across frameworks (`onChange`, `update:modelValue` strip both reduce to the same canonical name).
- `payload` is free-text prose describing what the consumer receives — the value, the shape of a structured payload, or "No payload" for void events. Carries the meaning callers need to wire correctly.
- `frameworkNotes` mirrors the `frameworkMap` shape: all four framework keys (`webComponents`, `react`, `angularSignals`, `vue`) are required, each free-text. Captures the per-framework idiom for the same canonical event.

**Conventional event names** (open-ended; pick the form that names the change unambiguously):

- State change with new value: `selectedChange`, `openChange`, `valueChange`, `inputChange`
- Lifecycle: `dismiss`, `commit`, `cancel`, `clear`
- User intent (manual activation): `tabActivate`, `select`, `confirm`
- Error or rejection: `invalid`, `submitError`

`frameworkNotes` is reference data, not a binding contract. Phase-2 implementations (`implementations/<lib>/<id>.yaml`) record the actual handler signatures via a future `eventBindings` field. The canonical notes describe what is *idiomatic*, not what is shipped in any specific library version.

## `a11yAcceptance` (optional, top-level)

Per-component accessibility acceptance criteria. Three independently optional sub-arrays — `keyboardWalk`, `announcements`, `axeRules` — at least one required when the field is present. The full rationale is in [ADR-014](./adr/014-a11y-acceptance.md).

```yaml
a11yAcceptance:                       # optional
  keyboardWalk:                       # optional, min 1 when present
    - keys: Tab
      expected: Focus moves to the next focusable inside the dialog.
    - keys: Shift+Tab
      expected: Focus moves to the previous focusable inside the dialog.
  announcements:                      # optional, min 1 when present
    - trigger: Dialog opens
      expected: SR announces the title via `aria-labelledby`, then "dialog".
  axeRules:                           # optional, min 1 when present
    - aria-dialog-name
    - aria-modal-misuse
    - color-contrast
```

**Shape rules:**

- `a11yAcceptance` itself is optional. Components without testable canonical a11y vocabulary omit the field.
- When present, at least one of `keyboardWalk`, `announcements`, `axeRules` must be declared (Zod refine).
- Each sub-array is non-empty when present.
- `keyboardWalk` entries are `{ keys, expected }` — both prose. `keys` is the key combo or compound condition (`'ArrowLeft / ArrowRight (horizontal)'`). `expected` is the prose acceptance criterion.
- `announcements` entries are `{ trigger, expected }`. `trigger` names what causes the announcement; `expected` describes what assistive tech should say.
- `axeRules` is a flat array of axe-core rule ids in kebab-case (regex `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`). Membership is not validated against axe-core; CI catches invalid ids when `axe.run()` rejects them.

**YAML gotcha:** colons inside prose values (e.g. `` `dismissible: true` ``) require single-quoting the surrounding string, or rephrasing to drop the colon. The YAML parser otherwise interprets the colon as a mapping separator and fails the file at the indentation check.

**Render:** `A11yAcceptanceTable.astro` renders in Dev view and Bridge view after the per-slot `A11yTable`. Designer view is intentionally not changed; per-slot `a11y.hint` continues to cover designer needs.

## `axes`

The three-way distinction between variants, properties, and states.

```yaml
axes:
  variants:
    - elevated
    - outlined
    - flat
  properties:
    - { name: interactive, kind: primitive, of: boolean }
    - name: orientation
      kind: enum
      values: [vertical, horizontal]
  states:
    interactive: [hover, focus-visible, active, disabled]
    data: [selected, loading]
```

### `properties[].type`

A property's type is a discriminated union with two arms, distinguished by a `kind` field. The full rationale is in [ADR-010](./adr/010-property-type-union.md).

- **`kind: primitive`** — `of: boolean` is currently the only allowed primitive. Widen the `of` enum in a follow-up ADR if a real property needs `string` or `number`.
- **`kind: enum`** — `values: [...]`, at least two unique non-empty strings. The canonical render joins the values with ` | ` for display, so `values: [sm, md, lg]` reads as `sm | md | lg` in the properties table.

```yaml
properties:
  - { name: iconOnly, kind: primitive, of: boolean }
  - name: size
    kind: enum
    values: [sm, md, lg]
```

This shape replaces the previous free-form `type: string` (e.g., `type: 'sm | md | lg'`). Authors no longer escape pipe characters inside YAML strings, and Zod validates that enum values are unique, non-empty, and at least two in number.

**Test for variant vs. property:**

- Variant = "a structurally different version of this component"
- Property = "this component, parameterized"

If you can describe two things as "Card-elevated" and "Card-outlined," they're variants. If you can describe two things as "this Card with media on the left" and "this Card with media on top," that's a property (orientation).

**Test for interactive vs. data state:**

- Interactive state = browser/user-driven (hover, focus, active, disabled)
- Data state = app-driven (selected, loading, error, busy)

The distinction matters because they're handled differently in code (CSS pseudo-classes vs. attribute-driven styling) and shouldn't be modeled as Figma variants (a common mistake — leads to variant explosion).

### `transitions` (optional, nested under `axes.states`)

Components with a non-trivial state graph declare transitions explicitly. Each entry is `{ from, to, trigger }`. The full rationale is in [ADR-009](./adr/009-state-transitions.md).

```yaml
axes:
  states:
    interactive: [focus-visible]
    data: [opening, open, closing, closed]
    transitions:                              # optional
      - from: closed
        to: opening
        trigger: User activates the trigger that owns the dialog.
      - from: open
        to: closing
        trigger: Escape, close button, dismissible backdrop click, or programmatic close.
```

**Shape rules:**

- `transitions` is optional. Components with trivial graphs (Card's independent `selected`/`loading`, Button's lone `loading`) omit the field.
- Each entry has exactly three required fields: `from`, `to`, `trigger`.
- `from` and `to` must be a name declared in `axes.states.interactive` or `axes.states.data`. The schema validates this with a cross-field refine; a typo or stale reference is a parse error with the path `axes.states.transitions[i].from`.
- `trigger` is free-text prose describing what causes the transition. Compound triggers (multiple alternative causes for the same edge) are written as disjunctive prose ("Escape, close button, or backdrop click") rather than split into multiple entries.
- Order of entries is meaningful: write the dominant happy path first, exceptional paths after. Renderers preserve declaration order.

**Conventional trigger forms** (open-ended; pick the form that names the cause unambiguously):

- User input: "User presses Escape", "User clicks the close button", "User types a printable character"
- Async events: "Async filter results return successfully", "Network request fails with a non-retriable error"
- Animation lifecycle: "The enter animation completes (or immediately under reduced motion)"
- Programmatic: "Application calls `dialog.close()`", "Form submission resolves"
- Validation: "Strict mode and the input blurs with no matching option"

## `mismatches`

The bridge between figma and code worlds. Documents typical translation problems specific to this component.

```yaml
mismatches:
  - figma: Variants for hover/focus
    code: CSS pseudo-classes
    consequence: Figma variant explosion (24 variants instead of 3)
    correct: Treat hover/focus as state spec, not as component variant
```

This is the highest-value section for designer-developer collaboration. Most other reference sites document one side or the other; the mismatches are where teams actually struggle.

## `mistakes`

Common implementation errors with corrections.

```yaml
mistakes:
  - id: card-as-link-nested-buttons
    title: Card-as-link with nested buttons
    description: Wrapping the entire card in <a> breaks keyboard access...
    fix: Use pseudo-element overlay pattern...
```

Each mistake has a stable `id` so it can be referenced from other components or external links.

## `frameworkMap`

How canonical concepts express in major frameworks.

```yaml
frameworkMap:
  webComponents:
    structureMechanism: 'named slots'
    variantMechanism: 'attributes'
  react:
    structureMechanism: 'compound components'
    variantMechanism: 'props + class-variance-authority'
  angularSignals:
    structureMechanism: 'ng-content with select'
    variantMechanism: "input<'elevated' | 'outlined'>()"
  vue:
    structureMechanism: 'named slots'
    variantMechanism: 'props'
```

This is descriptive, not prescriptive. We document what's idiomatic, not what's "best."

## Optional fields

- `description` — one-paragraph summary
- `notes` — author's editorial notes that don't fit elsewhere
- `lastReviewed` — ISO date of last full review
- `sources` — list of URLs consulted during research (not displayed to users; useful for re-review)

## What's deliberately not in the schema

- **Code snippets longer than ~10 lines.** If you need full implementation code, reference an external repository. The schema captures *anatomy and structure*, not implementations.
- **Visual mockups beyond the generated wireframe SVG.** Real-world screenshots are better served by [component.gallery](https://component.gallery).
- **Library-specific behavior tables.** A separate `implementations/` directory (see ADR-004) holds these, keyed by component ID.

## Phase-2 implementation schema (`implementations/<lib>/<id>.yaml`)

Phase-2 audits live in `implementations/<lib>/<id>.yaml`. Each file records how a specific library implements a canonical component. The schema (`implementationSchema` in `shared/src/schema.ts`) is a small metadata record plus a structured `divergence` array. The full rationale is in [ADR-013](./adr/013-implementation-schema.md).

```yaml
componentId: modal                # references content/components/<id>.yaml
libraryId: radix                  # matches the parent directory name
componentName: Dialog             # the actual name in the implementation
exampleCode: |                    # optional multi-line code sample
  import * as Dialog from '@radix-ui/react-dialog';
  ...
divergence:                       # optional, non-empty when present
  - from: anatomy[backdrop]
    type: renamed                 # omitted | renamed | extended | reshaped
    to: Dialog.Overlay
    rationale: Same role; Radix uses "Overlay" terminology.
rationale: |                      # optional free-text overall summary
  Radix Dialog is a low-level unstyled primitive ...
lastReviewed: 2026-04-29          # required ISO date
```

**Divergence types (discriminated by `type`):**

- **`omitted`** — `{ from, type, rationale }`. The canonical thing is not present in this implementation.
- **`renamed`** — `{ from, type, to, rationale }`. Same role under a different name.
- **`extended`** — `{ from, type, addition, rationale }`. Canonical thing plus an implementation-specific addition.
- **`reshaped`** — `{ from, type, to, rationale }`. Canonical thing realised through a structurally different form.

`from` is a dotted-path reference into the canonical schema, with optional `[index]` suffix for array entries: `anatomy[backdrop]`, `axes.variants[fullscreen]`, `axes.properties[size]`, `events[openChange]`, `motion.durations`, `axes.states.transitions`. The regex enforces shape (`identifier(.identifier|[index])+`) but does not validate that the path resolves against the canonical schema; that cross-validation is a future refine.

**Bindings (deferred):** `tokenBindings`, `motionBindings`, `transitionBindings`, `eventBindings` are reserved by ADRs 006/007/009/011 as Phase-2 follow-ups. Each lands in its own ADR (ADR-014+) when a real audit needs it. P5-26 ships divergence-first MVP only.

**Loader:** `loadImplementations({ implementationsDir })` returns `Map<libraryId, Map<componentId, Implementation>>`. The loader enforces `libraryId === parentDirectoryName` and rejects duplicate componentIds within a library.

## Schema evolution

The schema will evolve. When it does:

1. Update `shared/schema.ts` (Zod definition)
2. Update this document
3. Update all existing YAML files to conform (Zod validation will catch missing fields)
4. Add a changelog entry

Adding optional fields is non-breaking. Adding required fields requires migration. Renaming fields requires migration plus alias support during transition.
