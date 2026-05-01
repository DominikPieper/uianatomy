---
date: "2026-04-30"
title: Cloudflare Workers Static Assets migration
summary: Pages auto-deploy started failing on a converging Pages-config surface. Direct migration to Workers Static Assets via wrangler.jsonc + a single Worker handler.
tags: [hosting]
---

Cloudflare Pages began rejecting our auto-deploys with a wrangler-suggestion-template error after recent feature commits. The platform is converging Pages onto Workers Static Assets; rather than chase a moving Pages-config surface, we moved directly to the destination.

`wrangler.jsonc` at the repo root now declares the project (`name`, `compatibility_date`, `compatibility_flags: ["nodejs_compat"]`, `assets: { directory: ./site/dist, binding: ASSETS, run_worker_first: true, html_handling: drop-trailing-slash, not_found_handling: 404-page }`).

`worker/index.ts` consolidates the previous two `functions/` files into a single dispatch handler — `/mcp` → MCP Streamable HTTP transport; otherwise check `Accept: text/markdown` and serve the `.md` sidecar with `x-markdown-tokens` + `Vary: Accept`; otherwise pass through to `env.ASSETS.fetch(request)`.

`run_worker_first: true` is required so the Worker can inspect the `Accept` header on requests for matched assets — without it, content negotiation can't see HTML page requests.

Wrangler bumped 3.114 → 4.87. Custom 404 page renders for unmatched URLs with a Levenshtein-distance "did you mean?" suggestion when the path looks like a typoed component slug.
