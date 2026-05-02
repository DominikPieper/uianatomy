---
name: uianatomy-mcp
description: Query the UI Anatomy MCP server for canonical UI component anatomy, axes, slots, transitions, motion, tokens, events, cross-framework mapping, library divergences, and compositional patterns.
---

# UI Anatomy — MCP skill

UI Anatomy publishes a canonical, library-agnostic reference for common UI components (Button, Card, Modal, Tabs, Combobox, Drawer, …). Each component declares its **anatomy** (slots and regions), **axes** (variants, properties, states, transitions), **mismatches** between Figma and code, **common mistakes**, **cross-framework mapping**, **tokens**, **motion**, **responsive** notes, **events**, and **when to use vs. when to avoid**.

The MCP server exposes this knowledge as 22 tools.

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
| `list_components` | — | All canonical components (id, name, description). |
| `search_components` | `query: string` | Substring match across id/name/description/slots/variants. |
| `get_component` | `id: string` | Full canonical schema for one component. |
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
| `list_patterns` | — | Every canonical pattern (compositions of canonical components) with `id`, `name`, `description`, the unique `componentId` set composed, and `lastReviewed`. |
| `get_pattern` | `id: string` | Full canonical pattern record (composition, whenToUse, decisions, mistakes, frameworkSkeletons, lastReviewed). |
| `get_patterns_for_component` | `componentId: string` | Every pattern that composes the given canonical component, sorted by pattern name, with the role this component plays. Empty array when no pattern uses it. |
| `list_implementations` | — | Every Phase-2 library audit (one row per library/component pair) — `libraryId`, `componentId`, `componentName`, `divergenceCount`, `lastReviewed`. Sorted by `libraryId` then `componentId`. |
| `get_implementations` | `componentId: string` | Every library audit for one canonical component as an array of `Implementation` records (`componentId`, `libraryId`, `componentName`, `exampleCode`, `divergence` list, `rationale`, `lastReviewed`). Empty array when no library has audited the component yet. |
| `validate_implementation` | `componentId: string`, `code: string`, `framework: "react" \| "vue" \| "angular" \| "webComponents"` | Heuristic structural conformance check. Reports which canonical required slots, variants, properties, and events appear (or are missing) in the supplied code. Framework-aware event-name detection (`on<PascalCase>` for React, `@event` / `v-on:` / `emit('event')` for Vue, `(event)` for Angular, bare names for web components). Substring search only — false negatives possible. NOT a substitute for behavioural assertions (pair with the per-component a11y-fixture endpoint and a real Playwright + axe-core run). |

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
