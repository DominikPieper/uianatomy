---
name: backlog-tick
description: Maintain docs/backlog.md as the single source of workflow truth — flip [ ] → [x] when an item finishes, append the completion date and a one-line outcome plus affected files, update the "Empfohlener Pfad" line if the next item shifted, and append newly discovered work in the right priority bucket. Use whenever the user says "fertig", "done", "erledigt", "gerade gepusht", "ship that", or whenever any non-trivial work concludes; also use mid-session when new follow-ups, bugs, missing tests, deferred cleanups, or schema gaps surface — append them automatically per docs/CLAUDE.md without waiting to be asked. Keeps PX-NN ids sequential within their bucket and prevents stale items from accumulating.
---

# backlog-tick

The backlog at `docs/backlog.md` is the single source of truth for "what is open, what is next, what was just finished" (`docs/CLAUDE.md`). This skill enforces the maintenance loop mechanically so it stops drifting.

## When to use

**Auto-trigger on completion phrases:**

- "fertig" / "done" / "erledigt" / "gepusht" / "shipped"
- "X ist drin" / "X is in" / "landed X"
- "abgehakt" / "tick that off"

**Auto-trigger when discovering new work mid-session:**

- A bug surfaces but the user wants to defer the fix
- A test gap is named but not filled this session
- A schema field is "we should also …" without acting on it now
- A library audit notes follow-ups beyond the current scope
- An ADR ends with "consequence: future work in <area>"

In both cases — flip or append, do not wait to be asked. `docs/CLAUDE.md` is explicit: "do not wait to be asked".

**Do not trigger** for:

- Conversational acknowledgements without finished work ("ok danke")
- Pure status questions ("was ist offen?") — those are read-only, no edit needed
- Cosmetic edits to backlog itself (handled inline)

## Format conventions

Every entry follows this shape (extracted from the corpus):

```markdown
[ ] **PX-NN Title** — one-line summary. Datei: <path>.
[x] **PX-NN Title** — outcome description with affected surfaces. <verb-phrase>. Erledigt YYYY-MM-DD. Dateien: `<path>`, `<path>`, …
```

Rules:

- **Status legend**: `[ ]` open · `[~]` in progress · `[x]` done. No other glyphs.
- **PX-NN id**: `P` + priority bucket digit (0..6) + `-` + sequential number within bucket. New ids are `max(NN) + 1` within the same bucket.
- **Title bold**: wrap in `**`.
- **Em-dash separator**: `—` between title and description, not `-`.
- **Datei: vs Dateien:**: singular when one file, plural when multiple. Backticks around paths.
- **Date format**: `YYYY-MM-DD` (full date, not month-precision like ADRs use). Today is `2026-05-03` per project convention; convert relative dates the user gives.
- **Outcome prose**: one paragraph max. Name the schema/render/test/MCP touchpoints the change crossed. The corpus is rich (see P1-9, P2-15, P6-65 for high-quality precedents) — match that depth.
- **Language**: German is the default for outcome prose; English fragments mixed in are fine. Code identifiers stay verbatim.

## Steps

### Step 1: Read the backlog

`docs/backlog.md` is large (≥ 500 lines). Read enough context to:

- Find the item being completed (search by id or title fragment)
- Find the priority bucket where new items would go
- Find the "Empfohlener Pfad" line (usually at the top or just below the legend)

### Step 2: Flip the box

Change `[ ]` → `[x]` on the matching item. Then **rewrite the description** to be the outcome, not the spec:

- Old (open): "P6-72 mistake.severity tier — `mistakeSeveritySchema` als REQUIRED enum. Datei: `shared/src/schema.ts`."
- New (done): "P6-72 mistake.severity tier — `mistakeSeveritySchema = z.enum(['blocker','major','minor'])` als REQUIRED field auf mistakeSchema (component- UND pattern-mistakes). 133 entries handgeklassiert. MistakesList sortiert desc, severity-badge per row. Erledigt 2026-05-03. Dateien: `shared/src/schema.ts`, `content/components/*.yaml`, `content/patterns/*.yaml`, `site/src/components/sections/MistakesList.astro`, `shared/tests/schema.test.ts`."

The done description names: schema sketch (when applicable), file count, render touchpoint, test guard, completion date, file list.

### Step 3: Update "Empfohlener Pfad"

If the just-completed item was named in "Empfohlener Pfad", update the line to reflect the new next-item.

The convention from the corpus (project_state 2026-05-03):

> `Empfohlener Pfad latest (commit history 2026-05-02 → 2026-05-03): … P6-66 (✓) → Atelier-feedback v2 quick-wins bundle (P6-67/69/71/75/79/81/82, ✓) → P6-65 propertyMap-kind ADR-025 (✓) → MCP-tools-bundle (P6-80 + P6-83, ✓) → content-audit-bundle (P6-68 + P6-76 + P6-77, ✓) → P6-72 mistake.severity (✓) → P6-86 vsRelated bidirectional backfill (✓)`

Mark with `(✓)` after the just-completed id; promote the next-named item to the head of the path if it shifts.

If "Empfohlener Pfad" doesn't mention the item, no edit needed there.

### Step 4: Append discovered work

For new items found mid-session, append in the matching priority bucket:

- **P0** — sofort, blockiert Phase 2
- **P1** — strukturelle Schema-Erweiterungen
- **P2** — Inhalts-Sektionen
- **P3** — Site & SVG-Polish
- **P4** — Phase-2 implementations / library audits
- **P5** — long-tail polish, future work
- **P6** — Atelier-feedback v2 / persona-audits / external reviews

Use the open shape:

```
- [ ] **PX-NN Title** — one-line summary. Datei: <path>.
```

Pick a title that scans in 5 words. Pick a one-line summary that says *what to do*, not *why* (the why goes in the eventual outcome). Cite the file or schema or surface affected.

### Step 5: Maintenance scan

After flipping, scan the backlog for:

- **Now-obsolete items** — items the just-completed work also covered. Mark them `[x]` with a brief rationale: "Superseded by PX-NN; no separate work needed."
- **Items already covered elsewhere** — items duplicated by another bucket entry. Remove with a brief reason in the commit message.
- **Stale `[~]` items** — items marked in-progress for a long time without movement. Either advance, mark done, or drop back to `[ ]`.

A stale backlog is worse than no backlog (`docs/CLAUDE.md`). The maintenance loop is part of the job, not optional.

## Conventions specific to this repo

- **Tone**: terse and information-dense. The done-prose corpus runs ~3-4 lines per item with high signal. Don't pad.
- **File lists**: comma-separated with backticks. Wildcards (`*`) are OK for mass-migrations: `content/components/*.yaml (24 files)`.
- **Schema fields**: name them with backtick + Zod type when relevant (`` `axeCoreVersion?: semver` ``).
- **Counts**: cite (24 components, 133 entries, 6 events) — they're how reviewers audit scope.
- **Cross-refs**: when an item closes by way of an ADR, name the ADR (`ADR-025 supersedes ADR-015`) and link if useful (`Datei: docs/adr/025-property-map-kind.md`).
- **Multiple items closed by one commit**: list each separately, do not bundle. Keeps the file's regex search useful.

## What not to do

- Do not delete completed items — the historical record matters. Only delete duplicates or obsoletes with explicit rationale.
- Do not change the priority bucket of an open item without flagging the user. Priority is a deliberate ordering signal.
- Do not invent new buckets. P0..P6 is the corpus.
- Do not skip the "Empfohlener Pfad" update when it applies — the file's whole purpose is the next-step pointer.
- Do not ship a backlog edit that is out of sync with the actual code state. If you flipped `[x]` for an item that didn't actually land, the backlog lies and the next session inherits the lie. When in doubt, run the depth/test/build sequence to confirm completion before flipping.
- Do not bulk-flip without thinking. Each flip rewrites a description; mass-replacing `[ ]` with `[x]` breaks the file's contract.

## Final summary template

```
Backlog updated:
  Closed: PX-NN, PX-MM (2 items)
  Discovered: PX-NN <title> (1 new item in P<bucket>)
  Empfohlener Pfad: <updated path | unchanged>
  Maintenance scan: <N obsoletes resolved | none>
```
