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

## `axes`

The three-way distinction between variants, properties, and states.

```yaml
axes:
  variants:
    - elevated
    - outlined
    - flat
  properties:
    - { name: interactive, type: boolean }
    - { name: orientation, type: 'vertical | horizontal' }
  states:
    interactive: [hover, focus-visible, active, disabled]
    data: [selected, loading]
```

**Test for variant vs. property:**

- Variant = "a structurally different version of this component"
- Property = "this component, parameterized"

If you can describe two things as "Card-elevated" and "Card-outlined," they're variants. If you can describe two things as "this Card with media on the left" and "this Card with media on top," that's a property (orientation).

**Test for interactive vs. data state:**

- Interactive state = browser/user-driven (hover, focus, active, disabled)
- Data state = app-driven (selected, loading, error, busy)

The distinction matters because they're handled differently in code (CSS pseudo-classes vs. attribute-driven styling) and shouldn't be modeled as Figma variants (a common mistake — leads to variant explosion).

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

## Schema evolution

The schema will evolve. When it does:

1. Update `shared/schema.ts` (Zod definition)
2. Update this document
3. Update all existing YAML files to conform (Zod validation will catch missing fields)
4. Add a changelog entry

Adding optional fields is non-breaking. Adding required fields requires migration. Renaming fields requires migration plus alias support during transition.
