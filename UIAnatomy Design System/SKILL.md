---
name: uianatomy-design
description: Use this skill to generate well-branded interfaces and assets for UIAnatomy, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files (colors_and_type.css, assets/, preview/).

UIAnatomy is a canonical reference site for UI component anatomy — editorial, calm, technical. Designs should feel like a printed textbook, not a SaaS marketing page. Key constraints:

- Background is always warm paper (`--paper-50`); no gradients, no full-bleed photography, no patterns.
- Type pairs serif (Newsreader) with sans (Inter) and mono (JetBrains Mono). Headlines and ledes are serif; mono is reserved for labels, code, and diagram callouts.
- The product has three view modes (Designer / Dev / Bridge), each with its own accent color (clay / slate-teal / graphite). Apply these via `[data-view="…"]` and use `--accent-700/500/100/50` inside themed regions. Never use two accents on the same surface.
- Component names are PascalCase, slot paths are dot-separated, CSS tokens are kebab-case. Headlines are sentence case. ALL-CAPS only for monospace eyebrow labels.
- No emoji, no decorative gradients, no bouncy animation, no glow shadows, no glass/blur.
- Iconography: Lucide via CDN at 1.5px stroke, `currentColor`. Otherwise rely on monospace text labels and minimal SVG diagrams.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` and link `colors_and_type.css` so tokens are available. If working on production code, copy assets and read the rules in README.md to become an expert in designing with this brand.

If the user invokes this skill without other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
