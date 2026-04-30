# ADR 022: Host on Cloudflare Workers (Static Assets)

**Status:** Accepted (supersedes ADR-021)
**Date:** 2026-04-30

## Context

ADR-021 chose Cloudflare Pages with a co-located Pages Function at `functions/mcp.ts`. After several feature commits landed (markdown content negotiation middleware, OG image endpoint, expressive-code, broken-links checker), the Pages auto-deploy pipeline began failing with a wrangler 4 message asking us to add a wrangler config — the platform appears to be converging Pages onto Workers Static Assets, and our minimal-config Pages setup no longer matches what the deploy runner expects.

Rather than chase the Pages config surface as it shifts, move directly to the model the platform is converging on: **Cloudflare Workers with the Static Assets binding**. It serves the same static `site/dist`, hosts a single Worker entry that handles both `/mcp` and the markdown-negotiation middleware, and is configured via a checked-in `wrangler.jsonc` at the repo root.

## Decision

- **Host:** Cloudflare Workers (Static Assets), single Worker named `uianatomy`, configured by `wrangler.jsonc` at the repo root.
- **Static assets:** unchanged `astro build` output published from `site/dist`, served by the platform via the `ASSETS` binding.
- **Worker entry:** `worker/index.ts` consolidates the two handlers that previously lived under `functions/`:
  - `/mcp` — Streamable-HTTP MCP transport, unchanged module-level bundle init.
  - Markdown content negotiation — on `Accept: text/markdown`, fetches the matching `.md` sidecar via `env.ASSETS.fetch()` and re-emits it with `Content-Type: text/markdown` plus `x-markdown-tokens`.
- **`assets.run_worker_first: true`** — the Worker sees every request before the static-asset server. Required because the markdown negotiation needs to inspect the `Accept` header on requests for HTML pages, which the asset server would otherwise serve directly without invoking the Worker.
- **Compatibility:** `compatibility_date = "2026-04-30"` and `compatibility_flags = ["nodejs_compat"]` live in `wrangler.jsonc`, no longer in the dashboard. The Wrangler 4 "workspace-root" detection problem from ADR-021 is gone — `wrangler.jsonc` is treated as a regular config file by current Wrangler.
- **Deploy:** `pnpm deploy` runs `wrangler deploy`. The Pages-specific `wrangler pages deploy` invocation is dropped.
- **Local dev for the deployed surface:** `pnpm dev:worker` runs `wrangler dev`, which serves both the Worker and the static assets exactly as production does. `pnpm dev` is unchanged and still runs `astro dev` for component / styling work.

## Rationale

### Workers Static Assets is what Pages is becoming

The error that triggered this migration ("Failed: error occurred while running deploy command" with a wrangler-suggested `wrangler.json` template containing `assets.directory`) is the platform asking for the Workers Static Assets shape. Running ahead of that convergence — instead of patching a Pages config that the platform is moving away from — minimises future-proofing work.

### One Worker, two handlers, one config file

The Worker entry is small and reads top-down: dispatch by path. `/mcp` goes to the MCP transport; everything else either returns a markdown sidecar (when `Accept: text/markdown` and the URL maps to an `.md` artifact) or falls through to `env.ASSETS.fetch(request)`. There is no router framework, no separate config per handler. The same Cache-Control and routing rules in `site/public/_headers` continue to apply (Workers Static Assets honors `_headers` and `_redirects`).

### `run_worker_first: true` over manual route exclusions

The alternative is to leave `run_worker_first: false` and add explicit Worker routes for `/mcp` and a long list of HTML paths. That requires re-listing every route the markdown middleware should intercept, and any new HTML page would silently bypass the middleware. `run_worker_first: true` flips the default — Worker sees every request, and the Worker decides whether to delegate to `ASSETS`. The cost is one extra Worker invocation per request, which is negligible at this site's scale.

### Config-as-code in `wrangler.jsonc`

ADR-021 deliberately kept config in the Pages Dashboard because Wrangler 4 refused to run at a pnpm-workspace root. That constraint no longer holds with the Workers Static Assets path; `wrangler.jsonc` works at the repo root. Checking config in is preferable: the compatibility flags and asset directory now live next to the code instead of an out-of-band web UI.

### MCP server still co-deployed

ADR-002's "future evolution: split MCP off to its own subdomain" remains an option. There is still no current benefit to splitting — DNS, deploys, and previews stay tied together with the co-deploy pattern. Workers makes the eventual split slightly easier (a separate Worker is a natural next step) but does not force it.

## Consequences

- **Deletion:** the `functions/` directory is removed. Its two files (`functions/mcp.ts` and `functions/_middleware.ts`) are merged into `worker/index.ts`.
- **Wrangler bumped 3 → 4** in root `devDependencies`. `@cloudflare/workers-types` added at root for Worker code typing.
- **Dashboard config moved into the repo.** The Pages-side compatibility flags / functions settings are no longer the source of truth.
- **CI unchanged.** The GitHub Actions workflow runs `pnpm -r build`, which writes `site/dist`. Cloudflare auto-deploys from main; the only change is that auto-deploy now runs `wrangler deploy` (Workers) instead of `wrangler pages deploy` (Pages).
- **Local-dev story split.** `pnpm dev` is still Astro dev for component / styling work. `pnpm dev:worker` is `wrangler dev` against built `site/dist` for testing the deployed surface end-to-end (`/mcp`, markdown negotiation, headers).

## Verification

- `pnpm exec wrangler deploy --dry-run` shows the Worker bundles cleanly and ASSETS reads `421` files from `site/dist`.
- `pnpm exec wrangler dev` against built `site/dist` confirms:
  - HTML default: `200` `text/html` on `/components/modal/`.
  - Markdown negotiation: `Accept: text/markdown` returns `200 text/markdown; charset=utf-8` plus `x-markdown-tokens` and `Vary: Accept`.
  - MCP transport: `POST /mcp` with `Accept: application/json, text/event-stream` returns the MCP `tools/list` response over SSE.
  - OG image endpoint: `GET /og/components/modal.png` returns `200 image/png`.
  - Static `.well-known/*` responses unchanged (`mcp/server-card.json`, `agent-skills/index.json`, `api-catalog`, SKILL.md).
  - Custom 404 page served on unmatched paths with proper `404` status.
- 132 vitest cases, `astro check`, and the build pipeline (broken-link-checker, llms-md, og-canvas) all pass.
