---
name: schema-field-add
description: Drive the full lifecycle of adding or renaming a field on the canonical Zod schema in shared/src/schema.ts — ADR check, schema edit, schema.md doc, YAML migration across content/components/*.yaml + implementations/*/*.yaml, render-side update in site/, test guard, and build-hygiene cleanup. Use whenever the user asks to add a new field to the canon, rename one, change a vocabulary, or make a non-additive schema change. Triggers on phrases like "add field X", "neues feld auf schemaX", "rename type to kind", "migrate vocabulary", "schema change for X", "extend componentSchema", "extend patternSchema", "extend a11yAcceptanceSchema". Prefer this over ad-hoc edits because forgetting any of the seven steps leaves the repo half-migrated; the build-hygiene gotcha (`pnpm -F @uianatomy/shared build && rm -rf site/.astro`) and the YAML-migration step are the two most commonly forgotten parts.
---

# schema-field-add

Codifies the seven-step cycle for canonical schema changes in uianatomy. Every recent schema change in `docs/backlog.md` (P6-65, P6-71, P6-72, P6-76, P6-77, P6-79, P6-86, P6-73) followed this exact sequence; missing a step has caused real regressions (stale `site/.astro` cache reading old schema, un-migrated implementation YAMLs failing Zod, render-side ignoring new field).

## When to use

Trigger when the user says any of:

- "add field X to componentSchema" / "neues feld X" / "extend the schema with X"
- "rename Y to Z on the schema"
- "change vocabulary from A|B to A|B|C"
- "make field F required" / "make field F optional"
- "schema change for <topic>"

Also trigger proactively when a backlog item names a schema modification (look for "schema:", "feld:", "field:", or "Zod" in the backlog line) and the user says "go".

Do **not** trigger for: pure render changes (no schema edit), MCP-tool additions (use mcp-tool-add), ADR writing (use adr-author — though this skill calls into adr-author when an ADR is needed).

## The seven-step cycle

Execute every step. Skip only when the step explicitly does not apply (e.g. step 3 if `docs/schema.md` already covers the field; step 5 if the field is loader-only and never rendered). Record skips in the final summary.

### Step 0: Decide whether an ADR is needed

ADR required when the change is **non-additive**:

- Renaming an existing field (P6-65: `type → kind` → ADR-025)
- Replacing a vocabulary (P6-65: `Boolean | Variant | Text | Instance Swap → enum | boolean | text | slot | number` → ADR-025)
- Removing a field
- Changing a field from optional → required *with no default* (breaking)
- Restructuring (e.g. moving prose into structured arrays — P6-73 → ADR-027)

ADR **not** required (precedent: P6-71, P6-72, P6-76, P6-79):

- Additive optional field
- Additive required field with global default that can be backfilled mechanically
- Adding an enum value (no removal, no semantic change)
- Cross-refine that only narrows existing valid states

If ADR needed, invoke the `adr-author` skill first and land that file before proceeding. Reference the ADR number in commit messages and `schema.md` updates.

### Step 1: Edit `shared/src/schema.ts`

The schema is the contract (ADR-004). Touch this file first; everything else flows from it.

Conventions:

- New schemas use `z.object({...}).strict()` to forbid unknown keys.
- Enums use `z.enum([...])` with `as const` arrays exported separately when the values are also needed at runtime (see `shared/src/vocabulary.ts` pattern from P6-66).
- Optional fields: `.optional()`. Required fields: omit `.optional()`.
- Cross-refine for "only meaningful when X is present" — see `axeCoreVersion` (P6-71): `.refine((data) => data.axeCoreVersion === undefined || data.axeRules !== undefined, { ... })`.
- Export both the schema and a derived TypeScript type: `export type ContractKind = z.infer<typeof contractKindSchema>;`.

After editing, build the package immediately:

```bash
pnpm -F @uianatomy/shared build
```

This emits `shared/dist/`. The site reads from `dist/`; tests under `shared/` import from `src/` and won't reveal staleness.

### Step 2: Migrate `content/components/*.yaml` (and `content/patterns/*.yaml`)

24 components + 2 patterns currently. Use python-regex for any change touching ≥ 5 files. Inline `sed` is fine for trivial single-key renames; python wins for multi-line restructures.

Pattern from P6-65 (vocabulary swap, used in real migration):

```bash
python3 -c "
import re, glob
mapping = {'Boolean': 'boolean', 'Variant': 'enum', 'Text': 'text', 'Instance Swap': 'slot'}
for path in glob.glob('content/components/*.yaml') + glob.glob('content/patterns/*.yaml'):
    with open(path) as f: src = f.read()
    out = src
    for k, v in mapping.items():
        out = re.sub(rf\"^(\s*)type:\s*['\\\"]?{re.escape(k)}['\\\"]?\\s*\$\", rf\"\1kind: {v}\", out, flags=re.M)
    if out != src:
        with open(path, 'w') as f: f.write(out)
        print(path)
"
```

Pattern from P6-71 (additive required field with global default — pin all 24 to a single value):

```bash
python3 -c "
import re, glob
for path in glob.glob('content/components/*.yaml'):
    with open(path) as f: src = f.read()
    if 'axeRules:' in src and 'axeCoreVersion:' not in src:
        out = re.sub(r'(\\n\\s*axeRules:)', r'\\n  axeCoreVersion: 4.10.2\\1', src, count=1)
        with open(path, 'w') as f: f.write(out)
"
```

Pattern from P6-72 (additive required field with per-row classification — cannot mechanize, hand-classify all 133 entries by heuristic):

For required fields with non-uniform values, do **not** auto-fill. Open each file, classify, write the value. Use a heuristic doc in the commit message so reviewers can audit (see P6-72: blocker = WCAG/SR/keyboard/focus/security; major = pattern-drift/perf-cliff/anti-pattern; minor = taxonomy/visual/edge).

### Step 3: Migrate `implementations/<lib>/*.yaml`

Currently 3 audits (Modal × {radix, headlessui, cdk}). Same migration script extended with `glob.glob('implementations/*/*.yaml')`. Implementation YAMLs use a slightly different schema (`implementationSchema` not `componentSchema`) — only edit if the field exists on both. If the field is canon-only, skip implementation YAMLs entirely.

### Step 4: Update `docs/schema.md`

The doc is the human-readable contract. For every schema edit, update the matching section:

- New field → new sub-heading under the relevant top-level section, with rationale + example
- Renamed field → update all mentions (use grep to find them all: `grep -n "old_name" docs/schema.md`)
- Vocabulary change → update the vocabulary list and the migration table

Cite the ADR number if step 0 produced one: `(per [ADR-NNN](./adr/NNN-slug.md))`.

### Step 5: Update render in `site/`

Render-side files are usually `site/src/components/<FieldName>.astro` or part of an existing aggregator like `PropertyMapTable.astro` / `MistakesList.astro` / `EventsTable.astro` / `AnatomyDiagram.astro`.

Find the render with: `grep -rln "<old_field>" site/src/components/ site/src/views/`.

CSS modifier conventions (carried from P6-65):

- Closed enums render as a CSS modifier on a single class: `.--<value>` (e.g. `.--enum`, `.--boolean`, `.--slot`, `.--number`).
- Add light + dark variants in `site/src/styles/global.css`.
- Use a constant lookup `const KIND_LABEL: Record<Kind, string>` for badge text — never inline a value-to-label switch in the template.

### Step 6: Add a test guard

Tests live in:

- `shared/tests/` — schema parse / consistency / vocabulary
- `mcp-server/tests/` — MCP-tool wiring

Always add at least one positive test (parses with the new field), one negative (rejects invalid value), and one consistency test if the field cross-refines with another (e.g. P6-71's "axeCoreVersion only meaningful when axeRules present").

For required new fields, add a regression test that rejects YAMLs missing the field. For optional new fields, no rejection test needed.

After test write:

```bash
pnpm -r test
pnpm -r typecheck
```

Both must pass before declaring the migration complete.

### Step 7: Build-hygiene cleanup

After **every** `shared/src/schema.ts` change, run before site rebuild:

```bash
pnpm -F @uianatomy/shared build && rm -rf site/.astro
```

This is the single most-forgotten step in the project. Symptoms when missed: site build appears to succeed but renders the *previous* schema's data; new MCP-tool subpath imports (e.g. `@uianatomy/shared/vocabulary` from P6-66) resolve to stale dist content.

Then verify the site:

```bash
cd site && pnpm dev
```

Spot-check at minimum one component that uses the new field and one that doesn't. Confirm both render and the new field appears where expected.

## Backlog hook

When the schema change closes a backlog item, flip `[ ]` → `[x]` in `docs/backlog.md`, add the date + one-line outcome + affected files, and update "Empfohlener Pfad" if the next item shifted. Per `docs/CLAUDE.md`, this is automatic — do not wait to be asked.

## Final summary template

After all seven steps land, summarize for the user in this exact shape:

```
Schema change: <one-line description>
ADR: <ADR-NNN | none (additive)>
Files touched:
  - shared/src/schema.ts (+N/-M)
  - docs/schema.md (+N/-M)
  - content/components/*.yaml (X files)
  - content/patterns/*.yaml (Y files, if applicable)
  - implementations/*/*.yaml (Z files, if applicable)
  - site/src/components/<...>.astro (+N/-M)
  - site/src/styles/global.css (+N/-M, if visual modifier added)
  - shared/tests/<...>.test.ts (+P tests)
Build hygiene: shared rebuilt + site/.astro cleared.
Tests: <count> green (<delta vs baseline>).
Backlog: <P6-NN> flipped to [x] | no backlog item.
```

## What not to do

- Do not edit content YAML before the schema (Zod will reject the YAML mid-edit; tests fail confusingly).
- Do not skip the `pnpm -F @uianatomy/shared build && rm -rf site/.astro` cleanup — see step 7.
- Do not invent migration scripts that mass-edit on regex without a dry-run first. Print affected paths before writing.
- Do not bundle two unrelated schema changes in one cycle. Each schema change goes through this loop independently. Bundling makes ADRs harder to write and reviewers' jobs harder.
- Do not declare the cycle complete until `pnpm -r test && pnpm -r typecheck` both pass green.
