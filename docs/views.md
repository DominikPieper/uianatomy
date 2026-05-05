# The Three Views

Every component is presented in three switchable views, plus a global view switcher that sets the default for the entire site.

## Why three views

The same component anatomy is read differently by different roles:

- A **designer** opening the Card page wants to see Figma variant structure, component properties setup, token references, and figma-side pitfalls
- A **developer** wants the code structure, cross-framework mapping, slot mechanisms, and code-side pitfalls
- Someone **bridging both worlds** (frontend developer in a design-system role, design-engineering hybrid, design-system maintainer) wants the translation layer — where do the two worlds typically misalign and how is the misalignment resolved

A single view that tries to serve all three results in noise for everyone. Three views with shared underlying data give each role what they need.

## The views

### Designer view

Primary content:

- Anatomy diagram (canonical SVG)
- Figma component setup (variants, properties, slot frames)
- Token references (which design tokens this component touches)
- Common Figma-side mistakes (e.g., variant explosion from modeling states as variants)

Code-side details are collapsed by default. Available, but not in the way.

### Dev view

Primary content:

- Anatomy diagram (same canonical SVG)
- Cross-framework expression (Web Components, React, Angular Signals, Vue)
- Slot/composition mechanism per framework
- ARIA / a11y considerations
- Common code-side mistakes

Figma-side details are collapsed by default.

### Bridge view

Primary content:

- Side-by-side translation table (Figma concept ↔ Code concept)
- Mismatches section prominently displayed
- Both designer and dev details available without expansion

This is the view most useful for design-system maintainers and frontend developers who collaborate closely with designers.

## Global switcher

The site has a global view switcher (typically in the header) that sets the default tab on every component page.

**Behavior:**

- First-time visitors see a brief "Who are you?" prompt (Designer / Dev / Both — defaults to Both if dismissed)
- Selection persists in `localStorage`
- Each component page opens with the selected view as the default tab
- Per-page tab selection still works — the global switcher only sets the *default*, doesn't lock the choice

**Visual treatment:**

- Subtle accent color shift per mode (warm tone for Designer, cool tone for Dev, neutral for Bridge)
- Background, typography, and structure remain constant — this is not a theme switch, it's an emphasis shift
- Accent shows up in: section headers, link underlines, selected-tab indicator, anatomy diagram highlights

The accent shift is functional, not decorative — it's a visual confirmation of which mode is active, not a re-skinning of the site.

## What changes between views

| Element                     | Designer | Dev      | Bridge   |
|----------------------------|----------|----------|----------|
| Anatomy diagram             | shown    | shown    | shown    |
| Figma details               | expanded | collapsed| expanded |
| Code details                | collapsed| expanded | expanded |
| Mismatches section          | shown    | shown    | prominent|
| Cross-framework map         | collapsed| expanded | expanded |
| Token references            | expanded | available| expanded |
| ARIA / a11y notes           | available| expanded | expanded |
| Common mistakes (Figma)     | shown    | available| shown    |
| Common mistakes (code)      | available| shown    | shown    |
| Accent color                | warm     | cool     | neutral  |

## What stays constant

- The component name, description, and related-components links
- The anatomy diagram (rendered identically; only the highlighted slot may differ on hover)
- The component's identity — switching views never feels like a different site

## Why not more views

- An "A11y view" sounds plausible but a11y concerns are entwined with both design and code; pulling them out creates artificial separation. Better to surface a11y notes in both Designer and Dev views.
- A "Token view" is interesting for design-system maintainers but very narrow; better as a section within Designer view.
- A "Storybook view" could embed live reference-implementation components from one of the audited libraries (Radix, Headless UI, Angular Material/CDK, Vaul). Deferred — implementation audits are surfaced today as YAML divergence reports rendered into the canonical component page rather than as live Storybook embeds.

Three views is the right number for this scope. More fragments the experience; fewer fails to serve distinct audiences.
