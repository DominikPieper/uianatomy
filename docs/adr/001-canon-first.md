# ADR 001: Canon First, Implementations Later

**Status:** Accepted
**Date:** 2026-04

## Context

UI Anatomy could plausibly be built in two ways:

1. **Implementation-led:** start with Dominik Pieper's existing component library (Atelier UI) and document its anatomy, then generalize from there to a canonical reference
2. **Canon-led:** research and write the canonical anatomy of each component without reference to any specific implementation; specific implementations (including Atelier UI) are then audited against the canon as a separate workflow

Each approach has trade-offs.

## Decision

Build canon-first. The canonical reference is researched and written without reference to Atelier UI or any other specific implementation. Implementation audits happen as a separate, later phase.

## Rationale

The canon-first approach is methodologically cleaner because it protects against a subtle bias: when the canonical reference and a specific implementation are written in parallel, they influence each other. The author *wants* them to align. This subtly distorts the canon to match the implementation, even when the author is consciously trying to keep them separate.

A canonical reference that has been shaped by one implementation has reduced value as an audit tool for that same implementation. It will rationalize the implementation's choices rather than challenge them.

By writing the canon first, in isolation from Atelier UI, the canon becomes *unbestechlich* — a fair benchmark against which Atelier (and other implementations) can be honestly evaluated. When Atelier diverges from the canon, the divergence is meaningful: either Atelier has a justified reason (which gets documented) or Atelier has an unjustified weakness (which becomes a backlog item).

This also positions the site more strongly. It is not "Atelier UI's documentation that happens to be public" but "a canonical UI pattern reference whose first audited implementation will be Atelier UI." The former has narrow audience; the latter has industry-wide audience.

## Consequences

**Positive:**

- The canonical reference is genuinely role-neutral and library-neutral
- Future audits of Atelier UI will produce honest findings, including possible improvements to Atelier
- The site's value extends beyond Atelier users — anyone working with components benefits
- Adding additional reference implementations later (Radix, React Aria, etc.) is structurally easy because no implementation is privileged in the canon

**Negative:**

- More upfront work to research canonical anatomy without "borrowing" from Atelier
- Delayed gratification — Atelier doesn't appear on the site for some time
- Potential for canon to recommend things Atelier currently does differently, requiring honest documentation of that gap

**Neutral:**

- Implementation audits become a separate workstream with its own cadence

## Implementation

- `content/components/*.yaml` contains only canonical anatomy
- No reference to Atelier (or any other library) in canonical files
- Implementation audits live in a separate location (proposed: `audits/atelier/` or a separate sibling repository) with files keyed by canonical component ID
- The site's Phase 2 includes the Atelier audit as an explicit deliverable

## Alternatives considered

**Atelier-first, generalize later:** rejected for the bias reasons above.

**Both in parallel with strict file separation:** considered, but the bias risk is in the *author's mind*, not in the file structure. Strict file separation doesn't prevent the canon from being subconsciously shaped by what the author wants Atelier to look like.
