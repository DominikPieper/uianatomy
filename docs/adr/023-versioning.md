# ADR 023: Optional Versioning Metadata for Canonical Components

**Status:** Accepted
**Date:** 2026-05

## Context

The canon has grown to 23 components, five layered Phase-1 domains (anatomy / axes / mismatches / mistakes / framework-map), six structural Phase-1 add-ons (tokens / motion / responsive / transitions / events / when-to-use), six Phase-2 content sections (property-map / form-integration / i18n / a11y-acceptance / performance / implementations), and two cross-cutting Phase-2 audits (Radix, Headless UI, CDK). With that surface, the canon will eventually retire shapes — a variant that turns out to be a stylistic flourish rather than a structural axis, a slot that gets folded into a sibling, a property whose enum values are reorganised. Today there is no way to record that history; a removal is indistinguishable from "we never had that" because git history isn't an in-canon signal.

P4-23 was deferred at original landing because no concrete deprecation existed — the feature would have shipped as a schema-only stub. The trigger is now the observable fact that the canon stays useful only as long as readers can tell what is current and what was once-current. Without versioning metadata, every retirement either silently breaks consumer expectations (downstream skills, MCP queries, design-system lints that key on canonical names) or forces a major-version bump of the data feed itself, which is much heavier than the change deserves.

## Decision

Three optional, additive fields on the canonical schema:

1. **Component-level `since: semver` + `changelog: ChangelogEntry[]`.** `since` records the version a component first entered the canon. `changelog` is an array of `{ version, date, summary }`, versions unique, prose summary required.
2. **Per-slot / per-property `since?: semver` + `deprecated?: { since, reason, replacement? }`.** Inline on `anatomySlotSchema` and on both `propertyPrimitiveSchema` / `propertyEnumSchema` arms. `deprecation.replacement` is optional prose pointing at the canonical successor.
3. **Sparse `axes.variantDeprecations: Array<{ name, since, reason, replacement? }>`.** Variants are bare strings today; rather than reshaping `axes.variants` to objects (which would touch every roster YAML and force consumers to re-derive variant names), deprecation metadata is carried in a sparse parallel list. Cross-field refine: each `name` must reference a string in `axes.variants`; duplicates are rejected.

Version format is `MAJOR.MINOR.PATCH`, regex `^\d+\.\d+\.\d+$`. No `v` prefix, no pre-release tags. Dates on changelog entries follow the existing `lastReviewed` ISO-YYYY-MM-DD convention.

The convention "every `since` value should resolve to a `changelog[].version`" is documented in `schema.md` but **not** enforced by Zod. Components can adopt deprecation metadata before backfilling a full changelog; reviewers catch drift, not the validator. Forcing the cross-refine would push a 23-component migration onto the first author who needs `deprecated` for one slot.

A new MCP tool **`get_changelog`** projects `{ since, changelog }` (or `null` if neither is set). Tool count moves 18 → 19. The deprecation flags on slots / properties / variants are surfaced through the existing `get_component`, `get_anatomy`, and `get_axes` tools — no per-flag tool, since consumers want the in-context view, not a separate "what's been deprecated" query.

The site renders deprecations inline:

- `AnatomyTable` / `FigmaSlotTable` / `CodeSlotTable` show a `deprecated v<since>` pill next to the slot id; the slot id text gets `text-decoration: line-through`.
- `AxesTable` shows the same pill on deprecated variant chips and on deprecated property rows.
- Component-level `since` renders as a small monospace pill in the hero next to the title.
- A new view-agnostic `ChangelogSection` renders at the bottom of every component page (after view content, before footer) when either `since` or `changelog` is set.

## Rationale

### Why component-level `since` rather than per-anything `since` only

Many slots and properties share a birth date — the date the component itself entered the canon. Forcing every author to repeat the same `since` on every slot would be noise. Component-level `since` is the default; per-slot `since` is for additions that arrived in a later canon version.

### Why sparse `variantDeprecations` instead of reshaping `variants`

Reshaping `axes.variants: string[]` into `axes.variants: Array<{ name, deprecated? }>` is the symmetric move with `axes.properties`, but it has a high blast radius:

- 23 YAMLs change shape.
- Cross-package consumers (`AxesTable`, MCP `get_axes`, consistency tests, P3-29 broken-links checker, the in-progress P3-38 `/compare` differ) all read `axes.variants` as `string[]`.
- The new shape forces consumers to re-derive `string[]` for every chip-rendering call.

The sparse list keeps the existing shape, mirrors the pattern used for `motion`, `responsive`, `events`, `formIntegration` (top-level optional siblings rather than per-thing inline metadata), and stays trivial to ignore for consumers that don't care about deprecations. Validation remains tight via the cross-field refine.

### Why prose `reason` rather than a closed enum

Deprecation reasons split unevenly: "merged into X", "renamed", "covered by token", "scope creep, removed", "replaced by a different component entirely". A closed enum would be either too coarse (every reason becomes "removed") or too long (every new reason needs a schema PR). Prose is searchable in MCP responses and reads naturally on the rendered page; the optional `replacement` field carries the structured pointer when one exists.

### Why no `until` / `removed-in` field

A removal is a content edit, not a schema fact. When a slot is deleted, the YAML loses the entry and the changelog gains a summary line. Tracking "this slot will be removed in v3.0" inside the slot would tempt authors to leave deprecated entries in the canon as half-removed ghosts. The deprecation pill is the warning signal; the changelog entry is the obituary.

### Why version cross-refine is *only* on `variantDeprecations`

`variantDeprecations[].name` must reference an existing `axes.variants` entry, otherwise the deprecation badge has nothing to attach to and the YAML is inconsistent. That refine is cheap and prevents a class of typos.

The `since` ↔ `changelog` cross-refine is more aspirational than load-bearing. Components can land deprecation metadata for one slot while the broader changelog is still being written; enforcing the link would force a chicken-and-egg migration. The convention is documented in `schema.md` and reviewers enforce it.

### Why surface in hero rather than a dedicated metadata block

The only component-level signal worth promoting is `since`, and the hero already carries the component name and description. A separate metadata strip would compete with the description for the reader's first attention. The pill is small, monospace, accent-cool, and doesn't trigger any layout reflow when present.

## Consequences

- One new optional schema field per axis (slot / property / variant / component) plus one new section type (changelog). Existing roster YAMLs are unchanged at landing; adoption is incremental.
- Tool count 18 → 19 (`get_changelog`). SKILL.md regenerates digest via the existing prebuild.
- The site picks up a new view-agnostic section, but only when a component declares either `since` or `changelog`. Today no roster YAML does, so the visible footprint is zero and the build cost is just the import.
- Future work: when the first deprecation lands in production, add a `deprecated`-only badge to the index card grid (`/`) so readers can see retirement signals at the roster level. Deferred until at least one component carries the data.
