---
name: uianatomy-mcp
description: Query the UI Anatomy MCP server for canonical UI component anatomy, axes, slots, transitions, motion, tokens, events, and cross-framework mapping.
---

# UI Anatomy — MCP skill

UI Anatomy publishes a canonical, library-agnostic reference for common UI components (Button, Card, Modal, Tabs, Combobox, Drawer, …). Each component declares its **anatomy** (slots and regions), **axes** (variants, properties, states, transitions), **mismatches** between Figma and code, **common mistakes**, **cross-framework mapping**, **tokens**, **motion**, **responsive** notes, **events**, and **when to use vs. when to avoid**.

The MCP server exposes this knowledge as 15 read-only tools.

## Endpoint

- URL: `https://uianatomy.dev/mcp`
- Transport: Streamable HTTP (`@modelcontextprotocol/sdk` ≥ 1.29)
- Auth: none (public read-only)
- Server card: `https://uianatomy.dev/.well-known/mcp/server-card.json`

## Tools

| Tool | Returns |
|------|---------|
| `list_components` | All canonical components (id, name, description). |
| `search_components` | Substring match across id/name/description/slots/variants. |
| `get_component` | Full canonical schema for one component. |
| `get_component_view` | Role-specific projection — `designer` / `dev` / `bridge`. |
| `get_anatomy` | Slot/region definitions only. |
| `get_axes` | Variants, properties, and states only. |
| `get_mismatches` | Documented Figma ↔ code misalignments. |
| `get_common_mistakes` | Documented implementation errors and the fixes. |
| `get_framework_map` | Cross-framework expression mapping (web components / React / Angular signals / Vue). |
| `get_tokens` | Per-slot token bindings (`spacing`, `radius`, `color`, `elevation`, `typography`). Returns `null` when the component declares none. |
| `get_motion` | Motion block (durations, easing, reduced-motion fallback). `null` if absent. |
| `get_responsive` | Responsive breakpoints. `null` if absent. |
| `get_transitions` | State-machine transitions (`from` / `to` / `trigger`). `null` if absent. |
| `get_events` | Events array (name, payload, per-framework notes). `null` if absent. |
| `get_when_to_use` | `use` / `avoid` prose plus related-component differentiators. |

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

## No-MCP fallback

If a client cannot speak MCP, the same data is available as static JSON:

- `GET https://uianatomy.dev/api/components.json` — index.
- `GET https://uianatomy.dev/api/components/{id}.json` — full canonical schema for one component.

## Authority

Both the website and the MCP server are generated from the same canonical YAML in `content/components/` against a single Zod schema. No separate data store, no drift. Source of truth: <https://github.com/dominikpieper/uianatomy>.
