# MCP server evaluation harness

Measures the **usability** of the UI Anatomy MCP tools the way the
[`mcp-builder`](https://github.com/anthropics/skills/tree/main/skills/mcp-builder)
skill prescribes: can an LLM, given *only* these tools and no other context,
answer realistic multi-hop questions over the canon? Quality here is about the
tool surface (names, descriptions, input/output schemas), not the code.

## Files

- `evaluation.xml` — 10 read-only, stable, multi-hop questions, each with a
  single verifiable answer (derived by aggregating across the canon and
  re-checked against the bundles). See `reference/evaluation.md` in the skill
  for the authoring rules.
- `evaluation.py` + `requirements.txt` — the skill's harness (verbatim copy).
  It launches the server, lets Claude drive the tools per question, and scores
  answers by comparison.

## Run

The harness targets the local **stdio** entry (`src/local.ts` → `dist/local.js`),
so no deploy is needed.

Prerequisites: **Python ≥ 3.10** (the `mcp` package requires it; the harness
will not run on 3.9), an `ANTHROPIC_API_KEY` (the run bills the API), and a
current model — the harness still defaults to the retired
`claude-3-7-sonnet-20250219`, so pass `-m claude-sonnet-4-6`.

```bash
# from repo root
pnpm -F @uianatomy/mcp-server build          # produces dist/local.js
pip install -r mcp-server/eval/requirements.txt   # anthropic, mcp
export ANTHROPIC_API_KEY=sk-...

python mcp-server/eval/evaluation.py \
  -t stdio -c node -a mcp-server/dist/local.js \
  -m claude-sonnet-4-6 \
  -o mcp-server/eval/report.md \
  mcp-server/eval/evaluation.xml
```

To run against the deployed Cloudflare Worker instead of stdio:

```bash
python mcp-server/eval/evaluation.py \
  -t http -u https://<deployed-host>/mcp \
  -m claude-sonnet-4-6 \
  -o mcp-server/eval/report.md \
  mcp-server/eval/evaluation.xml
```

## Reading the report

`report.md` reports accuracy, average tool-calls per task, and — most usefully
— the agent's per-task **feedback on the tools**. Low accuracy is a signal to
sharpen a tool description or output schema, not to soften the question. When
canon changes (new components/audits/patterns), re-verify the answers before
trusting a regression.
