# Roadmap

A pragmatic, phased plan. Phases are sequential — each builds on what's stable from the previous.

## Phase 1: Canonical reference, MVP scope

**Goal:** prove the format works on real components.

**Scope:**

- 5 components fully documented (canonical YAML + rendered pages)
  - **Card** — first component, format-defining
  - **Modal** — validates the schema on a different anatomy
  - **Tabs** — multi-region anatomy with state
  - **Combobox** — first complex component, likely first override SVG
  - **Button** — small but high-traffic; tests that simple components also fit the schema
- Astro site with three views and global view switcher
- MCP server with the core tools (`list_components`, `get_component`, `get_anatomy`, etc.)
- Static JSON API
- Anatomy SVG generator (with override path verified on Combobox)
- Public deployment on Netlify
- Domain and basic visual identity

**Non-goals for Phase 1:**

- Atelier UI integration — the canon must stand alone
- Multiple reference implementations
- Search beyond a basic component index
- Internationalization
- Analytics

**Realistic timeline:** 4–8 weeks as a side project at ~5 hours/week, faster with focused stretches.

**Done when:**

- 5 components live on the site with all three views
- MCP server is reachable and returns valid responses for all tools
- A first external user can navigate the site and explain what it's for without coaching

## Phase 2: First implementation audit (Atelier UI)

**Goal:** prove the canonical reference is useful as an audit tool, and produce findings.

**Scope:**

- Audit each Phase 1 canonical component against Atelier UI's corresponding component
- Document divergences in `implementations/atelier/`
- Produce an audit report (likely a blog post on uianatomy.dev) covering:
  - What Atelier matches well
  - Where Atelier diverges with good rationale
  - Where Atelier diverges without good rationale (i.e., backlog items)
- Render Atelier as the first reference implementation on the site
- Link from each canonical component to its Atelier implementation

**Non-goals for Phase 2:**

- Other reference implementations (Radix, etc.) — one implementation at a time
- Atelier-specific tooling beyond what already exists in Atelier UI's MCP infrastructure

**Realistic timeline:** 2–4 weeks once Phase 1 is stable.

**Done when:**

- Each Phase 1 component has a corresponding `implementations/atelier/<id>.yaml`
- The site renders Atelier as a reference implementation, with divergences clearly visible
- The audit report is published

## Phase 3: Expansion

**Goal:** extend the canon to cover the practically important components, and consider additional reference implementations.

**Scope (canonical expansion):**

- Add 5–10 more components — candidates: Menu, Tree, Slider, Checkbox/Radio, DatePicker, Toast/Notification, Accordion, Breadcrumb, Pagination
- Prioritize based on observed usage / requests / personal interest

**Scope (implementations):**

- Consider adding Radix UI as a second reference implementation — high-value because it represents a different design philosophy (unstyled, composition-first) than Atelier
- Or consider React Aria — represents an even more behavior-focused approach

**Scope (site improvements):**

- Better search (full-text via Pagefind)
- Cross-component navigation (e.g., "components related to Combobox")
- Possibly a public contribution flow for corrections

**Timeline:** open-ended; driven by usage and interest.

## Phase 4 and beyond: speculative

- A Figma plugin that surfaces anatomy data inside Figma when a designer selects a component
- A VS Code extension that surfaces anatomy data when a developer hovers over a component
- Live-rendered reference implementations (embedded Atelier UI demos) on canonical pages
- Token reference layer (a separate concern that could become a sibling project)
- Localization (if there's clear demand)

These are all speculative and depend on whether the foundation in Phases 1–3 finds traction.

## Maintenance cadence

Once Phase 1 is live:

- **Quarterly:** re-read all canonical components for tone and consistency drift
- **As-needed:** update library-specific claims when a watched library has a major release
- **Annually:** review the methodology document and ADRs to confirm they still reflect the current approach

## Indicators that the project is working

- AI assistants can answer component questions usefully when given access to the MCP server
- At least one external developer or designer has used the site to settle a real decision
- The Atelier audit produces at least one concrete improvement to Atelier UI
- The schema is stable (no breaking changes after Phase 1)

## Indicators that the project is not working

- The site exists but doesn't get used (including by the author)
- The Atelier audit produces no findings — suggests the canon was shaped by Atelier despite the methodology
- The author stops adding components for a long stretch — suggests the format is too expensive to maintain

If indicators of "not working" appear, the response should be honest reassessment, not denial. A scoped-down version (e.g., five components, no expansion) is a legitimate end state.
