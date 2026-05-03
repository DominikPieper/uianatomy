# ADR 029: Severity vocabulary — canonical set + synonyms

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** none (additive)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-006](./006-token-layer.md) (vocabulary structure), Atelier-feedback v2 P6-118

## Context

Multiple canonical components carry a severity axis on their `variants[]` list — Alert, Banner, Toast, and the newly-added Badge (P6-100). The values diverged at authoring time:

| Component | Severity variants |
|---|---|
| `alert`   | `info / success / warning / error` |
| `banner`  | `info / promotional / warning / error` |
| `toast`   | `info / success / warning / error` |
| `badge`   | `default / success / warning / danger / info` |

`alert` and `toast` agree on the four-tier set. `banner` substitutes `promotional` for `success` — banner-specific marketing variant, not strictly a severity grade. `badge` uses `danger` instead of `error` and adds a non-severity baseline `default`.

The 2026-05-03 audit-batch B flagged the divergence:

> info | success | warning | error is canon. Many DSes (Bootstrap, Atelier-UI) use `danger` instead of `error`. Add `vocabulary.severity` so `search_components("danger")` finds Alert/Toast/Badge.

Two questions surface:

1. Which set is canonical — `error` (Material 3 / Polaris / Carbon convention) or `danger` (Bootstrap / Tailwind / Atelier convention)?
2. How are non-canonical synonyms surfaced for search and authoring without forcing every component to declare `vocabulary.severity` per-instance?

## Decision

**Canonical severity set:** `info | success | warning | error`. Pick `error` over `danger` because:

- Material Design 3, Carbon, Polaris, Atlassian all use `error` as the canonical severity word — the larger DS ecosystem precedent.
- WCAG and APG reference "error" semantics consistently (`role="alert"` for assertive errors, `aria-invalid` for form errors, WCAG 3.3.1 "Error Identification").
- `danger` is a value-laden term (the user is "in danger"); `error` is a system term (the system encountered an error). The latter is more honest about what the variant communicates.

**Synonyms:** Bootstrap / Tailwind / Atelier-UI's `danger` and `destructive` map to canonical `error`. The synonym map lives once in `shared/src/vocabulary.ts`:

```ts
export const CANON_SEVERITY = ['info', 'success', 'warning', 'error'] as const;

export const SEVERITY_SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  error: ['danger', 'destructive', 'critical'],
  warning: ['caution', 'attention'],
  // info / success have no canonical synonyms yet
};
```

Exported via `getCanonicalVocabularies()` so MCP `get_canonical_vocabularies` returns the canonical set + synonym map.

**Component migration:** Badge migrates `danger → error`. Banner keeps `promotional` (documented as a banner-specific exception, not a severity).

**Search behaviour:** `search_components("danger")` resolves through the synonym map to find any component declaring an `error` variant. Implementation lands as a follow-up consistency-test / search-server enhancement (P6-118b); ADR-029 establishes the policy.

## Rationale

- **Single source of truth.** Component variants stay simple string arrays (`['info', 'success', 'warning', 'error']`); the synonym registry lives in one file. No per-component vocabulary block to maintain.
- **Editorial discipline beats schema enforcement.** A consistency-test that flags "any variant matching a severity-pattern must use canonical names or be in the synonym map" requires heuristic detection of severity-themed variants (versus structural variants like `outlined / filled`). That detection is fragile. Better to encode the rule in `canon-component-author` skill + schema doc, and rely on review.
- **Banner's `promotional` is intentional.** Banner is page-level and routinely hosts marketing or product-launch announcements that are neither system-error nor system-success. Forcing `success` would misrepresent the variant. The exception is documented in banner.yaml (and acknowledged in this ADR) without polluting the canonical severity set.
- **`default` on Badge is not severity.** Badge's `default` variant is the no-severity baseline (a count badge with no implied risk). It coexists with the four severities. Keeping `default` plus the four severities in the same `variants[]` array is consistent with how DSes ship Badge.
- **Search-via-synonym is the deliverable.** The user's quoted goal — `search_components("danger")` finds Alert / Toast / Badge — depends on the search server resolving the lookup through `SEVERITY_SYNONYMS`. ADR-029 makes that resolution possible by establishing the canonical-set + synonym-map data; the search-server change itself is P6-118b.

### Why not extend variants to accept synonyms directly

Allowing `variants: ['info', 'success', 'warning', 'danger']` (with `danger` as a recognised synonym for `error`) would let badge keep its current vocabulary. Rejected because: synonyms in different components produce inconsistent surface (`alert.error` vs `badge.danger` vs `toast.error`), and the canonical name should appear in the canon's primary surface (the YAML). Synonyms support search and authoring; they do not replace the canonical name in the variant list.

### Why not extract severity into its own per-component metadata block

The audit-batch suggestion was a `vocabulary.severity: { canonical: [...], synonyms: { ... } }` block per component. Rejected because: every severity-bearing component would duplicate the same canonical list; the synonym map would need to be repeated 4+ times (Alert, Banner, Toast, Badge, future Progress, future Snackbar in pattern-form). Single source of truth in `vocabulary.ts` is cleaner and stays canonical.

## Consequences

**Positive:**
- Badge variants align with Alert / Toast (`error` not `danger`).
- MCP `get_canonical_vocabularies` exposes severity vocabulary + synonyms — agents can resolve "danger" → "error" deterministically.
- Authoring discipline is encoded in one file (the canonical list) plus the `canon-component-author` skill (rejects unknown severity values during YAML-write).
- WCAG / APG / Material / Polaris / Carbon precedent followed.

**Negative:**
- Badge migration is a one-time content edit (rename `danger → error` in variants, propertyMap, mistakes prose, mismatches prose). Schema-affecting; touches one component.
- Bootstrap / Tailwind / Atelier-UI consumers reading the canon find `error` and need to translate to `danger` mentally. The synonym map mitigates the search direction; the variant-name direction is one-way (canonical to alias).

**Migration footprint:**
- `shared/src/vocabulary.ts` gains `CANON_SEVERITY` + `SEVERITY_SYNONYMS` constants and exports them via `getCanonicalVocabularies()`. ~20 LOC.
- `content/components/badge.yaml` renames `danger → error` throughout (variants list, propertyMap notes, anatomy comments, mistakes / mismatches prose). ~5–10 line edits.
- `docs/schema.md` gains a "Severity vocabulary" section under `axes.variants`.
- `.claude/skills/canon-component-author/SKILL.md` adds severity-variant guidance.
- No site-render change in phase-1.

## Phase-2 follow-ups

- **P6-118b** — `search_components` resolves queries through `SEVERITY_SYNONYMS`. Today the search is case-insensitive substring; severity-synonym resolution requires a pre-normalisation pass on the query.
- **P6-118c** — consistency-test that severity-themed variants in `variants[]` use canonical names. Heuristic — needs careful detection of severity-themed-vs-structural variants. Defer until Banner-style exceptions are well-understood.

## Alternatives considered

- **Pick `danger` as canonical** (Bootstrap / Tailwind / Atelier-UI precedent): rejected. WCAG / APG / Material / Polaris / Carbon converge on `error`; the bigger ecosystem wins.
- **Per-component `vocabulary.severity` block**: rejected. Duplicates canonical list across N components; synonym map repeats.
- **Extend variants to accept synonyms inline**: rejected. Surface drift across components defeats the purpose of a canon.
- **Leave divergence as-is, document via vocabularyDrift**: rejected. `vocabularyDrift` is for *external-system naming drift* (Material 3 calls Toast "Snackbar"); intra-canon variant inconsistency belongs in the canonical-decision surface, not in vocabularyDrift.
