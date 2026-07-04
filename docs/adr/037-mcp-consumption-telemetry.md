# ADR 037: Counts-Only Telemetry on the MCP Endpoint

**Status:** Accepted
**Date:** 2026-07
**Supersedes:** none (scopes an existing rule; does not reverse it)
**Related:** Design-review 2026-07-03 (P6-206), [`docs/CLAUDE.md`](../CLAUDE.md) §"Working on the site"

## Context

`docs/CLAUDE.md` instructs: under "Working on the site," resist "adding analytics or tracking." That rule was written for the human-facing Astro pages — the reference site a person browses — and it has held: `site/src/` has zero analytics scripts, zero tracking pixels, zero third-party beacons. That discipline should not change; a reference about good UI should not itself nag its readers with instrumentation.

The MCP endpoint (`/mcp` in `worker/index.ts`) is a different surface serving a different audience: AI agents calling 20 read-only tools, not humans reading pages. The 2026-07-03 design review's strategy pass identified this surface as the project's central open question — one corpus, two consumers (human site, agent MCP) — with zero data on which consumer actually uses what. `docs/backlog.md`'s own "Empfohlener Pfad" narrative repeatedly cites *build-ahead-of-demand* as the project's core risk (the 2026-05-31 review's top finding), and this endpoint is the one place that risk could actually be measured: which of the 20 tools do agents call, which components do they ask about, does the `get_component_section` slice tool get used or does everyone just fetch the full record anyway? Today none of this is answerable — not because measuring it would violate the site's simplicity principle, but because nobody scoped an exception to it for a surface the principle was never written to cover.

## Decision

Add counts-only telemetry to the `/mcp` route exclusively — no human-facing route is touched, and the existing zero-analytics posture on `site/src/` pages is unchanged and unaffected by this ADR.

Each `tools/call` JSON-RPC request handled by `handleMcp()` in `worker/index.ts` writes one data point to a Cloudflare Analytics Engine dataset:

```ts
interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  MCP_ANALYTICS?: AnalyticsEngineDataset;
}

async function recordToolCall(env: Env, toolName: string, subjectId: string | undefined): Promise<void> {
  try {
    env.MCP_ANALYTICS?.writeDataPoint({
      blobs: [toolName, subjectId ?? ''],
      indexes: [toolName],
    });
  } catch {
    // Telemetry must never break the actual MCP response.
  }
}
```

`blobs` carries the tool name and a best-effort subject id (`arguments.id` / `arguments.componentId` / first of `arguments.ids`, when the tool's input shape has one — omitted otherwise). Analytics Engine timestamps every data point automatically, so no explicit date field is written; querying by time range covers "date." No request body, no arguments beyond the one best-effort id, no client identifiers, no IP, no user-agent — nothing that identifies *who* is asking, only *what* was asked. The write is fire-and-forget: a failure (missing binding in a preview environment, dataset not yet provisioned, transient error) is swallowed and never affects the MCP response.

`wrangler.jsonc` gains the binding:

```jsonc
"analytics_engine_datasets": [
  { "binding": "MCP_ANALYTICS", "dataset": "uianatomy_mcp_calls" }
]
```

## Rationale

**Why the site's zero-analytics rule doesn't cover this.** That rule's stated concern is the human reading experience — a reference site should not track its readers, full stop. Nothing about that concern applies to a machine calling a documented, read-only tool API; there is no reader to protect from surveillance, and the tool schemas themselves already tell an agent exactly what data it's exchanging. This ADR does not reverse or loosen the site rule — it draws the boundary the original rule left implicit, so future contributors don't have to guess whether "the site" in `docs/CLAUDE.md` was meant to reach the MCP transport too.

**Why counts-only, not full request logging.** Full logging (arguments, response bodies, timing) would answer more questions but at a privacy and storage cost disproportionate to what's needed. The single question this ADR exists to answer — which tools and which components see real traffic — only needs a name and a count. Anything richer is a second decision this ADR deliberately does not make.

**Why Analytics Engine and not a general logging/APM service.** It is a Cloudflare-native binding with no new vendor, no new account, no egress cost, and it fits the project's existing zero-infrastructure posture (`wrangler.jsonc` observability is already `enabled: true` for standard Workers logs; this adds one more binding of the same character).

## Consequences

**Positive:**
- The project gets its first real signal on the agent-surface half of the "one corpus, two consumers" bet — directly answers the design review's and the 2026-05-31 review's shared finding that the backlog is currently taste-driven, not demand-driven.
- Future decisions about which sections deserve `get_component_section` slice coverage, which tools to deprecate, or where the `get_review_checklist` composite (P6-207) would pay off most can be made from data instead of guesswork.
- Zero migration cost, zero effect on the human site, reversible by removing the binding.

**Negative:**
- Analytics Engine data isn't queryable from within this codebase — reading it back requires the Cloudflare dashboard or the GraphQL Analytics API, which is outside this repo's tooling. This ADR only covers *writing* telemetry; building a query/dashboard workflow is a follow-up, not part of this decision.
- A `/mcp` request that isn't valid JSON, or that uses a transport feature this parser doesn't anticipate (e.g. a batched JSON-RPC array), is silently uncounted rather than erroring — acceptable, since telemetry accuracy is a nice-to-have, not a correctness requirement, and the fire-and-forget `try/catch` exists specifically to keep it that way.

## Alternatives considered

**Extend the rule to say "never add analytics anywhere," explicitly including MCP.** Rejected — this forecloses the one measurement that could resolve the project's stated top open risk, for a surface the original concern (protecting human readers from tracking) does not apply to.

**Full request/response logging for richer analysis.** Rejected for now — disproportionate to the question being asked (see Rationale); revisit only if counts-only proves insufficient to answer a specific follow-up question.

**Client-side WebMCP instrumentation (the in-browser tools registered via `navigator.modelContext`).** Out of scope for this ADR — those tools call the same `/api/*.json` endpoints the static site already serves with no telemetry, and instrumenting them would touch the human-site surface this ADR explicitly leaves alone.
