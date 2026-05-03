---
name: mcp-tool-add
description: Add a new tool to the uianatomy MCP server (mcp-server/src/server.ts) — Zod input schema, handler that reads from getComponents/getPatterns/getImplementations state, deterministic output shape, error-path for unknown ids, and a matching test in mcp-server/tests/. Use whenever the user wants a new MCP tool, a bulk-fetch wrapper, an aggregation across canon, or a new query surface for AI agents — phrases like "neues MCP-tool", "add tool to MCP server", "expose X via MCP", "bulk-fetch tool", "aggregation tool", "new tool X". Picks the right naming bucket (list_/get_/search_/validate_), writes consistent error returns, and updates the tool-count in docs/backlog.md and project_state memory.
---

# mcp-tool-add

Codifies the pattern for adding a new MCP server tool. Tool count grew 22 → 25 between 2026-05-01 and 2026-05-03 (P6-66, P6-80, P6-83) — every addition followed the same four-file pattern: server.ts handler + tests + tool-count update + sometimes a vocabulary subpath export.

## When to use

Trigger when the user says any of:

- "neues MCP-tool für …" / "add MCP tool to …"
- "expose <something> via MCP"
- "bulk-fetch tool für …" (precedent: P6-80 `get_components`)
- "aggregate <X> across <Y>" (precedent: P6-83 `get_pattern_a11y_aggregate`)
- "MCP-side query for …"

Do **not** trigger for:

- Schema/field changes (use `schema-field-add`)
- Worker / HTTP-edge changes (different file: `worker/index.ts`)
- Site rendering (no MCP involvement)

## Naming buckets

The 25 existing tools fall into four buckets — match the bucket when naming:

| Bucket | Verb | Examples | Use when |
|---|---|---|---|
| `list_*` | enumerate | `list_components`, `list_patterns`, `list_implementations` | Returns the catalog of available items, usually `[{id, name, description}]` |
| `get_*` | fetch | `get_component`, `get_components`, `get_pattern`, `get_anatomy`, `get_canonical_vocabularies`, `get_pattern_a11y_aggregate` | Returns one or many records by id, or a derived projection |
| `search_*` | filter | `search_components` | Returns a subset matching a predicate |
| `validate_*` | score | `validate_implementation` | Returns pass/fail or scored output |

Bulk-fetch is a `get_*` plural variant returning `{ items, missing }` (P6-80 precedent).

## The four-step cycle

### Step 1: Edit `mcp-server/src/server.ts`

Pattern (all 25 tools follow this exact shape):

```ts
server.tool(
  '<tool_name>',
  '<one-sentence purpose-statement, written for an LLM client to read at tool-discovery time>',
  { <param>: z.<type>(...) },              // Zod input schema; empty object {} for no-args
  async ({ <param> }) => {
    const map = await getComponents();      // or getPatterns / getImplementations
    // ...derive output...
    return jsonResult(<output>);
  },
);
```

Rules:

- **Description**: write for the LLM, not the human. Include input shape, output shape, and the use-case (e.g. "Use this when the agent already knows which components it needs (e.g. comparing 3 components, or hydrating a pattern's composition[].componentId list); avoids N round-trips of get_component."). The description is the only context the calling LLM sees. P6-80's description (~360 chars) is the high-water mark.
- **Input Zod schema**: every parameter typed. Use `z.string()`, `z.array(z.string()).min(1)`, `z.enum([...] as const)`. Do not accept `any`.
- **Output**: always wrap with `jsonResult()` (already imported). Never return raw strings.
- **Errors**: unknown ids return via `notFound(id)` for single-id lookups, or via `{ items, missing: [...] }` for bulk lookups. Never throw — MCP errors must be in-band.
- **Determinism**: sort outputs deterministically. Bulk operations preserve input order; missing ids are alphabetically sorted. Sets are converted to sorted arrays before return.

### Step 2: Add the test in `mcp-server/tests/`

Each tool gets ≥ 2 tests:

- Positive: happy-path with valid input
- Negative: missing/unknown id, invalid enum, empty array

Bulk operations get ≥ 3 tests (positive + missing-id-handling + dedup).
Aggregations get ≥ 3 tests (positive + cross-component edge case + empty-set handling).

Pattern (precedent: `mcp-server/tests/server.test.ts`):

```ts
describe('<tool_name>', () => {
  it('returns the expected shape for known input', async () => {
    const result = await callTool(server, '<tool_name>', { <param>: '<known-value>' });
    expect(result).toMatchObject({ /* ... */ });
  });
  it('handles unknown input', async () => {
    const result = await callTool(server, '<tool_name>', { <param>: '<unknown>' });
    expect(result.isError).toBe(true);  // or check missing[] for bulk
  });
});
```

### Step 3: Run tests and typecheck

```bash
pnpm -r test
pnpm -r typecheck
```

The MCP-server package imports from `@uianatomy/shared` via the workspace alias — if you added a new export there (e.g. P6-66 added `@uianatomy/shared/vocabulary`), build shared first:

```bash
pnpm -F @uianatomy/shared build
```

### Step 4: Update tool-count and docs

- `docs/backlog.md` — flip the originating backlog item `[ ]` → `[x]` with the date + outcome line. Format example from P6-80:
  > `[x] **P6-80 get_components([ids]) bulk-tool** — MCP `get_components({ ids: string[].min(1) })` returnt `{ components, missing }` (request-order erhalten, dedup, missing alphabetisch sortiert). Tool-count 23 → 24. Erledigt 2026-05-03. Datei: \`mcp-server/src/server.ts\`.`
- Project memory (`memory/project_state_2026-MM-DD.md`) — update the tool-count line under "Counters" and the MCP tools mental model paragraph.

## Conventions specific to this server

- **Tools map to user intents, not to data shapes** (`docs/CLAUDE.md`): name `get_anatomy` not `get_field_anatomy`.
- **No separate data store**: every tool reads from `getComponents()` / `getPatterns()` / `getImplementations()`. The state module is the cache; tools never re-load YAML.
- **Cold-start performance**: keep dependencies minimal. No new npm imports without justification.
- **JSON output is the wire format**: `jsonResult(value)` always; the value must be JSON-serializable (no Maps, no Sets at the boundary — convert with `[...map.values()]` or `[...set].sort()`).
- **View projections are first-class** (precedent: `get_component_view`): when the same record is consumed by different audiences, expose a view enum (`'designer' | 'dev' | 'bridge'`) and a `viewProjection` helper. Don't ship multiple near-duplicate tools.
- **Aggregations dedup + tag source** (precedent: P6-83 `get_pattern_a11y_aggregate`): when concatenating data across multiple components, dedup symmetric content (e.g. axeRules — sorted union) and tag asymmetric content with the source id (e.g. keyboardWalk entries get `sourceComponentId: <id>`).

## What not to do

- Do not introduce a tool whose output requires the caller to make a follow-up MCP call to interpret. Tools should be self-sufficient.
- Do not encode component-specific logic in the MCP tool layer. If the canonical YAML can express it, put it there. The tool reads the canon; it does not augment the canon.
- Do not skip the description — the LLM cannot use a tool whose purpose is unclear from the description alone.
- Do not add a tool without a test. The test count is tracked across sessions and is the regression-safety net.
- Do not forget the tool-count update in backlog and project memory. The number is referenced in user-facing answers ("we have 25 MCP tools").

## Final summary template

```
MCP tool added: <tool_name>
Bucket: list_ | get_ | search_ | validate_
Input: <Zod shape>
Output: <shape>
Files touched:
  - mcp-server/src/server.ts (+N/-M)
  - mcp-server/tests/<...>.test.ts (+P tests)
  - docs/backlog.md ([ ] → [x])
  - <memory/project_state_*.md if updated>
Test count: <N> green (was <N-P>).
Tool count: <new total> (was <old total>).
```
