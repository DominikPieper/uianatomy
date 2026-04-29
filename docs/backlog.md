# Backlog

Persistente Arbeitsliste aus dem Senior UX/UI + Senior Frontend Review (2026-04-29). Quelle: `~/.claude/plans/mache-ein-detailliertes-review-cheeky-cocke.md`.

Status-Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt

---

## P0 — sofort, blockiert Phase 2

- [x] **P0-1 Tabs nachziehen** — data states erweitert (`busy`, `lazy`, `error`), 2 mistakes ergänzt (lazy-panel-no-aria-busy, overflow-no-scroll-into-view, indicator-not-rtl-aware), 1 mismatch ergänzt (overflow wrap vs scroll). Erledigt 2026-04-29. Datei: `content/components/tabs.yaml`.
- [x] **P0-2 Mindesttiefe-Checkliste** verankert in `docs/methodology.md` (Section "Minimum depth contract", Tabelle mit 8 Schwellwerten). Validator: `shared/tests/depth.test.ts` — bricht `pnpm -r test` bei Unterschreitung mit `<id>: <dimension> N < M`-Meldungen. Per-Component-Override via `overrides`-Map möglich. Erledigt 2026-04-29.
- [x] **P0-3 ADR-006: Token-Layer** — Decision-Doc geschrieben: kanonische Token-Namen pro Slot, Werte in `implementations/<lib>/`. Fünf Kategorien (`spacing`, `radius`, `color`, `elevation`, `typography`). Schema-Skizze + `tokenBindings`-Form fixiert für P1-5. Erledigt 2026-04-29. Datei: `docs/adr/006-token-layer.md`.
- [x] **P0-4 Roadmap-Pin** — `<aside class="phase-banner">` auf Site-Index oberhalb Hero: "Phase 1 · Reference only — no live examples and no implementation code yet. Phase 2 (implementation audits) begins Q3 2026." Light/Dark-tauglich, Mobile-Stack ab 540px. Erledigt 2026-04-29. Dateien: `site/src/pages/index.astro`, `site/src/styles/global.css`.

## P1 — strukturelle Schema-Erweiterungen

- [x] **P1-5 Token-Layer Schema + Migration** — `anatomySlotSchema` um optionales `tokens`-Feld (5 Kategorien als optionale `Record<string, dotted-token-name>`-Maps) erweitert, Vokabular fixiert + in `docs/schema.md` dokumentiert, alle 5 YAMLs (33 Slots) migriert, neue Designer-View-Komponente `TokensTable.astro` mit sparse-column-Logik integriert. Tests + `pnpm -C site build` grün, Browser-Smoke-Test bestätigt Designer-only-Sichtbarkeit + warmer Akzent. Erledigt 2026-04-29. Dateien: `shared/src/schema.ts`, `content/components/{button,card,modal,tabs,combobox}.yaml`, `site/src/components/sections/TokensTable.astro`, `site/src/components/views/DesignerView.astro`, `docs/schema.md`.
- [ ] **P1-6 Motion-Sektion** — `motion?: { reducedMotionFallback, durations: { open, close, indicator, ... }, easing }`. Migration: Modal, Combobox, Tabs.
- [ ] **P1-7 Responsive-Sektion** — `responsive?: { breakpoints: [{ at, change }] }` deklarativ. Migration: Card (stack/side), Modal (fullscreen-Breakpoint), Tabs (vertical-Switch), Combobox (mobile native Listbox).
- [ ] **P1-8 State-Maschine modellieren** — `axes.states.transitions[]: { from, to, trigger }`. Migration: Modal (closed→opening→open→closing→closed), Combobox (closed↔open, open→busy→open, open→invalid).
- [ ] **P1-9 Property-Type strukturiert** — `property.type: string` → discriminated union (`literal[]` oder `{ kind: 'enum', values: [] }`). Migration: alle YAMLs.
- [ ] **P1-10 Events Top-Level-Feld** — `events?: [{ name, payload, frameworkNotes }]`. Optional pro Komponente.

## P2 — Inhalts-Sektionen

- [ ] **P2-11 Component-Property-Mapping-Tabelle** — Schema-Feld `propertyMap?: [{ figma, code, type }]`. Render in Designer- + Bridge-View.
- [ ] **P2-12 "When to use"-Sektion** — Schema-Feld `whenToUse?: { use, avoid, vsRelated: [{ id, difference }] }` ersetzt nackte `related[]`-Chips.
- [ ] **P2-13 Form-Integration-Sektion** — Schema-Feld `formIntegration?: { name, formData, reset, validation }`. Migration: Button, Combobox, Modal.
- [ ] **P2-14 i18n-Sektion** — Schema-Feld `i18n?: { rtl: { mirroring }, textExpansion }`. Migration: alle.
- [ ] **P2-15 A11y-Acceptance-Set pro Komponente** — Schema-Feld `a11yAcceptance?: { keyboardWalk[], announcements[], axeRules[] }`. Testbar.
- [ ] **P2-16 Performance-Schwellwerte first-class** — z. B. Combobox `virtualised.threshold: 200` aus Mistakes nach oben in `properties` ziehen.

## P3 — Site & SVG-Polish

- [x] **P3-17 Site-A11y-Fixes** — Skip-Link in `site/src/layouts/Base.astro` (off-screen, slides in on `:focus`/`:focus-visible`, jumps to `#main`), `<main id="main">`, `<nav aria-labelledby="components-heading">` mit `<h2 id="components-heading">` um den Component-Grid auf der Index-Seite. Erledigt 2026-04-29. Dateien: `site/src/layouts/Base.astro`, `site/src/pages/index.astro`, `site/src/styles/global.css`.
- [x] **P3-18 Anatomy-SVG-Verbesserungen** — Required-vs-Optional bereits via `stroke-dasharray="6 4"` differenziert (kein Touch nötig). Floating-Slots erhalten jetzt `class="anatomy-floating"` (CSS `drop-shadow`-Filter, light/dark) plus eine kreisförmige `z`-Badge in Akzentfarbe. Wiederholte Slots (`repeats > 1`) zeigen oben rechts ein `n×`-Pill (`anatomy-repeat-count`). Asymmetrische Layouts: bestehender `aspect`-Pfad in `layoutGrid` bleibt korrekt — keine Anpassung nötig. Tests: zwei neue vitest-Cases gegen Combobox. Erledigt 2026-04-29. Dateien: `shared/src/svg.ts`, `site/src/styles/global.css`, `shared/tests/schema.test.ts`.
- [x] **P3-19 Shiki-Integration** — `markdown.shikiConfig` mit Dual-Theme (`github-light` / `github-dark-default`), `defaultColor: false`, `wrap: true`. Dark-Theme über `:root[data-theme='dark']` statt `prefers-color-scheme`. Erledigt 2026-04-29. Dateien: `site/astro.config.mjs`, `site/src/styles/global.css` (`.astro-code` Basis-Styles + Dark-Override).
- [x] **P3-20 Eyebrow ohne MutationObserver** — Per-View-Labels jetzt CSS-only via `:root[data-view='…'] [data-view-eyebrow]::before { content: '…'; }` (gleiches Muster für `[data-anatomy-caption]`). Komplettes `<script>`-Block aus `[id].astro` entfernt. Erledigt 2026-04-29. Dateien: `site/src/pages/components/[id].astro`, `site/src/styles/global.css`.

## P4 — Skalierung & Tooling

- [ ] **P4-21 Cross-Component-Konsistenz-Audit-Script** — prüft gleiche Density-Stufen, gleiche Disabled-Tokens, gleiche Focus-Ring-Spezifikation. Läuft im CI.
- [ ] **P4-22 Search/Filter** auf Index-Page (Pagefind) — sobald >15 Komponenten.
- [ ] **P4-23 Versionierung** — `deprecated?`-Flag pro Variant/Property/Slot, `since`-Feld pro Komponente, Changelog-Sektion.
- [ ] **P4-24 MCP-Server-Tool-Erweiterung** — sobald Tokens/Motion/Responsive da: `get_tokens`, `get_motion`, `get_responsive`.
- [ ] **P4-25 View-Strategy reevaluieren** ab ~Komponente 20 — 3× DOM-Payload zu groß. Alternative: Astro View-Transitions oder client-side fetch.

## P5 — Phase 2 (Implementations)

- [ ] **P5-26 `implementations/radix/`** als erste React-Referenz.
- [ ] **P5-27 `implementations/headlessui/`** für Vue.
- [ ] **P5-28 `implementations/cdk/`** für Angular Signals.
- [ ] **P5-29 Divergenz-Schema testen** (omitted/renamed/extended/reshaped) an realer Implementation.

---

## Empfohlener Pfad

P0-1 (✓) → P0-2 (✓) → P0-3 (✓) → P0-4 (✓) → P3-17 (✓) → P3-19 (✓) → P3-20 (✓) → P3-18 (✓) → P1-5 (✓) → P1-6 → P1-7 → P1-8.

Alle P0- und P3-Items sowie P1-5 abgeschlossen. Phase-2-Audit ist damit auf der Token-Schiene entblockt. Nächste Plan-Session: **P1-6** (Motion: `motion?: { reducedMotionFallback, durations, easing }`, Migration Modal/Combobox/Tabs). Danach P1-7 (Responsive) und P1-8 (State-Maschine) als sequenzielle Schema-Erweiterungen.

## Wartung dieses Backlogs

Bei jeder erledigten Aufgabe Status auf `[x]` setzen, Erledigungs-Datum + Datei-Verweis ergänzen. Neue Items nach Priorität einsortieren. Phase-2-Items (P5) bleiben offen bis Phase 1 stabil.
