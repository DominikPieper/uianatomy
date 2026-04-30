# Personas

Working artifact for who UI Anatomy serves and where the canon currently fails them. Read this before proposing new features — it grounds "is this worth building?" in concrete journeys instead of guesses.

Format: each persona records the goal, what's available today, what's still missing, and the backlog items that close gaps. As gaps close, flip the entry from open `[ ]` to closed `[x]` with the closing item id.

Last reviewed: 2026-04-30

---

## Designer

Designs new components or extends existing ones; needs the canonical anatomy + tokens + motion + responsive contract before opening Figma.

**Today**

- `/components/<id>` Designer view — anatomy SVG, slot definitions with Figma hints, tokens table, motion + responsive blocks, property-map (Figma → code), i18n notes.
- Generated OG image per page for sharing in Slack / Linear.
- Pagefind-powered `/search` for component lookup.

**Gaps**

- [x] **Side-by-side component compare** (`/compare?a=button&b=link`). Closed by P3-38.
- [ ] **Rendered example next to anatomy SVG.** SVG is wireframe-only — "what does a canonical Card actually look like?" goes unanswered.
- [ ] **Copy-as-CSS-vars / copy-as-JSON for the tokens table.** Pattern exists but no one-click copy.
- [ ] **Figma plugin** that consumes `/api/components/<id>.json` and surfaces canon mismatches inline. Big project; held intentionally.

---

## Developer

Implements canonical components in React / Vue / Angular / web components; needs the code-side hints, framework mapping, accessibility contract, and ideally a paste-able test fixture.

**Today**

- `/components/<id>/dev` view — code-side hints per slot, framework-map (RFC for state / props / events across frameworks), events array with per-framework notes, form-integration prose, a11y-acceptance (keyboardWalk + announcements + axe rules), performance thresholds.
- Three Modal library audits (Radix React, Headless UI Vue, Angular CDK) with `divergence` discriminated-union entries and `exampleCode`.
- Static JSON API at `/api/components/<id>.json`.
- Code blocks rendered with astro-expressive-code (frame chrome + copy button).

**Gaps**

- [x] **A11y test-fixture export** at `/api/components/<id>/a11y-fixture.json` — keyboardWalk + announcements + axe rules in a Playwright + jest-axe-friendly shape. Closed by P3-37.
- [ ] **Library coverage at depth.** Three audits exist, all for Modal. Need ≥1 audit per framework family for ≥3 components before pattern recognition kicks in.
- [ ] **`validate_implementation` MCP tool** — agent passes `{ componentId, code, framework }`, server returns heuristic checks against canon (slot presence, axe-rule mention, event coverage). Lets agents self-verify generated UI code.
- [x] **`get_implementations(componentId)` + `list_implementations()` on MCP** — closed by P3-36.

---

## Design system maintainer

Owns a real design system; needs to verify their components stay aligned with canon as the canon evolves.

**Today**

- `/components/<id>` Bridge view — Figma ↔ code mismatches and common implementation mistakes catalogued explicitly.
- Library audits as a model of "this is what divergence looks like, documented in the open."

**Gaps**

- [ ] **Audit-against-canon CLI / hosted tool.** Ingest a system's tokens / component definitions, report deltas in the same divergence-discriminated-union shape (omitted / renamed / extended / reshaped). Big project.
- [ ] **Compliance score / badge** for systems that audit clean. Useful adoption signal; low priority while nothing rewards the work yet.
- [ ] **Per-component changelog** (P4-23 deferred). When canon changes, maintainers need to know what shifted and when. Premature today — no real deprecations yet — but will become urgent as the canon ages.

---

## AI agent

Reads the canon to answer questions about components and to scaffold implementations. Includes Claude / GPT / agentic browser tools / WebMCP-aware browsers.

**Today**

- MCP server at `/mcp` (Streamable HTTP, 17 tools).
- `/.well-known/mcp/server-card.json` (SEP-1649) for transport discovery.
- `/.well-known/agent-skills/index.json` + `uianatomy-mcp/SKILL.md` (Cloudflare Agent Skills Discovery RFC v0.2.0) with sha256 digest.
- WebMCP — three read tools (`list_components`, `get_component`, `search_components`) registered in-browser via `navigator.modelContext`.
- `Accept: text/markdown` content negotiation per route, plus `llms.txt` + `llms-full.txt`.
- RFC 8288 link headers on `/` + RFC 9727 linkset at `/.well-known/api-catalog`.
- robots.txt with Content-Signal directives (`ai-train=no, search=yes, ai-input=yes`).

**Gaps**

- [ ] **`validate_implementation` MCP tool** — same gap as the developer persona. Lets agents self-check what they generate.
- [ ] **More MCP tools as audit count grows.** Today every audit is for `modal`. Tools like `compare_implementations(libraryId, otherLibraryId, componentId)` only become valuable when there's enough audit data to compare.
- [ ] **WebMCP parity with HTTP MCP.** Browser tools list 3 reads, HTTP MCP exposes 17. Drift is fine for now (browser context has different capability surface) but worth revisiting when the WebMCP spec stabilises.
- [x] **`get_implementations` not on MCP** — closed by P3-36.

---

## How to use this doc

- **When proposing a new feature**: read the relevant persona's gap list first. If the feature doesn't close a documented gap, either it's premature or the doc is missing a persona.
- **When closing a gap**: flip `[ ]` to `[x]` and append the backlog item id (`P3-NN`) inline with the closing entry. Keep the gap text — it's history.
- **When personas drift** (new audience, behaviour change in an existing one): update inline or add a new section. Don't keep stale gaps; either close them or remove with a one-line rationale.

Source of truth for backlog state remains `docs/backlog.md`. This file scopes the *why*; the backlog scopes the *what's next*.
