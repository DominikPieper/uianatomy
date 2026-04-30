# UI Anatomy

A canonical reference for UI component anatomy — the same truth, in three views (Designer / Dev / Bridge).

See [`docs/README.md`](./docs/README.md) for the full pitch and [`docs/CLAUDE.md`](./docs/CLAUDE.md) for contributor orientation.

## Repo layout

```
content/components/   # canonical YAML (ADR-004)
implementations/      # per-library implementations (Phase 2+)
shared/               # Zod schema, YAML loader, anatomy SVG generator
site/                 # Astro 6 static site (ADR-002, ADR-021)
mcp-server/           # MCP server, Cloudflare Pages Function (ADR-003, ADR-021)
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

Phase 1 — scaffolded with Card as the first canonical component. See [`docs/roadmap.md`](./docs/roadmap.md).
