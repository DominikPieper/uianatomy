---
date: "2026-05-01"
title: Opt-in versioning metadata
summary: Component-level since + changelog. Per-slot, per-property since + deprecated. Sparse axes.variantDeprecations. New MCP get_changelog tool.
tags: [schema, mcp]
---

The canonical schema gains lightweight versioning metadata so the canon can record additions and retirements honestly instead of through silent edits.

**Component-level fields.** A component may declare `since: <semver>` to record the version it first entered the canon, plus `changelog: Array<{ version, date, summary }>` with unique versions. Both fields are optional and additive.

**Per-slot and per-property deprecation.** `anatomySlotSchema` and both arms of `propertySchema` now accept `since?: <semver>` and `deprecated?: { since, reason, replacement? }`. The deprecation object is `.strict()`; reason is required prose, replacement is optional.

**Sparse variant deprecations.** Variants stay as bare strings (no shape break across the 23-component roster). Deprecation metadata lives in a parallel `axes.variantDeprecations: Array<{ name, since, reason, replacement? }>` with a cross-field refine that validates each `name` against `axes.variants` and rejects duplicates.

**Render.** Deprecation pills (warm-accent, line-through) appear on `AnatomyTable`, `FigmaSlotTable`, `CodeSlotTable`, and `AxesTable`. The component hero shows a `since` pill next to the title. A new view-agnostic `ChangelogSection` renders below the view content when either `since` or `changelog` is set.

**MCP.** New `get_changelog` tool returns `{ since, changelog } | null`. Tool count is now 19. The full ADR is at `docs/adr/023-versioning.md`.
