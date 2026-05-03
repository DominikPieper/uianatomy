---
name: adr-author
description: Author a new ADR for the uianatomy project under docs/adr/ following the established template (Status / Date / Supersedes / Context / Decision / Rationale / Consequences). Use whenever the user wants to record an architectural decision, deprecate a prior ADR, or document why a proposal was rejected — phrases like "ADR für X", "neue ADR", "decision record", "supersede ADR-NNN", "reject this proposal as ADR", "schreib eine ADR". Picks the next sequential number, links the supersedes target, and sets the status correctly. Prefer this over freehand writing whenever the topic is an architectural choice that shapes the schema, repo layout, MCP tools, or content conventions.
---

# adr-author

Authors a new ADR file in `docs/adr/` matching the project's established convention (ADR-001 through ADR-027 form the precedent corpus).

## When to use

Trigger when the user says any of:

- "schreib eine ADR für …" / "neue ADR für …" / "ADR-author für …"
- "wir brauchen ein decision record für …"
- "supersede ADR-NNN mit …"
- "ADR-NNN als rejected dokumentieren"
- "decision für X als ADR festhalten"

Also trigger proactively whenever a schema change, repo-layout change, MCP-tool-architecture change, or canon-content-convention change is being discussed without a corresponding ADR. ADR-004 mandates that "Adding fields requires updating Zod schema, schema.md, and validation" — non-additive schema changes always need an ADR.

## What it does

1. Picks the next sequential ADR number by reading `docs/adr/` and finding `max(NNN) + 1`.
2. Creates `docs/adr/NNN-kebab-title.md` with the canonical template.
3. Fills in `Status`, `Date`, `Supersedes`, plus all required sections.
4. If the new ADR supersedes an existing one, also opens the superseded ADR and flips its `Status: Accepted` → `Status: Superseded by ADR-NNN`.

## Steps

### 1. Read existing ADRs to determine numbering and conventions

```bash
ls /Users/dominikpieper/Projects/uianatomy/docs/adr/
```

Parse filenames `NNN-kebab-title.md` for the highest `NNN`. New ADR is `NNN+1`, zero-padded to three digits.

### 2. Confirm scope with user before writing

Ask exactly one question if not already obvious from context:

- "Status: **Accepted**, **Proposed**, oder **Rejected**?" (default: Accepted if user is recording a done decision; Proposed if mid-discussion; Rejected if explicitly killed)
- "Supersedes ADR-NNN?" (only ask if not already mentioned)

Skip the question if the user's prompt already answers it.

### 3. Write the ADR file

File path: `docs/adr/NNN-<kebab-title>.md`. Title kebab-cased without filler words ("structured-contracts-section" not "the-structured-contracts-section").

Template (every section required unless noted):

```markdown
# ADR NNN: <Title in Sentence case>

**Status:** <Accepted | Proposed | Superseded by ADR-MMM | Rejected>
**Date:** YYYY-MM
**Supersedes:** [ADR-MMM](./MMM-slug.md) | none (additive) | none

<!-- Optional next line, only when relevant: -->
**Related:** [ADR-XXX](./XXX-slug.md), Atelier-feedback v2 P6-NN

## Context

<2–4 paragraphs on the problem, the trigger (review feedback / backlog item / encountered limitation), and what surfaces are affected. Quote the original prompt verbatim if it came from a review (Atelier-v2 / persona-audit / etc.).>

## Decision

<The chosen path, stated declaratively. If schema-affecting, include a Zod / TypeScript sketch in a fenced ts code block. If YAML-affecting, include a yaml example block. Concrete > abstract.>

## Rationale

<Why this path and not the alternatives. Name the alternatives explicitly. Tie to project principles where possible: canon-first (ADR-001), schema-as-contract (ADR-004), single-source-of-truth, rationale-not-just-rules.>

## Consequences

<Positive consequences (what becomes possible / cleaner). Negative consequences (what becomes harder / what migration cost). Migration footprint if non-trivial: # of YAMLs touched, schema fields renamed, render-side changes.>

<!-- Optional sections, include only when applicable: -->

## Migration

<Step-by-step migration plan when the change touches existing content. Include the python-regex one-liner for bulk YAML edits if applicable.>

## Alternatives considered

<Each alternative gets a sub-heading or bullet, with a one-paragraph reason for rejection.>
```

### 4. Cross-link if superseding

If `Supersedes: ADR-MMM`:

- Open `docs/adr/MMM-*.md`.
- Change `**Status:** Accepted` to `**Status:** Superseded by ADR-NNN ([title](./NNN-slug.md))`.
- Do not delete the superseded ADR. The historical record matters.

If a related ADR exists but is not superseded (mentioned, not replaced), do *not* edit the related ADR — only the new one carries the cross-link.

### 5. Backlog hook

After writing the ADR, if a corresponding `docs/backlog.md` item exists, flip it `[ ]` → `[x]` and append the completion line per the project's backlog convention. Per `docs/CLAUDE.md`: "When you finish a backlog item: flip `[ ]` → `[x]`, add the completion date and a one-line outcome plus the affected file(s)."

If no backlog item exists, do not invent one.

## Conventions specific to this repo

- **Status values seen in the corpus**: `Accepted`, `Proposed`, `Superseded by ADR-NNN`, `Rejected`. No other values.
- **Date format**: `YYYY-MM` (month-precision, not full date). Match existing ADRs.
- **Supersedes line**: always present even when "none (additive)" — never omit the line.
- **Tone**: declarative, no hedging. The ADR owner asserts the decision; the Rationale section justifies it. Lowercase headings would be wrong — always sentence-case.
- **Code blocks**: prefer `ts` for Zod, `yaml` for content examples, `bash` for migration one-liners. Match ADR-025 / ADR-027 as templates.
- **Length**: 100–400 lines is normal. ADR-027 (~350 lines) and ADR-025 (~150 lines) are good shape references. Do not pad.
- **Cross-references**: when citing review feedback, name the source: "Atelier-feedback v2 (2026-05-02, P6-50)" or "persona-audit P4-NN". Bare quotes are fine when they capture the original critique.
- **Rejected ADRs**: still numbered, still filed. ADR-026 ("state-dependent slotKind rejected") is the precedent. Status: `Rejected`. The Decision section states what was rejected and why; no implementation follows.

## What not to do

- Do not skip numbers. ADRs are dense linear history.
- Do not retcon old ADRs except for the `Status:` flip when superseded.
- Do not write ADRs for trivially-additive optional fields (e.g. P6-71 axeCoreVersion, P6-72 mistake.severity, P6-76 events.optional all landed without ADRs because they were additive optionals with no alternative under consideration). Reserve ADRs for choices with a real alternative or a reversed prior decision.
- Do not put migration scripts inline as long shell blocks if they exceed ~10 lines — link to the script in `scripts/` instead.
