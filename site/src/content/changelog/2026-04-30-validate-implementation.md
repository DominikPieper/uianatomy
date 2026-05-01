---
date: "2026-04-30"
title: MCP validate_implementation tool
summary: Heuristic structural conformance check for AI-generated UI code against canonical anatomy / axes / events. Framework-aware event detection.
tags: [mcp, agent]
---

Closes the developer + AI-agent gap from `docs/personas.md`: agents now have a way to self-verify generated UI code against the canon without standing up a full test runner.

`validate_implementation({ componentId, code, framework })` does framework-aware substring detection — `on<PascalCase>` for React, `@event` / `v-on:` / `emit('event')` for Vue, `(event)` for Angular, bare names for web components — and reports which canonical required slots, variants, properties, and events appear in the supplied code (and which are missing).

This is **not** a substitute for behavioural assertions. The tool ships with an explicit caveat in its schema: substring search produces false negatives on aliased or minified identifiers. Pair with the per-component a11y-fixture endpoint and a real Playwright + axe-core run.

Tool count moves to 18. New backing utility at `shared/src/validate.ts` exported via `@uianatomy/shared/validate`.
