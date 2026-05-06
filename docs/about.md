# About UI Anatomy

UI Anatomy is a **canonical, library-agnostic reference for UI component anatomy**. For every component (Button, Modal, Tabs, Combobox, …) it documents the slots and regions, the variants / properties / states / transitions, the typical Figma↔code mismatches, the common implementation mistakes, the cross-framework expression, the tokens, the motion, the responsive behaviour, the events, and the accessibility contract — in a single canonical YAML, surfaced through three role-specific views (Designer / Dev / Bridge), a JSON API, and an MCP server.

## What this site is for

The site exists for three concrete uses:

1. **A reference designers and developers can read together.** Each component renders in three views — the Designer view foregrounds Figma-side slots, tokens, motion, responsive behaviour; the Dev view foregrounds code-side slots, framework mapping, events, form integration, accessibility acceptance; the Bridge view foregrounds the mismatches and common mistakes that surface in the gap between the two roles. Same canonical record, three projections — never a separate "design doc" and "dev doc" that drift apart.

2. **A reviewable target for implementations.** When you ship a Modal in Radix, in Headless UI, in your own internal library — you can compare your implementation against the canon and document where it omits, renames, extends, or reshapes the canonical anatomy. The Phase-2 `implementations/` layer captures these audits explicitly.

3. **An LLM-queryable knowledge base.** The MCP server (`https://uianatomy.dev/mcp`) exposes the same canon as 29 tools so an agent can answer "what slots does Modal have?", "what mistakes are typical for Tabs?", "how does Radix Dialog diverge from canonical Modal?" without scraping prose. The same data is also available as static JSON for clients that cannot speak MCP.

## What this site is *not*

- **Not a fixed standard.** Nothing here is a hard rule that every component must follow.
- **Not a substitute for the underlying specs.** WAI-ARIA APG, MDN, WCAG remain authoritative. UI Anatomy *cites* them; it does not *replace* them.
- **Not partisan.** No framework, library, or design system is canonically "correct." The cross-framework map and the per-library audits are descriptive, not prescriptive.
- **Not exhaustive.** Edge cases live in the per-library audits and in your own codebase.
- **Not a style guide.** Visual look, spacing values, typography scale — those are token-level decisions that belong in your design system, not in a canonical anatomy. UI Anatomy documents the *structural* contract, not the visual one.

## What "canon" means here — and what it doesn't

The word *canon* is the project's strongest stylistic choice and the one most likely to be misread. Read it carefully.

**Canon means: synthesised best practice from triangulating multiple sources.** Each component is researched against at least three categories — normative specifications (W3C ARIA Authoring Practices Guide, MDN, WCAG), mature headless / unstyled libraries (Radix UI, React Aria, Headless UI, Spectrum Web Components), and real production design systems (Shopify Polaris, IBM Carbon, Atlassian Design System, Material Design 3, GOV.UK Design System). Where they agree, the agreement becomes the canonical default. Where they disagree, the disagreement is named and a recommendation is picked *with rationale* — never papered over.

**Canon does not mean: a rule you must follow.** The canon is a reference — what reasonable defaults look like across the industry — not a regulation. Your context can legitimately diverge: a domain-specific Combobox in a developer-tools product is allowed to break the APG keyboard contract if that product's users genuinely need different behaviour and the divergence is documented. That is the point of the `implementations/` layer: to capture divergences with rationale, not to mark them as defects.

**Treat the canon as input to your decision-making, not as the decision.** The site documents what mature implementations have converged on and *why*. You bring the context — your users, your platform, your constraints — and decide whether to follow, adapt, or deviate. Where you deviate, write down why; that is the same editorial discipline the canon itself follows.

## How the canon is researched

Each component is built from three categories of source, in this order:

1. **Normative specifications** — W3C ARIA APG (authoritative for accessible patterns, keyboard behaviour, ARIA structure), MDN Web Docs (HTML semantics, platform behaviour), WCAG (accessibility constraints).
2. **Mature headless / unstyled libraries** — Radix UI, React Aria (Adobe), Headless UI (Tailwind Labs), Spectrum Web Components (Adobe). These reflect what production teams have converged on; convergence indicates a likely-correct default.
3. **Real production design systems** — Shopify Polaris, IBM Carbon, Atlassian Design System, Material Design 3, GOV.UK Design System. These reflect how components are organised when they need to scale across many products and teams.

The full editorial methodology — synthesis approach, the variant / property / state distinction, the minimum-depth contract, the consistency safeguards — lives in [Methodology](/methodology). The audit discipline that turns specific implementations into per-library yamls lives in `docs/methodology.md` and the `implementations/` directory.

## How to use the canon

Start with the component pages — pick a role view that matches your task (Designer / Dev / Bridge). For agentic flows, the MCP endpoint is `https://uianatomy.dev/mcp` and the static JSON fallback is `https://uianatomy.dev/api/components.json`. The skill file at `https://uianatomy.dev/.well-known/agent-skills/uianatomy-mcp/SKILL.md` is canonical and stable; drop it into any Claude Code project to make the canon agent-callable.

When the canon and your reality disagree, the canon is the starting point — not the verdict. Document your reason. The whole project is built on the assumption that thoughtful divergence, written down, is more valuable than blind compliance.

## Source

The site, the JSON API, the MCP server, the skill file, and every per-library audit are generated from the same canonical YAML in `content/components/` against a single Zod schema. No separate data store, no drift, no hidden state. Source of truth: <https://github.com/dominikpieper/uianatomy>.
