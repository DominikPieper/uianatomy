# Claude Code Quick-Start

This file orients Claude Code (or any future contributor) to the project's intent and conventions. Read this before making changes.

## What this project is

A canonical reference for UI component anatomy — see [README.md](./README.md) for the full pitch.

## Reading order for new contributors

1. **README.md** — what the project is and who it's for
2. **methodology.md** — how content is researched and written
3. **schema.md** — the structure of canonical YAML files
4. **views.md** — how content is presented (designer / dev / bridge)
5. **decisions/** — the architectural decisions in order (001 → 005)
6. **roadmap.md** — what's planned and in what order

## Core principles (always keep in mind)

- **Canon first.** Canonical YAML in `content/components/` knows nothing about specific implementations. See ADR-001.
- **Schema is a contract.** Adding fields requires updating Zod schema, schema.md, and validation. See ADR-004.
- **Single source of truth.** Site and MCP server read the same YAML through the same Zod schema. Never duplicate data.
- **Rationale, not just rules.** Every documented decision (slot, variant, mistake, mismatch) needs a *because*.

## Working on canonical components

When asked to add or modify a component in `content/components/`:

1. Confirm the component is canonical (library-agnostic). If the request is implementation-specific, redirect to `implementations/`.
2. Research from at least three categories: spec (APG/MDN), mature libraries (Radix, React Aria, Headless UI, Spectrum), and design systems (Polaris, Carbon, Material 3, Atlassian).
3. Write the YAML conforming to the schema in `shared/schema.ts`.
4. Validate with Zod before committing.
5. Verify the site renders all three views correctly.
6. Verify the anatomy SVG generates correctly (or that an override is in place).

## Working on implementations

When asked to add or modify an `implementations/<lib>/<component>.yaml`:

1. Confirm a corresponding canonical `content/components/<id>.yaml` exists. If not, the canonical version must be written first.
2. Document divergences explicitly — don't paper over differences.
3. Each divergence needs a `type` (omitted/renamed/extended/reshaped) and a `rationale`.
4. Date the file with `lastReviewed`.

## Working on the schema

Schema changes touch many files. Before making them:

1. Confirm the change is necessary and not just convenient
2. Update `shared/schema.ts`
3. Update `docs/schema.md` to reflect the change
4. Migrate all existing YAML files to conform
5. If breaking, write a migration note in the relevant ADR or create a new ADR

## Working on the site

The site is intentionally simple. Resist:

- Adding interactive features that aren't in scope (live editors, sandboxes, etc.)
- Adding analytics or tracking
- Adding visual flourishes that don't serve information density
- Coupling site rendering to specific implementations

Embrace:

- Clear typography
- Fast page loads
- Accessibility (this is a reference about good UI; the reference itself must be exemplary)

## Working on the MCP server

- Tools should map directly to user intents (`get_anatomy`, `get_mismatches` — not `get_field_X`)
- Return values are derived from canonical YAML; no separate data store
- Cold-start performance matters; keep dependencies minimal

## What not to do without explicit confirmation

- **Don't add Atelier UI references to canonical files.** ADR-001 is non-negotiable.
- **Don't restructure the directory layout.** ADR-004 keeps canonical and implementation data strictly separated.
- **Don't add new top-level fields to the canonical schema** without going through the schema-change process above.
- **Don't introduce new dependencies** without reviewing the trade-off.
- **Don't add component pages without full content.** A page with placeholder slots is worse than no page.

## Tone and writing conventions

- Direct, declarative prose. No hedging unless the topic genuinely requires it.
- Lowercase headings? No — sentence case.
- "Components" as a plural noun, "component" as singular. Not "Components page" but "components page."
- "Designer view" / "Dev view" / "Bridge view" — these are proper nouns in this project.
- "Anatomy" refers to the slot/region structure, never to visual styling.
- "Variant" / "Property" / "State" are technical terms with specific meanings (see schema.md). Use them precisely.

## When in doubt

- Re-read the relevant ADR
- Ask the project owner
- Default to the canon-first methodology (ADR-001) when there's any ambiguity
