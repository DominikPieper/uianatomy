# Designer / Dev roles

Every component and pattern renders as **one page**. Role — designer or developer — is a client-side lens, not a route.

## Why not three pages

The original design (this document, pre-2026-07) specified three separate URLs per component (`/components/<id>`, `/components/<id>/dev`, `/components/<id>/bridge`) with a persistent global switcher, a first-visit "Who are you?" prompt, and per-view mistake filtering. None of that shipped as designed: the switcher never persisted past a page load, there was no first-visit prompt, and Bridge — meant to be the shared-content view — carried its own subset (missing tokens, motion, and responsive) rather than being the true superset. Measured on Combobox, the three pages were roughly 70% identical content reordered three ways.

The 2026-07-03 design review's UX pass ([backlog P6-197](./backlog.md)) found the consequences: search indexed only the designer page, so dev-only sections (framework map, events, a11y acceptance) were unfindable; three near-identical markdown exports per component wasted agent context; every internal link already pointed at the base URL anyway, so the split served no real navigation purpose. [ADR-038](./adr/038-single-component-page-role-lens.md) records the consolidation this document now describes.

## The one page

A component page renders every section once, in a fixed order — Figma↔code mismatches first (the canon's actual differentiator), then variants/axes, then Figma-side detail, code-side detail, and cross-cutting sections (accessibility, contracts, common mistakes) last. Patterns follow the same principle: composition, when-to-use, decisions, common mistakes, and framework skeletons all render on `/patterns/<id>`.

An "On this page" list ([`ComponentTOC.astro`](../site/src/components/ComponentTOC.astro)) is generated client-side from whichever sections actually rendered — it can't drift from the page, because it reads the page rather than a separately maintained list.

## The role lens

A three-way toggle in the header — **Designer / Dev / All** — flips a `data-view` attribute on `<html>` and persists the choice to `localStorage`. No navigation happens; the same page dims sections tagged for the other role instead of hiding or reordering them. Dimmed sections stay in the DOM at full opacity to search engines, screen readers, and Pagefind — the lens is a visual emphasis aid for a sighted, JS-enabled reader, not a content filter, so nothing is ever unavailable because of the active lens.

**Behavior:**

- Set before first paint via an inline script in [`Base.astro`](../site/src/layouts/Base.astro), reading the same `localStorage` key the lens buttons write — no flash of the wrong lens on load.
- Defaults to **All** (unfiltered) when nothing is stored yet.
- Every section carries a `data-role` (`designer` | `dev` | `both`, set by [`SectionHeader.astro`](../site/src/components/SectionHeader.astro) and mirrored on its wrapping `.canon-section`). Sections tagged `both` are never dimmed.
- Hovering or focusing a dimmed section restores full opacity — dimmed content is de-emphasized, never truly unreadable.

**Visual treatment:**

- Accent color shift per lens (warm for Designer, cool for Dev, neutral for All) — the same mechanism that existed under the three-page design, now driven by a client-side attribute instead of which page you're on.
- The anatomy diagram's slot labels flip between Figma terminology and code terminology with the lens (`.label-figma` / `.label-code` / `.label-bridge` in `global.css`).
- A small eyebrow above the component name and a caption under the anatomy diagram both read the active lens reactively via CSS `::before` content — no JavaScript text update needed when the lens flips.

Patterns carry no role-tagged sections (composition/decisions/mistakes/skeletons are not designer-or-dev-specific), so pattern pages show no lens control.

## What changed for search and agents

- Pagefind indexes the single component page once — no more designer-only indexing gap, no more three-way duplicate-content signal.
- One markdown export per component (via `astro-llms-md`) instead of three near-identical files.
- One JSON-LD `TechArticle` per component/pattern instead of three headline variants.
- Old `/components/<id>/dev` and `/components/<id>/bridge` URLs (and the pattern equivalent) 301-redirect to the base path at the Worker level (`worker/index.ts`) — they were live, linked, and indexed, so they don't just 404.

## Why not more roles, and why not zero

- An "A11y lens" was considered during the original three-view design and rejected then for the same reason it stays rejected now: accessibility concerns are entwined with both design and code, not a third independent axis.
- Removing the role distinction entirely was also considered (see ADR-038's alternatives) — rejected because the designer/dev split is real and worth signaling even on a single page; it just doesn't need three URLs to do it.
