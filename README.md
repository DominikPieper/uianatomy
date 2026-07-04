# UI Anatomy

A canonical reference for UI component anatomy — one page per component, with a Designer/Dev role lens (ADR-038).

See [`docs/README.md`](./docs/README.md) for the full pitch and [`docs/CLAUDE.md`](./docs/CLAUDE.md) for contributor orientation.

## Repo layout

```
content/components/   # canonical YAML (ADR-004)
implementations/      # per-library implementations (Phase 2+)
shared/               # Zod schema, YAML loader, anatomy SVG generator
site/                 # Astro 6 static site (ADR-002, ADR-022)
mcp-server/           # MCP server core (ADR-003) — invoked by worker/index.ts
worker/               # Cloudflare Worker entry — /mcp + markdown negotiation (ADR-022)
docs/                 # canon: README, methodology, schema, views, roadmap, ADRs
```

## Local development

```sh
pnpm install
pnpm dev          # runs the Astro site on http://localhost:4321
pnpm -r test
pnpm -r typecheck
```

## Status

Phase 1 + Phase 2 audit infrastructure complete. Canon at 41 components covering input / disclosure / overlay / data-pattern / feedback surfaces (full roster in `content/components/`). Phase 2 implementation audits cover modal + tabs + accordion + drawer + combobox + select × radix / headlessui / cdk / vaul (18 yamls across 4 libraries). MCP server exposes 26 tools over the canon plus the implementation audits. See [`docs/roadmap.md`](./docs/roadmap.md) for the original phased plan and [`docs/backlog.md`](./docs/backlog.md) for the live workflow state.
