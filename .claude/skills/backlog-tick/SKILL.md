---
name: backlog-tick
description: Maintain docs/backlog.md as the single source of workflow truth — flip [ ] → [x] when an item finishes, append the completion date and a one-line outcome plus affected files, update the "Empfohlener Pfad" line if the next item shifted, and append newly discovered work in the right priority bucket. Use whenever the user says "fertig", "done", "erledigt", "gerade gepusht", "ship that", or whenever any non-trivial work concludes; also use mid-session when new follow-ups, bugs, missing tests, deferred cleanups, or schema gaps surface — append them automatically per docs/CLAUDE.md without waiting to be asked. Keeps PX-NN ids sequential within their bucket and prevents stale items from accumulating.
---

# backlog-tick

The backlog at `docs/backlog.md` is the single source of truth for "what is open, what is next, what was just finished" (`docs/CLAUDE.md`). This skill enforces the maintenance loop mechanically so it stops drifting.

> **Lean reset (2026-05-31, backlog P6-163…167).** The backlog was rewritten from
> 72KB of essay-length done-entries to a lean one-line-per-entry file. **Done-entries
> are ONE line** (title · outcome · date · files); implementation detail goes in the
> commit message, not here. **Do not maintain counts (tests/tools/pages) in prose** —
> they drift; derive them from the test-runner / `grep`. New ids = highest-seen + 1
> within the bucket (scan `backlog-archive.md` only to avoid an id collision; IDs need
> uniqueness, nothing more). These rules override any "match the corpus depth" guidance
> that survives below.

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
[ ] **PX-NN Title** — one-line summary of what to do. Datei: <path>.
[x] **PX-NN Title** — one-line outcome (what changed + key surfaces). Erledigt YYYY-MM-DD. Dateien: `<path>`, `<path>`, …
```

Rules:

- **Status legend**: `[ ]` open · `[~]` in progress · `[x]` done. No other glyphs.
- **PX-NN id**: `P` + priority bucket digit (0..6) + `-` + sequential number within bucket. New ids are `highest-seen + 1` within the bucket — scan `docs/backlog-archive.md` too, but only to avoid a collision. IDs need uniqueness, nothing more.
- **Title bold**: wrap in `**`.
- **Em-dash separator**: `—` between title and description, not `-`.
- **Datei: vs Dateien:**: singular when one file, plural when multiple. Backticks around paths.
- **Date format**: `YYYY-MM-DD` (full date). Use the current date; convert relative dates the user gives.
- **Outcome = one line.** Name the headline change and the surfaces it crossed (schema / render / test / MCP) in a single sentence. The *why* and the blow-by-blow belong in the commit message — git already holds them. Do **not** restate test/tool/page counts in prose; they drift.
- **Language**: German is the default for outcome prose; English fragments mixed in are fine. Code identifiers stay verbatim.

## Steps

### Step 1: Read the backlog

`docs/backlog.md` is lean (~one line per entry). Read it to:

- Find the item being completed (search by id or title fragment)
- Find the priority bucket where new items would go
- Find the "Empfohlener Pfad" section (just below the legend)

### Step 2: Flip the box

Change `[ ]` → `[x]` on the matching item. Then **rewrite the description** to be the outcome, not the spec — in **one line**:

- Old (open): "P6-72 mistake.severity tier — `mistakeSeveritySchema` als REQUIRED enum. Datei: `shared/src/schema.ts`."
- New (done): "P6-72 mistake.severity tier — `mistakeSeveritySchema` REQUIRED enum (`blocker/major/minor`) auf component- + pattern-mistakes; MistakesList sortiert + Badge per Row. Erledigt 2026-05-03. Dateien: `shared/src/schema.ts`, `content/components/*.yaml`, `site/src/components/sections/MistakesList.astro`."

The done line names the headline change + the surfaces it crossed + the date + the files. No counts, no blow-by-blow — that lives in the commit.

### Step 3: Update "Empfohlener Pfad"

If the just-completed item was named in "Empfohlener Pfad", update it so the **Next** line names the new next-item. Keep it short — the recommended-path section names what to do next, not a `(✓)`-chain of history and not a count. Move closed items into a short "Erledigt <date>" line if useful; the narrative belongs to git, not this section.

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

- **Tone**: terse and information-dense. A done-entry is **one line** — headline change + surfaces + date + files. Don't pad, don't write a paragraph.
- **File lists**: comma-separated with backticks. Wildcards (`*`) are OK for mass-migrations: `content/components/*.yaml`.
- **Schema fields**: name them with backtick + Zod type when relevant (`` `axeCoreVersion?: semver` ``).
- **No counts in prose**: do not write "24 components / 133 entries / 300 tests" — they rot. Scope is recoverable from the diff / test-runner; cite a number only when it *is* the outcome (e.g. "Tool-Count 28→20").
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
