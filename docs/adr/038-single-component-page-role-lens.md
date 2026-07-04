# ADR 038: Single Component/Pattern Page, Role as a Client-Side Lens

**Status:** Accepted
**Date:** 2026-07
**Supersedes:** none (formalizes and replaces the informal design in the pre-2026-07 [`docs/views.md`](../views.md), which was never itself recorded as an ADR)
**Related:** Design-review 2026-07-03 (P6-197), [`docs/views.md`](../views.md) (rewritten alongside this ADR)

## Context

Every component rendered as three separate pages — `/components/<id>` (Designer), `/components/<id>/dev` (Dev), `/components/<id>/bridge` (Bridge) — with the same shape mirrored for patterns. The design was specified in `docs/views.md`: a persistent global switcher, a first-visit "Who are you?" prompt defaulting to Both, per-view mistake filtering, and Bridge positioned as the shared superset for design-system maintainers who need both worlds.

The 2026-07-03 design review's UX pass measured what actually shipped against that specification and found a materially different reality:

- **The three pages were ~70% identical content, reordered.** Measured on Combobox: Designer (13 sections, ~9,950 words), Dev (13 sections, ~10,450 words), Bridge (17 sections, ~10,800 words) — each carrying only 3-4 exclusive sections, the rest shared verbatim across all three.
- **Bridge was not the superset it was designed to be.** It carried mismatches, mistakes, contracts, and every dev/designer-specific section *except* tokens, motion, and responsive — meaning the page positioned as "everything, no expansion needed" was itself missing content.
- **None of the interactive behavior in `docs/views.md` existed.** No persistent switcher (`localStorage` held only the theme, never a view preference), no first-visit prompt, no per-view mistake filtering. What shipped was three static URLs with a page-level tab strip that re-navigated on every click.
- **Search indexed only the Designer page.** `data-pagefind-body` was set exclusively on the Designer route; Dev-exclusive content (framework map, events, form integration, a11y acceptance, performance) was invisible to site search entirely, despite the search page's own copy claiming those sections were searchable. (An interim fix landed 2026-07-03 as P6-191, before this ADR; this ADR's consolidation obsoletes that fix by removing the split it was patching around.)
- **The split taxed the agent-consumption surface.** Three near-identical markdown exports per component (`astro-llms-md` generates one per route) meant any agent fetching a component page paid for ~3× the tokens with ~30% new information per additional fetch, and citations/URLs for the "same" content fragmented across three addresses.

The role distinction itself is real — `docs/personas.md` and the schema's own `SectionHeader` role tags (`designer` | `dev` | `both`) reflect a genuine split in which sections a Figma-side reader versus a code-side reader cares most about. What wasn't earning its cost was expressing that split as three separate crawlable, cacheable, linkable URLs.

## Decision

Collapse to one page per component (`/components/<id>`) and one page per pattern (`/patterns/<id>`). Role becomes a client-side **lens**, not a route:

```ts
// site/src/layouts/Base.astro — inline, before paint
const lens = localStorage.getItem('uianatomy:lens'); // 'designer' | 'dev' | 'bridge' | null
document.documentElement.setAttribute(
  'data-view',
  lens === 'designer' || lens === 'dev' || lens === 'bridge' ? lens : 'bridge',
);
```

```astro
<!-- site/src/components/views/ComponentView.astro — every section, once -->
<div class="canon-section" data-role="designer">
  <SectionHeader role="designer" title="Figma anatomy" id="figma-anatomy" />
  <FigmaSlotTable component={component} />
</div>
```

```css
/* site/src/styles/global.css — dim, never hide */
:root[data-view='designer'] .canon-section[data-role='dev'],
:root[data-view='dev'] .canon-section[data-role='designer'] {
  opacity: 0.45;
}
```

Three concrete changes fall out of this:

1. **Routing.** `site/src/pages/components/[id].astro` and `site/src/pages/patterns/[id].astro` are the only routes; `[id]/[view].astro` for both is deleted. Old `/dev` and `/bridge` URLs 301-redirect to the base path at the Worker level (`worker/index.ts`), since they were live, linked, and indexed — a bare 404 would be a regression for anyone who bookmarked or cited one.
2. **Content.** `ComponentView.astro` replaces `DesignerView.astro` / `DevView.astro` / `BridgeView.astro` — one file, every section, ordered with mismatches first (the differentiator, promoted from "prominent on one of three pages" to "first thing on the only page"). `PatternPageShell.astro`'s single `[id].astro` route now renders composition, when-to-use, decisions, mistakes, and framework skeletons together (previously mistakes/skeletons were dev/bridge-only).
3. **Role signal.** `ViewSwitcher.astro` (a `<nav>` of `<a>` tags that navigated between pages) is replaced by `RoleLens.astro` (a `<nav>` of `<button>` elements that never navigate — they set `data-view` and write to `localStorage`). The three-way value stays `designer | dev | bridge` internally — `bridge` is kept as the unfiltered/"show everything" state so every existing `[data-view='bridge']` CSS rule (accent color, anatomy label set, eyebrow/caption text) keeps working unchanged; only the *visible* button label changes, from "Bridge" to "All".

Dimming, not hiding: off-lens sections get `opacity: 0.45` (restored to `1` on hover/focus), never `display: none`. This is deliberate — search indexing, the accessibility tree, and Pagefind should never depend on which lens a sighted, JS-enabled visitor happened to have active. The lens is a reading aid, not a content gate.

A byproduct: two pieces of dead CSS (`[data-view-eyebrow]` and `[data-anatomy-caption]`, discovered mid-implementation) turned out to be exactly the mechanism this ADR needed — attribute selectors with `::before` content keyed to `:root[data-view]`, written but never wired to any markup. They're wired up now instead of rebuilt, restoring what their own in-code comment already described as the intended design ("the string lives in CSS so the label updates the moment `:root[data-view]` flips").

A new `ComponentTOC.astro` ("On this page") is added as a direct consequence of consolidation: with 15+ sections now on one page instead of spread across three shorter ones, an on-page jump list becomes necessary in a way it wasn't before. It's generated client-side from the rendered `.section-header` elements rather than a hand-maintained list, so it can't drift from whatever sections a given component actually has.

## Rationale

**Dimming over hiding.** The alternative — `display: none` on off-lens sections — was rejected because it would remove content from the accessibility tree and from Pagefind's indexed text for as long as a lens was active, reintroducing exactly the "search only indexed one view" problem this ADR exists to fix, just moved from build-time (three pages) to runtime (one page, JS-toggled visibility). Dimming keeps every section always-present; the lens only changes visual emphasis for a sighted reader who has JavaScript enabled. A no-JS visitor sees everything at full opacity, all the time — graceful degradation to "no filtering" rather than to "broken."

**Keep `bridge` as the internal unfiltered-state value, relabel only the button.** Renaming it to something like `all` would require touching every `[data-view='bridge']` selector across `global.css` (accent color, anatomy label set, eyebrow, caption — at least seven call sites) for a change that is purely cosmetic (what the button says, not what the value means). The cost of the rename bought nothing a code comment doesn't already buy.

**Client-side-generated TOC over a hand-maintained section list.** A hardcoded TOC list in `ComponentPageShell.astro` would need to duplicate the exact conditional-rendering logic already in `ComponentView.astro` (motion/responsive/events/formIntegration/performance/i18n/a11yAcceptance/contracts are all conditionally rendered based on whether the component declares them). Two copies of that conditional logic drift the moment one is edited without the other — the same failure mode the project already fixed once for `/compare` (backlog P6-166, `compareDiffHtml.ts` as the single source of truth). Scanning the rendered DOM for `.section-header` elements makes the TOC a pure reflection of what's actually on the page, by construction.

**One JSON-LD headline instead of three.** The three `VIEW_HEADLINE` variants (`"anatomy, axes, and design tokens"` / `"code-side hints, framework map..."` / `"Figma↔code mismatches..."`) each described a subset that, post-consolidation, is simultaneously true of the one page. A single headline naming the union is more accurate than any one of the three was alone, and avoids an arbitrary choice of which subset "wins" as the page's canonical headline.

## Consequences

**Positive:**
- 138 → 52 built pages (41 components + 2 patterns × 1 route instead of × 3, plus static pages) — verified in the build after this change.
- Search indexes every section of every component exactly once; the P6-191 designer-only-indexing gap is structurally closed rather than patched.
- One markdown export per component/pattern instead of three near-identical ones — direct token savings for any agent fetching via content negotiation, and one canonical URL per component instead of three competing citations.
- `docs/views.md` now describes an implementation that exists (verified: role lens set before paint, persisted via `localStorage`, dimming behavior confirmed in a built-page smoke test) instead of one that was aspirational.
- The mismatches section — the canon's actual differentiator — moved from "prominent on the Bridge page" to "first section on the only page," visible to every visitor regardless of lens.

**Negative:**
- Component pages are now long (all sections on one page, previously split three ways) — mitigated by the new TOC, but a component with every optional section populated is a genuinely long scroll. No further mitigation (e.g., collapsible sections) is part of this ADR; revisit if the TOC alone proves insufficient.
- The three-URL structure is gone, which is a breaking change for anyone who bookmarked or linked `/components/<id>/dev` or `/components/<id>/bridge` directly — mitigated by the 301 redirects in `worker/index.ts`, but redirects are themselves a small ongoing maintenance surface (they must be kept if this ADR is ever revisited).
- Patterns lost their dev/bridge distinction entirely (they now show all sections unconditionally, with no lens — patterns never had role-tagged sections to filter). This is a simplification, not a loss of content: every pattern section that existed under the old dev/bridge routes still renders on the single pattern page.

## Alternatives considered

**Fix the three pages in place** (index the Bridge page instead of Designer, add the missing tokens/motion/responsive to Bridge to make it a true superset, wire up the persistent switcher `docs/views.md` specified). Rejected — this would have addressed the measured symptoms (search gap, Bridge-not-superset) without addressing the root finding: three pages sharing ~70% of their content is redundant by construction, regardless of which one search indexes or how complete Bridge's section list is. Patching the symptom would leave the token-cost and citation-fragmentation problems for agents fully intact.

**Remove the role distinction entirely — one page, no lens, sections in a single fixed order with role badges only for information, no dimming.** Rejected — the role split reflects a genuine difference in what a Figma-side reader versus a code-side reader is scanning for on a 15+ section page; a lens that lets either reader visually de-emphasize the sections that aren't theirs is a real usability aid on a page this long, not vestigial ceremony from the old three-page design.

**Hide off-lens sections instead of dimming.** Rejected — see Rationale. Hiding content based on client-side, JS-dependent state reintroduces a search/accessibility gap structurally identical to the one this ADR fixes.
