# ADR 003: MCP Server Architecture

**Status:** Accepted (deployment target updated by [ADR-022](./022-host-cloudflare-workers.md): now a Cloudflare Worker handler at `worker/index.ts`. Architecture — standalone server, web-standard HTTP, shared YAML schema — unchanged.)
**Date:** 2026-04

## Context

A core part of UI Anatomy's value proposition is being consumable by AI assistants and tooling, not just by human readers. The Model Context Protocol (MCP) is the natural mechanism for this: AI assistants like Claude can connect to MCP servers and call tools that return structured data.

The architecture needs to:

- Expose component anatomies, mismatches, mistakes, and framework maps as queryable tools
- Stay in sync with the human-facing site (no separate data store)
- Be cheap to host and maintain
- Be replaceable / portable if hosting changes

## Decision

A standalone MCP server, deployed as a Cloudflare Worker handler at `worker/index.ts` (history: Netlify Function → ADR-021 Cloudflare Pages Function → ADR-022 Cloudflare Workers Static Assets), that reads the same component data the site reads via the same shared Zod schemas. On Workers the data is loaded from a build-time JSON bundle; locally it still loads from the YAML source.

The server uses `@modelcontextprotocol/sdk` (the official TypeScript SDK) and exposes the protocol over streamable HTTP.

## Tools exposed

| Tool                          | Purpose                                                |
|-------------------------------|--------------------------------------------------------|
| `list_components()`           | All component IDs and names                            |
| `get_component(id)`           | Full canonical definition for a component              |
| `get_component_view(id, view)`| A specific view (designer/dev/bridge)                  |
| `get_anatomy(id)`             | Just the anatomy section                               |
| `get_axes(id)`                | Variants/properties/states only                        |
| `get_mismatches(id)`          | Figma↔Code translation issues only                     |
| `get_common_mistakes(id)`     | Common implementation errors only                      |
| `get_framework_map(id)`       | Cross-framework expression                             |
| `search_components(query)`    | Fuzzy match across all components                      |

The granular tools (`get_anatomy`, `get_axes`, etc.) exist alongside `get_component` because LLM consumers benefit from being able to fetch only the slice they need rather than the entire blob. This reduces token usage and improves response quality.

## Data flow

```
YAML files (content/components/*.yaml)
    │
    ├──> [Site build] ──> Static HTML + Static JSON API
    │
    └──> [MCP Server] ──> MCP protocol over HTTP
              │
              └── reads YAML at request time (or at startup with cache)
```

Both consumers read the same YAML through the same Zod schema. Drift between site and server is prevented at the data layer, not by discipline.

## Caching

The server reads YAML files at startup and caches parsed results in memory. Files are small enough (~5KB each, ~30 components → ~150KB total) that the entire dataset fits comfortably. Re-reads happen on cold start.

Netlify Functions cold-start ~200–500ms; subsequent requests within the warm period are fast. For MCP use cases (AI assistants making tool calls during a conversation), this latency is invisible compared to LLM inference time.

## Schema validation

All YAML is validated against the Zod schema at build time and at server startup. Invalid YAML fails the build (for the site) and fails server startup (for the MCP server). This catches schema violations before they reach consumers.

## Authentication

None for now. The data is intended to be public and read-only. If write operations are added later (unlikely — this is curated content), authentication will be reconsidered.

## Rate limiting

Netlify Functions have built-in rate limits that apply to free-tier deployments. For an MCP server consumed primarily by AI assistants making bounded tool calls during conversations, these limits are sufficient.

If the server sees abuse or unexpected traffic, Cloudflare can be put in front for additional rate limiting without changing the server itself.

## Consequences

**Positive:**

- Single source of truth (YAML) shared between site and server
- Server is replaceable — moving to a different host requires no schema or data changes
- Granular tools let LLM consumers fetch precisely what they need

**Negative:**

- Cold starts on Netlify Functions (acceptable, but not zero)
- Two deployment targets to maintain (site + server), though both are simple

**Neutral:**

- Atelier UI's own MCP infrastructure can consume this server, providing a "theory layer" alongside Atelier's component-level documentation

## Future considerations

- A `compare_implementation(id, framework)` tool could be added once implementation audits exist
- A `get_implementation(id, library)` tool would expose specific library audits when those exist
- Streaming responses for large queries are not currently needed but the SDK supports them if scale changes

## Alternatives considered

**MCP server embedded in Astro endpoints:** rejected because it forces Astro into SSR mode for what is otherwise a static site, and couples concerns that should be independent.

**Cloudflare Workers instead of Netlify Functions:** initially rejected per ADR-002; revisited and accepted in ADR-021 (Cloudflare Pages Function).

**Local-only stdio MCP server:** insufficient for the public, AI-assistant-facing use case. May still be added later as a development-time convenience.
