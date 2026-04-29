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
