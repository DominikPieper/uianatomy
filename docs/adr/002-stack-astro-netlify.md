# ADR 002: Astro + Netlify + Standalone MCP Server

**Status:** Superseded by [ADR-021](./021-host-cloudflare-pages.md) (hosting moved to Cloudflare Pages 2026-04-30). Astro + standalone MCP server decisions still hold.
**Date:** 2026-04

## Context

UI Anatomy is a content-driven, mostly-static documentation site with these requirements:

- ~30 component pages, each with three switchable views and an anatomy diagram
- Data lives in YAML files, consumed type-safely
- Global view switcher with localStorage persistence and accent-color shift
- An MCP server exposing the same data for AI assistants
- A static JSON API for programmatic consumers
- Low maintenance; built as a side project alongside other work
- Public hosting

## Decision

- **Frontend:** Astro 5+ with Content Collections
- **Styling:** CSS Custom Properties (for accent-color theming) + Tailwind for utilities
- **Content:** YAML in `content/components/`, validated with Zod
- **Schema:** shared Zod schemas in a `shared/` workspace package
- **MCP server:** standalone Node service using `@modelcontextprotocol/sdk`, deployed as Netlify Functions
- **Hosting:** Netlify for both site and MCP server (consolidated with Dominik Pieper's other projects)
- **Repo structure:** monorepo with pnpm workspaces

## Rationale

### Astro

Astro's Content Collections are purpose-built for YAML-driven sites with type-safe consumption via Zod. Static rendering by default delivers excellent performance with no configuration. The Islands architecture means the global view switcher can hydrate as a small interactive component while the rest of the page stays static — no full SPA framework overhead for what is fundamentally documentation.

Astro can output both HTML and JSON from the same data source, satisfying the static API requirement without a separate build step.

Alternatives considered:

- **Next.js:** overkill for a static documentation site; brings React routing complexity that's unused
- **VitePress:** Markdown-first, fights against YAML-driven generated pages
- **Docusaurus:** designed for traditional API-style technical docs; overweight for curated reference content
- **Pure Vite + custom:** removes pre-built content infrastructure with no benefit
- **Angular (with Analog.js):** familiar to author, but a worse fit for content-driven static sites; bundle size and SSG ergonomics are weaker

### Netlify

Dominik Pieper already hosts Atelier UI on Netlify. Consolidating reduces operational overhead — one dashboard, one billing relationship, one CLI. The technical advantages of Cloudflare Workers for MCP server hosting (better templates, lower cold-start latency) are real but small at this project's scale (~7 tools, kilobytes of YAML data, light traffic).

The operational benefit of "one provider" outweighs the marginal technical benefit of mixing providers, especially for a side project where reducing context switches matters.

### Standalone MCP server (not embedded in Astro)

The MCP server is a separate process from the Astro build. Both read the same YAML files via the same Zod schemas (shared package), but they deploy independently:

- Astro builds the site, generating HTML and JSON files
- The MCP server is a Netlify Function that handles MCP protocol requests over streamable HTTP

Embedding the MCP server in Astro's server endpoints would force Astro into SSR mode for what is otherwise a static site, and would couple two concerns that benefit from being independent.

### Monorepo

Two separate repositories were considered. A monorepo wins because:

- The Zod schema must be shared between site and server; copy-paste-sync is fragile
- A single source-of-truth `content/` directory is read by both
- A single PR can update schema, content, site rendering, and server response in one atomic change

pnpm workspaces with explicit packages (`site/`, `mcp-server/`, `shared/`) keeps boundaries clean.

## Consequences

**Positive:**

- Fast initial setup — Astro and Netlify are both known quantities
- Type safety end-to-end: YAML → Zod → Astro Content Collections / MCP Server
- Site and server deploy independently; updates don't block each other
- Operational simplicity — one provider for hosting

**Negative:**

- Netlify Functions have cold starts (~200–500ms first request after idle); acceptable for MCP use cases but not zero
- Astro community is smaller than Next.js; less Stack Overflow coverage
- Monorepo configuration requires some care (pnpm workspaces, Netlify multi-site setup)

**Neutral:**

- If a future need arises for live-rendered components or richer interactivity, Astro can add islands without replatforming
- MCP server can be moved to a different host later if needed (it's protocol-portable)

## Implementation notes

```
repo/
├── content/
│   └── components/         # YAML, the source of truth
├── site/                   # Astro
├── mcp-server/             # Netlify Function with @modelcontextprotocol/sdk
├── shared/
│   └── schema.ts           # Zod schemas, imported by both
├── docs/                   # this directory
├── netlify.toml            # multi-site config
└── pnpm-workspace.yaml
```
