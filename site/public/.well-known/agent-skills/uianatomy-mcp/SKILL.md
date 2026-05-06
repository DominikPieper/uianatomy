---
name: uianatomy-mcp
description: Query the UI Anatomy MCP server for canonical UI component anatomy, axes, slots, transitions, motion, tokens, events, cross-framework mapping, library divergences, and compositional patterns.
---

# UI Anatomy — MCP skill

UI Anatomy publishes a canonical, library-agnostic reference for common UI components (Button, Card, Modal, Tabs, Combobox, Drawer, …). Each component declares its **anatomy** (slots and regions), **axes** (variants, properties, states, transitions), **mismatches** between Figma and code, **common mistakes**, **cross-framework mapping**, **tokens**, **motion**, **responsive** notes, **events**, and **when to use vs. when to avoid**.

**Read these as best practices, not fixed rules.** Each canonical record is *synthesised* from triangulating multiple sources — W3C ARIA APG, MDN, WCAG, mature headless libraries (Radix UI, React Aria, Headless UI, Spectrum), and production design systems (Polaris, Carbon, Atlassian, Material 3, GOV.UK). Where they converge, the convergence becomes the canonical default. Where they disagree, the disagreement is named and a recommendation is picked with rationale. The canon is a *reference for reasonable defaults across the industry*, not a regulation. Context-driven divergence is expected — that is what the per-library audits in `implementations/` exist to capture. When citing the canon to a downstream user, surface this framing: it is not authoritative law, it is convergence with rationale. Call `get_about` for the full project framing prose.

The MCP server exposes this knowledge as 29 tools.

## Endpoint

- URL: `https://uianatomy.dev/mcp`
- Transport: Streamable HTTP (`@modelcontextprotocol/sdk` ≥ 1.29)
- Auth: none (public read-only)
- Server card: `https://uianatomy.dev/.well-known/mcp/server-card.json`

## Install in another project

This skill file is canonical and stable. Drop it into any repo that uses Claude Code and the agent will pick it up automatically.

**One-liner:**

```bash
mkdir -p .claude/skills/uianatomy-mcp \
  && curl -fsSL -o .claude/skills/uianatomy-mcp/SKILL.md \
       https://uianatomy.dev/.well-known/agent-skills/uianatomy-mcp/SKILL.md
```

Then wire the MCP server in the same project's MCP configuration (path varies by client, see below):

**Claude Code / Claude Desktop** (`.mcp.json` at project root, or `~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "uianatomy": {
      "type": "http",
      "url": "https://uianatomy.dev/mcp"
    }
  }
}
```

**Older clients without native streamable-HTTP** (Cursor, Windsurf, older Claude Desktop) — proxy via `mcp-remote`:

```json
{
  "mcpServers": {
    "uianatomy": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://uianatomy.dev/mcp"]
    }
  }
}
```

**Direct SDK** (TypeScript / Node ≥ 20):

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("https://uianatomy.dev/mcp"),
);
const client = new Client({ name: "your-app", version: "1.0.0" });
await client.connect(transport);

const result = await client.callTool({
  name: "get_anatomy",
  arguments: { id: "modal" },
});
```

**Discovery (no install needed)** — every page on `uianatomy.dev` advertises the MCP endpoint via RFC 9727 `Link: rel="api-catalog"`. The agent-skills RFC v0.2.0 index lists this skill at `https://uianatomy.dev/.well-known/agent-skills/index.json`; clients that auto-discover skills will find it.

## Tools

| Tool | Args | Returns |
|------|------|---------|
| `get_about` | — | Project framing prose — what UI Anatomy is, what it is *for*, what it is *not*, and what "canon" means here. **Call this before relaying canonical claims to a user**: it carries the "best-practice convergence, not fixed rule" framing every downstream consumer should inherit. Returns `{ markdown, summary }` — `markdown` is the full `docs/about.md` body; `summary` is a one-paragraph distillation suitable for tool-call traces. |
| `list_components` | — | All canonical components (id, name, description). |
| `search_components` | `query: string` | Substring match across id/name/description/slots/variants. |
| `get_component` | `id: string` | Full canonical schema for one component. |
| `get_components` | `ids: string[]` | Bulk-fetch full canonical records. Returns `{ components, missing }` — `components` is the resolved set in request order (deduplicated), `missing` is the sorted list of unresolved ids. Use when the agent already knows the id set (comparing 3 components, hydrating a pattern's composition list); avoids N round-trips. |
| `get_component_view` | `id: string`, `view: "designer" \| "dev" \| "bridge"` | Role-specific projection of the component. `designer` keeps Figma-side hints + tokens + motion + responsive + property-map + i18n. `dev` keeps code-side hints + framework-map + events + form-integration + a11y-acceptance + performance. `bridge` keeps mismatches + common-mistakes + everything cross-cutting. |
| `get_anatomy` | `id: string` | Slot/region definitions only. |
| `get_axes` | `id: string` | Variants, properties, and states only. |
| `get_mismatches` | `id: string` | Documented Figma ↔ code misalignments. |
| `get_common_mistakes` | `id: string` | Documented implementation errors and the fixes. |
| `get_framework_map` | `id: string` | Cross-framework expression mapping (web components / React / Angular signals / Vue). |
| `get_tokens` | `id: string` | Per-slot token bindings (`spacing`, `radius`, `color`, `elevation`, `typography`). Returns `null` when the component declares none. |
| `get_motion` | `id: string` | Motion block (durations, easing, reduced-motion fallback). `null` if absent. |
| `get_responsive` | `id: string` | Responsive breakpoints. `null` if absent. |
| `get_transitions` | `id: string` | State-machine transitions (`from` / `to` / `trigger`). `null` if absent. |
| `get_events` | `id: string` | Events array (name, payload, per-framework notes). `null` if absent. |
| `get_when_to_use` | `id: string` | `use` / `avoid` prose plus related-component differentiators. |
| `get_changelog` | `id: string` | Versioning metadata: `since` (semver) plus `changelog` array of `{ version, date, summary }`. `null` when neither is declared. |
| `get_canonical_vocabularies` | — | Master canonical vocabularies (`spacing`, `radius`, `color`, `elevation`, `typography`, `motion: { durations, easing }`, `breakpoint`, `propertyVocab`, `propertyBounded`, `interactiveStates`) that YAML values must draw from. Same source the consistency-test enforces. Use to resolve a value like `responsive.breakpoints[].at: "breakpoint.sm"` against the master list, or to surface allowed enum values to a downstream UI. |
| `get_contracts` | `id: string` | Return the contracts block for a component **or** a pattern (single-tool dispatch by id). Returns `{ id, kind: "component" \| "pattern", contracts }`. `contracts.nonNegotiable[]` is hard-binding rules with `source: 'apg' \| 'wcag' \| 'html-spec' \| 'platform' \| 'canon'`, optional `sourceRef`, and a `consequence` describing what breaks on violation. `contracts.vocabularyDrift[]` is per-system attributed naming (Material 3 → Snackbar, Atlassian → Flag, …) with optional notes. Returns `{ contracts: null }` when the entity exists but declares no contracts; errors on unknown id. |
| `list_patterns` | — | Every canonical pattern (compositions of canonical components) with `id`, `name`, `description`, the unique `componentId` set composed, and `lastReviewed`. |
| `get_pattern` | `id: string` | Full canonical pattern record (composition, whenToUse, decisions, mistakes, frameworkSkeletons, lastReviewed). |
| `get_patterns_for_component` | `componentId: string` | Every pattern that composes the given canonical component, sorted by pattern name, with the role this component plays. Empty array when no pattern uses it. |
| `get_pattern_a11y_aggregate` | `patternId: string` | Aggregate the a11yAcceptance contract for a pattern by unioning every composed component's a11yAcceptance. Returns `{ patternId, componentIds, axeRules (sorted union), keyboardWalk + announcements (concat, each tagged with `sourceComponentId`), axeCoreVersion (single semver if components agree, else null) }`. Useful for "test this whole pattern with axe-core + Playwright" flows. Errors on unknown patternId. |
| `list_implementations` | — | Every Phase-2 library audit (one row per library/component pair) — `libraryId`, `componentId`, `componentName`, `divergenceCount`, `lastReviewed`. Sorted by `libraryId` then `componentId`. **Takes no arguments — returns the full roster.** Use `get_implementations({ componentId })` to filter. Today only Modal × {radix, headlessui, cdk} are audited; other components return no rows. |
| `get_implementations` | `componentId: string` | Every library audit for one canonical component as an array of `Implementation` records (`componentId`, `libraryId`, `componentName`, `exampleCode`, `divergence` list, `rationale`, `lastReviewed`). Empty array when no library has audited the component yet. |
| `validate_implementation` | `componentId: string`, `code: string`, `framework: "react" \| "vue" \| "angular" \| "webComponents"` | Heuristic structural conformance check. **Scores supplied code against the canonical anatomy / axes / events of `componentId` — it does *not* require the canonical component to have a Phase-2 library audit, and it does not consult `implementations/<lib>/<id>.yaml`.** Use it on any framework code claiming to implement a canonical component (your own, generated, or a vendor library), regardless of whether that vendor has been audited. Reports which canonical required slots, variants, properties, and events appear (or are missing) in the supplied code. Framework-aware event-name detection (`on<PascalCase>` for React, `@event` / `v-on:` / `emit('event')` for Vue, `(event)` for Angular, bare names for web components). Substring search only — false negatives possible. NOT a substitute for behavioural assertions (pair with the per-component a11y-fixture endpoint and a real Playwright + axe-core run). |

## Typical agent flows

**"How is a Modal structured?"**

1. `get_anatomy({ id: "modal" })` → list of slots with required/optional, purpose, layout hints.
2. `get_axes({ id: "modal" })` → variants and states.
3. `get_transitions({ id: "modal" })` → `closed → opening → open → closing → closed`.

**"What can go wrong implementing Tabs?"**

1. `get_common_mistakes({ id: "tabs" })` → documented errors with rationale.
2. `get_mismatches({ id: "tabs" })` → Figma ↔ code traps.

**"Find a component for filtered selection"**

1. `search_components({ query: "filter" })` → ranked candidates.
2. `get_when_to_use({ id: "combobox" })` → `use`, `avoid`, comparisons with related components.

**"How does Radix' Dialog diverge from canonical Modal?"**

1. `get_implementations({ componentId: "modal" })` → array of audit records, one per library.
2. Inspect the `radix` entry's `divergence` list (`omitted` / `renamed` / `extended` / `reshaped`) and `exampleCode` for a known-good wiring.

**"I just generated a Modal in React. Did I miss anything canonical?"**

1. `validate_implementation({ componentId: "modal", code: "<your code>", framework: "react" })` → structural report listing missing required slots, variants, properties, and events.
2. Treat `missing` entries as a checklist, not as defects — substring search has false negatives. Run the matching `/api/components/modal/a11y-fixture.json` against your code in a Playwright + `@axe-core/playwright` test for behavioural conformance.

**"Audit a library spec or design doc against the canon"**

Useful when reviewing a vendor library API description, a design-system RFC, or any prose specification you want to score against canonical anatomy.

1. `list_components` → identify the canonical component(s) the spec covers (search by name, alias, or `search_components({ query })`).
2. For each match: `get_anatomy({ id })`, `get_axes({ id })`, `get_events({ id })`, `get_a11y_acceptance` (via `get_component_view({ view: "dev" })`). The canon is your audit checklist.
3. Walk the spec section by section — for each canonical slot / variant / event, confirm or flag the spec's coverage. Capture gaps as a divergence list (`omitted` / `renamed` / `extended` / `reshaped`); the same vocabulary the Phase-2 implementation audits use.
4. Pair with `get_mismatches({ id })` and `get_common_mistakes({ id })` to surface canonical pitfalls the spec should also account for.

This complements `validate_implementation`, which scores generated code; spec-parity scores prose intent.

## Recipe — spec-to-canon parity audit

The compact 5-step form. Use this when scoring a vendor library API description, a design-system RFC, or any prose specification against the canon.

1. `list_components` → enumerate canonical inventory.
2. For each spec entry, `search_components({ query })` to find the canon match (try the spec's own name and known aliases like `Snackbar` → Toast, `Dialog` → Modal).
3. For each match, `get_component({ id })` (deep) to retrieve the full record in one round-trip.
4. Diff axes, variants, slots, events between the spec and the canonical record.
5. Output a mismatch table grouped by severity — critical (missing required slot / event / state), drift (renamed value, wrong polarity), naming (alias not declared).

Pair with `get_mismatches({ id })` and `get_common_mistakes({ id })` to surface canonical pitfalls the spec should also account for. The longer walkthrough in *Typical agent flows* above expands each step; the compact form here is the recipe to recall in-flow.

## When to use which tool

`get_component({ id })` returns the full canonical record. Many of the per-axis tools (`get_anatomy`, `get_axes`, `get_motion`, `get_events`, `get_when_to_use`, `get_tokens`, `get_responsive`, `get_transitions`, `get_framework_map`, `get_mismatches`, `get_common_mistakes`, `get_changelog`) are subsets of that same record. They are **not redundant** — they exist for two reasons:

1. **Bandwidth.** Heavy components (Modal, Combobox) emit ~30 KB of JSON when fully serialized. An agent that only needs `axes` to decide a variant pays ~3 KB instead of the whole record. Multiply by N round-trips and the difference matters for context-window budgets.
2. **Discovery.** A focused tool name (`get_motion`) signals intent in tool-call traces; `get_component` followed by an unscoped slice is harder to read in transcripts and harder for the agent to plan around.

Picking between them:

- **Building a new instance from scratch / migrating a library wrapper** → `get_component` once, use the full record as a checklist.
- **Answering one targeted question** ("does Modal have transitions?", "what tokens does Button use?") → the matching per-axis tool. One round-trip, one slice.
- **Comparing 3+ components** → loop `get_component` per id; the per-axis tools repeat metadata you already have.
- **Surfacing role-specific context to a downstream agent** → `get_component_view({ id, view })`. Designer / dev / bridge projections drop everything outside that role.

`get_pattern` is **not** a subset of any component — patterns are independent records (compositions on top of canonical components). Always use `get_pattern` / `list_patterns` / `get_patterns_for_component` for pattern queries.

## First call: load tools

The server returns all 29 tools in a single `tools/list` response — no progressive disclosure, no lazy loading. **Some clients (Claude Code among them) defer per-tool schema-loading regardless** — the agent sees a tool name but cannot invoke it until the schema is fetched, and a direct call fails with `InputValidationError`. Bulk-load the common tools up front to avoid mid-flow latency:

```
ToolSearch query: "select:mcp__uianatomy__get_about,mcp__uianatomy__list_components,mcp__uianatomy__get_component,mcp__uianatomy__search_components,mcp__uianatomy__list_patterns,mcp__uianatomy__get_pattern,mcp__uianatomy__get_implementations"
```

Add per-axis tools (`get_anatomy`, `get_motion`, `get_events`, `get_contracts`, etc.) as the specific audit flow demands. If your client surfaces fewer than 29 tools at the catalogue level (not the schema level), restart the session and verify the MCP server connection is live; the server itself never withholds tools.

## Library implementations (Phase 2)

Beyond the canon, three library audits ship today (Radix Dialog, Headless UI Dialog, Angular CDK Dialog), each documenting its **divergence** from canonical Modal as `omitted` / `renamed` / `extended` / `reshaped` entries.

Use `list_implementations` for an inventory and `get_implementations({ componentId })` for the full audit records for one canonical component. The same data also renders in the Implementations section of every `/components/<id>` page.

## In-browser tools (WebMCP)

When loaded in a browser context, every page on `uianatomy.dev` registers three read-only tools via `navigator.modelContext` per the WebMCP draft, backed by the same JSON APIs:

- `list_components` — calls `/api/components.json`.
- `get_component` — calls `/api/components/{id}.json`.
- `search_components` — fetches the index and substring-filters in-browser.

Available without speaking MCP-over-HTTP, useful for browser-resident agents.

## No-MCP fallback

If a client cannot speak MCP, the same data is available as static JSON:

- `GET https://uianatomy.dev/api/components.json` — index.
- `GET https://uianatomy.dev/api/components/{id}.json` — full canonical schema for one component.
- `GET https://uianatomy.dev/api/components/{id}/a11y-fixture.json` — `keyboardWalk` + `announcements` + `axeRules` for one component, shaped for direct ingestion into Playwright + `@axe-core/playwright` or Jest + `jest-axe`. Includes an `_about` field describing wiring per assertion type.

Pages also serve markdown on `Accept: text/markdown` (with `Content-Type: text/markdown; charset=utf-8` and `x-markdown-tokens` headers); useful for agents that prefer prose context over JSON schemas.

## Authority

Both the website and the MCP server are generated from the same canonical YAML in `content/components/` against a single Zod schema. No separate data store, no drift. Source of truth: <https://github.com/dominikpieper/uianatomy>.
