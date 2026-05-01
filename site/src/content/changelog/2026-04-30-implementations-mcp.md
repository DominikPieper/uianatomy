---
date: "2026-04-30"
title: MCP get_implementations + list_implementations
summary: Phase-2 library audit data now reachable through the MCP server. Three Modal audits today (Radix React, Headless UI Vue, Angular CDK Dialog).
tags: [mcp, phase-2]
---

The MCP server can now answer "how does Radix' Dialog diverge from canonical Modal?" without falling back to the JSON API.

Two new tools land:

- `list_implementations` returns one row per `{libraryId, componentId}` pair with `divergenceCount` + `lastReviewed`, sorted by library then component.
- `get_implementations(componentId)` returns every library audit for that canonical component as full `Implementation` records — `componentId`, `libraryId`, `componentName`, `exampleCode`, `divergence` list, `rationale`, `lastReviewed`. Empty array when no library has audited the component yet.

The implementations bundle ships at build time as `shared/dist/implementations-bundle.json` (~150KB across the three current Modal audits). Worker cold-start re-validates it through the same Zod schema the site uses, so the MCP and HTML pages can never disagree on shape.

Tool count moves to 17. New `docs/personas.md` documents the four user personas (designer / developer / DS maintainer / AI agent) and tracks gap-closure across feature work going forward.
