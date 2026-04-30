# ADR 021: Host on Cloudflare Pages

**Status:** Superseded by ADR-022 (the project moved from Cloudflare Pages to Cloudflare Workers Static Assets on 2026-04-30 after Pages auto-deploy started failing during the wrangler-4 / Workers Static Assets convergence).
**Date:** 2026-04-30

## Context

ADR-002 chose Netlify for hosting "to consolidate with the author's other projects." ADR-003 deployed the MCP server as a Netlify Function alongside the static site.

The author has decided to move hosting to Cloudflare. The technical surface is small (one static Astro build + one HTTP handler), and the existing handler is already written against Web-standard `Request`/`Response`, so the move is mostly a config swap with one runtime constraint to resolve.

## Decision

- **Host:** Cloudflare Pages, single project, repo root.
- **Site:** unchanged Astro static build, published from `site/dist`.
- **MCP server:** ships as a Cloudflare Pages Function at `functions/mcp.ts`, file-routed to `/mcp`.
- **Workers compatibility:** `compatibility_flags = ["nodejs_compat"]` and `compatibility_date = "2026-04-30"` configured in the Pages Dashboard (Settings → Functions). No root `wrangler.toml` — Wrangler 4's workspace-detection logic refuses to run at a pnpm-workspace root, which broke the Pages CI deploy step. Dashboard config is the source of truth.
- **YAML data delivery on Workers:** YAML files are bundled to JSON at `shared` build time (`shared/dist/content-bundle.json`) and imported by the Pages Function. Local dev and tests still load YAML from disk.

## Rationale

### Single Pages project, MCP co-located

The current setup runs both site and function from the same Netlify config. Mirroring that on Cloudflare keeps DNS, deploys, and previews tied together. Splitting MCP onto its own subdomain stays viable for later (ADR-002 already names this evolution); it does not need to happen during the host migration.

### Pages Function over standalone Worker

Pages Functions auto-mount via file-system routing. `functions/mcp.ts` becomes `/mcp` with no redirect rule. A standalone Worker would add a separate Wrangler project, separate deploy target, and a route rule — overhead with no current benefit at this scale.

### Build-time JSON bundle for component data

Cloudflare Workers do not expose a real filesystem even with `nodejs_compat`. The current loader (`shared/src/loader.ts` → `loadComponents`) calls `readdir` and `readFile`, which would not survive on the Worker runtime.

Two options were considered:

- **(a) Bundle YAML to JSON at build time** — `shared` build emits `dist/content-bundle.json`; Pages Function imports it and reuses Zod validation via a sibling helper `loadComponentsFromBundle()`. ~150 KB inlined, 23 components.
- **(b) Cloudflare static-asset binding** — Function reads YAML at request time via `env.ASSETS.fetch(...)`. Requires refactoring `loadComponents` to take a fetcher abstraction, and adds per-request fetch overhead.

(a) wins: simpler code path, no new abstraction, request handler stays pure. The bundled JSON is already validated; the Function re-validates on warm start as defence in depth. Local dev and the existing 132 vitest cases keep using the fs path.

### `nodejs_compat`

The MCP SDK's `WebStandardStreamableHTTPServerTransport` is web-standard, but transitively pulls Node primitives (`Buffer`, possibly `events`). `nodejs_compat` covers that without extra polyfills.

## Consequences

**Positive**

- Site half migrates without code changes.
- Same `/mcp` path; MCP clients (e.g. Claude Desktop) need no reconfiguration once DNS is cut over.
- Pages Function cold start (~50–200 ms) is competitive with Netlify Function cold start (~200–500 ms quoted in ADR-003).
- Pages free tier (100 k Function invocations/day, unlimited static) covers expected traffic.

**Negative**

- Two loader paths in `shared` (fs vs bundle); both must validate against the same Zod schema. A test asserts equivalence on every component.
- Schema or content changes must rebuild the bundle before Pages Function picks them up — the build script chain handles this (`pnpm --filter @uianatomy/shared build` runs `tsc` then the bundler).
- `@netlify/functions` devDep removed; if the project ever returns to Netlify, it has to come back.

**Neutral**

- Standalone Worker / dedicated subdomain remains a future option.
- DNS cutover is a separate, deliberate user action — not automated by this ADR.

## Implementation notes

```
repo/
├── content/components/        # YAML, source of truth (unchanged)
├── shared/
│   ├── src/bundle.ts          # loadComponentsFromBundle()
│   └── scripts/bundle-content.mjs   # emits dist/content-bundle.json
├── mcp-server/                # Netlify dir gone; src/ unchanged
├── functions/
│   └── mcp.ts                 # Pages Function entry, /mcp
├── site/                      # unchanged
└── (no netlify.toml, no root wrangler.toml — see Dashboard config below)
```

Cloudflare Pages Dashboard configuration (no root `wrangler.toml`):

- **Settings → Builds & deployments**
  - Framework preset: **None**
  - Build command: `pnpm install --frozen-lockfile && pnpm --filter @uianatomy/shared build && pnpm --filter site build`
  - Build output directory: `site/dist`
  - Root directory: empty (repo root)
- **Settings → Functions**
  - Compatibility date: `2026-04-30`
  - Compatibility flags: `nodejs_compat` — set for both Production and Preview
- **Settings → Environment variables** (Production + Preview)
  - `NODE_VERSION=22`
  - `PNPM_VERSION=9.12.0`

A root `wrangler.toml` was tried first, but Wrangler 4.x's workspace-detection logic refuses to run any command (including `wrangler pages deploy`) at the root of a pnpm workspace. CF Pages CI invokes Wrangler internally, so the deploy step failed with `The Wrangler application detection logic has been run in the root of a workspace`. Removing root `wrangler.toml` and configuring everything via the Dashboard avoids the detection path entirely. Functions in `functions/` are still auto-mounted by Pages without a config file.

Local verification:

```sh
pnpm --filter @uianatomy/shared build
pnpm --filter site build
pnpm exec wrangler pages dev site/dist --compatibility-flags=nodejs_compat
curl -sX POST http://localhost:8788/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Alternatives considered

- **Stay on Netlify.** Rejected by user direction.
- **Cloudflare Workers (standalone) for MCP, Cloudflare Pages for site.** Two deploy targets, two config files, marginal benefit. Re-evaluate when MCP needs an independent subdomain.
- **Vercel.** Not requested. Functions runtime model is similar; same YAML-on-Workers question would apply.
