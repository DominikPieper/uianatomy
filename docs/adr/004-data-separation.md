# ADR 004: Strict Separation of Canonical Data and Implementation Data

**Status:** Accepted
**Date:** 2026-04

## Context

UI Anatomy needs to support two kinds of content:

1. **Canonical anatomy** — the library-agnostic, role-neutral description of what a component is
2. **Reference implementations** — how specific libraries (initially Atelier UI; possibly Radix, React Aria, Spectrum later) actually implement the canonical anatomy

These two kinds of content have different lifecycles, different audiences, and different authorities. Mixing them in a single data model creates problems:

- The canonical reference becomes shaped by whichever implementation is documented first
- Library-specific information ages faster than canonical information
- Adding a new reference implementation requires schema migration if implementations are first-class fields in the canonical schema
- Removing or deprecating an implementation (e.g., a library becomes unmaintained) shouldn't affect canonical data

## Decision

Canonical data and implementation data live in physically separated locations with separate schemas:

```
content/
  components/                   # CANONICAL — knows nothing about specific libraries
    card.yaml
    modal.yaml
    combobox.yaml
    ...

implementations/                # PER-IMPLEMENTATION — references canonical IDs
  atelier/
    card.yaml
    modal.yaml
    ...
  radix/                        # added later, when relevant
    card.yaml
    ...
```

Canonical files reference implementations only via opaque `relatedImplementations` lists (containing implementation IDs); implementation files reference canonical components via `componentId`.

## Rationale

### Author hygiene

The strict separation enforces that the canonical author cannot subconsciously shape the canon to match a specific implementation. When writing `content/components/card.yaml`, the file structure simply does not have a place to put Atelier-specific information. This is a forcing function — discipline backed by file structure rather than by good intentions.

### Independent evolution

Canonical anatomy changes slowly (when industry conventions shift, e.g., a new APG pattern is published). Implementation data changes faster (library APIs evolve, libraries are deprecated, new libraries appear). Separating them means library churn doesn't pollute the canonical history.

### Easy addition of new implementations

Adding a Radix audit later requires:

1. Create `implementations/radix/`
2. Add YAML files keyed by canonical `componentId`
3. Update site rendering to surface Radix-related implementation data

It does not require any change to canonical data or schemas.

### Easy detachment from any single implementation

If at some future point a particular implementation should no longer be featured (project end-of-life, focus change, etc.), the corresponding `implementations/<name>/` directory can be removed without affecting canonical data.

This is particularly relevant for Atelier UI: while Atelier is currently an active project, the canonical site should retain its standalone value if Atelier's role changes.

## Implementation schema for `implementations/<lib>/<component>.yaml`

```yaml
componentId: card               # references content/components/card.yaml
libraryId: atelier              # matches the parent directory name
componentName: ui-card          # the actual name in the implementation
exampleCode: |
  <ui-card variant="elevated">
    <ui-card-title slot="title">...</ui-card-title>
  </ui-card>
divergence:
  - from: anatomy.eyebrow
    type: omitted               # omitted | renamed | extended | reshaped
    rationale: "Atelier's design language uses [pattern X] for category metadata instead"
  - from: axes.variants
    type: extended
    addition: glass
    rationale: "Glass variant supports the Atelier Mac-native look"
rationale: |
  Free-form prose explaining the implementation's overall approach
lastReviewed: 2026-04-15
```

The `divergence` field is the most important. It documents *every place* an implementation deviates from the canon, with explicit type and rationale. This becomes the audit artifact.

## Consequences

**Positive:**

- Canonical data is genuinely library-neutral and audit-ready
- New implementations can be added incrementally without canonical schema changes
- Implementations can be removed without affecting canonical data
- The site can render "X library follows the canonical anatomy except for these documented divergences" — a high-value comparison view

**Negative:**

- Two schemas to maintain instead of one
- Cross-references between canonical and implementation data require build-time resolution
- More files in the repo (mitigated by clear directory structure)

**Neutral:**

- Some content might naturally span both (e.g., "Atelier introduced a slot the canon should consider adding") — these conversations belong in issues/discussions, not in either dataset

## Phase 1 implication

Phase 1 of the project produces *only canonical data* (`content/components/`). The `implementations/` directory is created but empty.

The Atelier audit (Phase 2) then populates `implementations/atelier/` against the stable canon.

## Alternatives considered

**Implementation as fields within canonical YAML:** rejected. Forces the canon to know about specific implementations; mixes lifecycles; makes new-implementation addition a schema migration.

**Implementation as a separate sibling repo:** considered. Has the advantage of completely decoupled deployment cycles. Rejected for now because it adds operational complexity (two repos, cross-repo references) without clear benefit at this scale. Can be revisited if the site or implementation count grows substantially.

**No implementation data ever, just canon:** rejected because the audit/comparison value is a key part of the project's purpose. Canon-only would reduce the site to "yet another pattern guide" without the differentiating layer.
