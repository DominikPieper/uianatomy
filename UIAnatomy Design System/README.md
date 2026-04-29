# UIAnatomy — Design System

A canonical reference site documenting **UI component anatomy** for designers, developers, and design-system maintainers. Each component (Card, Modal, Combobox, Tabs, Tooltip…) is documented on three axes:

- **Anatomy** — slots and regions, with rationale for each.
- **Axes** — variants vs. properties vs. states.
- **Bridge** — the translation between Figma and code, including typical mismatches.

Every component renders in three switchable views with one global view switcher: **Designer** (Figma component setup, variants, token references), **Dev** (code structure, cross-framework mapping, slot mechanisms), and **Bridge** (side-by-side, with explicit mismatches called out). The switcher applies a subtle accent shift to confirm which mode is active without retheming the whole site.

The site is **library-agnostic by design.** Canonical anatomies are synthesized from the W3C ARIA Authoring Practices Guide, mature headless libraries (Radix, React Aria, Headless UI, Spectrum), and shipping design systems (Polaris, Carbon, Material 3, Atlassian) — without privileging any one implementation. Specific implementations get their own pages and are audited against the canon.

**Distribution:** static site, JSON API, and an MCP server that exposes the same component data as queryable tools — so AI assistants and tooling can consume canonical component knowledge directly.

## Sources

This is a new, conceptual brand. There is no prior codebase, Figma file, or deck. The system was synthesized from the brief alone.

---

## Index — files in this project

```
README.md                       this file
SKILL.md                        portable skill (Agent Skills compatible)
colors_and_type.css             all design tokens · semantic CSS
assets/
  wordmark.svg                  primary lockup
  glyph.svg                     cross-section mark
fonts/                          (currently empty — see "Typography → Substitutions")
preview/                        Design System tab cards
  colors-paper.html             paper canvas swatches
  colors-ink.html               ink scale
  colors-view-modes.html        Designer / Dev / Bridge accent rows
  colors-semantic.html          highlight, error, success, rule
  type-display.html             headline serif specimens
  type-body.html                body sans + lede italic
  type-mono.html                JetBrains Mono labels & code
  spacing-scale.html            4-base spacing
  radii.html                    radii steps
  shadows.html                  three-step shadow system
  component-view-switcher.html  pill segmented control with view accents
  component-buttons.html        primary / secondary / ghost / accent
  component-anatomy-diagram.html  specimen with leader-line callouts
  component-taxonomy-chips.html variant / property / state / mismatch
  component-inputs.html         default / focused / error
  brand-wordmark.html           lockup card
  brand-glyph.html              glyph on three surfaces
```

This depth is **foundations only** (per the brief). UI kits, slide templates, and a full component catalogue can be added as follow-ups.

---

## Content fundamentals

The voice of UIAnatomy is **editorial reference, not marketing.** It reads like a textbook or a well-edited Wikipedia article: calm, definitive, precise, and never pitching itself.

**Person & address.** Third person. The site describes components ("A Card has a Header, Media, Body, and Footer"), not the reader's experience. Avoid "you," avoid "we." When user instruction is unavoidable (docs and the MCP), it's imperative ("Pass `asChild` to forward the slot to a child element"). Never first-person plural.

**Casing.** **Component names are PascalCase** in prose (`Combobox`, `Card.Header`). Slots use dot paths (`Card.Header.Title`). CSS tokens are kebab-case (`--paper-100`). Headlines are sentence case ("Anatomy of a card"), never Title Case. ALL-CAPS is reserved for monospace eyebrow labels (`CANONICAL ANATOMY`, `MISMATCH`).

**Tone & vocabulary.**
- *Canonical, anatomy, slot, region, axis, variant, property, state, mismatch* are first-class terms used precisely.
- Never **selling words**: no "powerful," no "seamless," no "modern," no "delightful."
- Never **AI-marketing words**: no "intelligent," no "magical," no "next-generation."
- Hedge with care. "Typically," "in most implementations," "by convention" are fine. "Usually pretty good" is not.
- One example beats a paragraph. Show the slot tree.

**Emoji.** None, ever. The brand is a printed reference — emoji would break the register. Substitute with monospace tags (`[FIGMA]`, `[CODE]`, `[MISMATCH]`) or accent-tinted leader callouts.

**Examples**

> **Yes:** A Tabs component is composed of a TabList containing Tab items, and a TabPanel per tab. The active TabPanel is announced via `aria-labelledby` referencing its Tab.
>
> **No:** Tabs are a powerful way to let your users effortlessly switch between content sections!

> **Yes:** Mismatch — Figma's `disabled` boolean property maps to `aria-disabled="true"` *plus* a `pointer-events: none` rule in code; the designer artifact does not capture the latter.
>
> **No:** Sometimes designs and code don't quite match up. We help bridge that gap. ✨

---

## Visual foundations

**Palette.** A warm paper canvas (`--paper-50` → `--paper-300`), soft-black ink in five steps (`--ink-900` → `--ink-300`), and three view-mode accents — clay (Designer, `#B5471F`), slate-teal (Dev, `#1F5D7A`), graphite (Bridge, `#4A463E`). Each accent has 50/100/500/700 stops. Accents are **never used together** on the same surface; switching the view re-themes the regions that need re-themeing (active chip, link, callout) and nothing else.

**Typography.** Three families.
- **Newsreader** (variable serif) — display, h1-h3, italic ledes. Editorial, slightly low-contrast, designed for screen reading.
- **Inter** (variable sans) — body, UI, h4 caps eyebrow.
- **JetBrains Mono** (variable mono) — labels, code, eyebrows, callouts on diagrams.

The pairing is deliberate: serif headlines anchor the editorial tone, mono signals "this is structured data" wherever it appears.

**Spacing.** Strict 4-base (`s-1` → `s-24`). Editorial measure (`--measure: 64ch`) caps body line length; tighter `--measure-tight: 48ch` for ledes.

**Backgrounds.** Always `--paper-50`. No gradients, no full-bleed photography, no patterns. A paper texture overlay is permitted at ≤ 3% opacity but is **off by default**. Component specimens sit on `--paper-100` panels with a 1px hairline, no shadow.

**Animation.** Restrained. `--dur-1: 120ms` (hover), `--dur-2: 200ms` (segmented control), `--dur-3: 320ms` (view transition crossfade). Easing is `--ease-out` or `--ease-std`. No bounces, no spring physics, no Lottie.

**Hover.** Underlines darken from `--paper-300` to `currentColor`. Buttons darken background by 4–6%. No scale, no lift.

**Press.** Background darkens another step. No shrink. No ripple.

**Focus.** Visible at all costs. `box-shadow: 0 0 0 3px rgba(27,26,23,.10)` plus a 1px ink border. Never the browser default. Never disabled.

**Borders.** Hairline (`1px`) is the default rule weight; `1.5px` for emphasis; `2px` for the active state of segmented controls and current-page indicators. All rules use `--rule` (`#D9CDB2`) unless stated.

**Shadows.** Three steps: `shadow-1` (resting card, inset hairline), `shadow-2` (raised input/menu trigger), `shadow-pop` (open menu, popover, dialog). Inner shadows are not used. Glow is forbidden — paper has weight, not light.

**Transparency & blur.** Used only for the modal scrim (`rgba(27,26,23,0.4)`, no blur). Glass effects are off-brand.

**Radii.** `r-1: 2px` and `r-2: 4px` cover almost every case. `r-pill` for the view switcher. Never larger than 6px. Never irregular.

**Imagery.** The brand is text-and-diagram. The only generated images are anatomy figures — wireframe specimens with hairline strokes on `--paper-100`, with monospace leader-line callouts in the active view-mode accent. No photos. No 3D. No illustrations of people. If a component cannot be drawn, it is not yet documented.

**Cards.** A card on this site is `--paper-100` background, 1px `--paper-200` border, `r-2`, `shadow-1`. Padding `s-4` (small) or `s-6` (default). Cards do not lift on hover.

**Layout rules.** A two-column layout dominates: a fixed-width navigation rail (240px), and a measure-capped content column. The view switcher is fixed top-right. The sidebar collapses below 960px. Diagrams break out of the measure but never out of the page gutter.

---

## Iconography

UIAnatomy uses **monospace text labels and minimal stroked SVGs** before it uses an icon. Where an icon is genuinely necessary, the system uses **Lucide** (1.5px stroke, 24px frame) loaded via CDN. Lucide was chosen for stroke weight that pairs with our hairline rules and for its long-term stability.

**Icon CDN.** `https://unpkg.com/lucide@latest` — used as `<i data-lucide="square-stack"></i>` after `lucide.createIcons()`.

**Icon stroke.** Always 1.5px. Color is `currentColor` (inherits from the surrounding text — `--ink-700` in body, view-accent inside themed regions). Icons should not be filled.

**SVG inline.** The wordmark, glyph, and the auto-generated anatomy diagrams (specimens with leader-line callouts) are inline SVG. Diagrams use `--diagram-stroke` for outlines and the active view accent for callouts.

**Emoji.** Never.

**Unicode glyphs as icons.** Avoid. The one exception is `→` and `↳` in slot-path breadcrumbs (`Card → Header → Title`). Even these are optional; mono punctuation works.

**Substitution flag.** Lucide is not a UIAnatomy original. If the brand evolves a custom icon set later, replace per the rule above (1.5px stroke, 24px frame, `currentColor`). For now, Lucide is the system.

---

## Typography substitutions

Newsreader, Inter, and JetBrains Mono are **the closest Google Fonts matches** for the chosen pairing — they are loaded via the Google Fonts CDN in `colors_and_type.css`. The sandbox could not download woff2 files directly, so `fonts/` is empty.

**Action for the user:** if you'd like self-hosted fonts (offline-safe, GDPR-friendly), drop the woff2 files into `fonts/` and replace the `@import` line in `colors_and_type.css` with the four `@font-face` rules previously stubbed out. Or tell me which families to substitute (e.g. an Adobe Fonts pair) and I'll wire them up.

---

## Caveats & open items

- **No fonts on disk.** As above — currently CDN-loaded.
- **Foundations only.** Per the brief — UI kits and slide templates were skipped. They are the natural next iteration.
- **The wordmark italicizes "Anatomy."** If you'd rather it be all-roman or all-italic, say the word.
