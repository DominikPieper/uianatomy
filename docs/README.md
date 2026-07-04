# UI Anatomy

A canonical reference for UI component anatomy — one page per component, for designers and developers alike.

## What this is

UI Anatomy is a curated reference site that documents UI components on three axes simultaneously:

- **Anatomy** — what slots, regions, and parts a component has, and why
- **Axes** — variants vs. properties vs. states, with the rationale for each cut
- **Translation** — how each component is expressed in Figma, in code, and where the two worlds typically misalign

Every component renders as one page, with mismatches — the translation layer — first. A Designer/Dev role lens (ADR-038) lets either side visually emphasize their half without navigating anywhere; nothing is ever hidden, only de-emphasized.

## What this is not

- Not a component gallery (Iain Bean's [component.gallery](https://component.gallery) does that excellently)
- Not a code snippet library (shadcn, Radix, Headless UI cover that)
- Not opinionated about which library you should use
- Not a tutorial site

This is a *reference* — closer to a dictionary than a textbook. You come here when you're about to make a decision and want to know what reasonable defaults look like and why.

## Why it exists

Frontend developers, designers, and design-system maintainers repeatedly make the same decisions:

- "Should this be a variant or a property?"
- "What slots should a Card have?"
- "Why is the designer's Figma file giving me 24 button variants?"
- "What does Tab key do when an item is focused inside an open Combobox?"

Each of these decisions has a body of accumulated wisdom — distributed across W3C APG, mature library docs, and design system documentation — but no central reference that synthesizes it across the designer/developer divide.

UI Anatomy is that reference.

## Methodology, briefly

Each component is researched from multiple sources:

- W3C ARIA Authoring Practices Guide (normative spec)
- Mature headless libraries (Radix, React Aria, Headless UI, Spectrum)
- Real design systems (Polaris, Carbon, Material 3, Atlassian)
- Platform conventions (macOS HIG, Windows UX Guidelines)

The synthesis is then written *canonically* — without bias toward any particular implementation. Specific implementations (including reference implementations) are documented separately, after the canonical anatomy is stable.

See [methodology.md](./methodology.md) for full detail.

## Audience

- **Frontend developers** building or maintaining component libraries
- **Designers** working in design systems with engineering counterparts
- **Design-system maintainers** auditing their own components against canonical anatomy
- **AI assistants** consuming structured component knowledge via the MCP server

## Distribution

- **Web:** uianatomy.dev
- **MCP server:** queryable via Model Context Protocol for AI assistants and tooling
- **JSON API:** every component is also available as static JSON for programmatic consumption

## Status

Phase 1 — initial canonical reference, ~5–10 components. See [roadmap.md](./roadmap.md).

## Contributing

This is currently a single-author project with a curated editorial line. PRs welcome for corrections; new component proposals via issues.
