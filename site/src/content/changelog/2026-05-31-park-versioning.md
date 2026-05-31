---
date: "2026-05-31"
title: Versioning surface parked
summary: The get_changelog MCP tool and the version/deprecation render were removed after 0/41 components used them. Schema fields stay dormant.
tags: [schema, mcp, site]
---

The opt-in versioning metadata from 2026-05-01 (ADR-023) shipped end-to-end — schema fields, an MCP tool, and a render surface — but in the month since, no canonical component populated `since`, `changelog`, `deprecated`, or `axes.variantDeprecations`. Carrying an unexercised lifecycle costs every schema and review pass, so the *live surface* is parked.

**Removed.** The `get_changelog` MCP tool (it returned `null` for all 41 components), and the render: the hero `since` pill, the view-agnostic changelog section, and the per-slot / per-variant / per-property deprecation badges in the anatomy and axes tables.

**Kept.** The schema fields stay (optional, dormant), and [ADR-023](https://github.com/DominikPieper/uianatomy/blob/main/docs/adr/023-versioning.md) plus the Versioning section of the schema docs remain the design record. The tool and render return the day a component lands its first real published change.
