# Backlog

Persistente Arbeitsliste aus dem Senior UX/UI + Senior Frontend Review (2026-04-29). Quelle: `~/.claude/plans/mache-ein-detailliertes-review-cheeky-cocke.md`.

Status-Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt

---

## P0 — sofort, blockiert Phase 2

- [x] **P0-1 Tabs nachziehen** — data states erweitert (`busy`, `lazy`, `error`), 2 mistakes ergänzt (lazy-panel-no-aria-busy, overflow-no-scroll-into-view, indicator-not-rtl-aware), 1 mismatch ergänzt (overflow wrap vs scroll). Erledigt 2026-04-29. Datei: `content/components/tabs.yaml`.
- [x] **P0-2 Mindesttiefe-Checkliste** verankert in `docs/methodology.md` (Section "Minimum depth contract", Tabelle mit 8 Schwellwerten). Validator: `shared/tests/depth.test.ts` — bricht `pnpm -r test` bei Unterschreitung mit `<id>: <dimension> N < M`-Meldungen. Per-Component-Override via `overrides`-Map möglich. Erledigt 2026-04-29.
- [ ] **P0-3 ADR-006: Token-Layer** als kanonisches Konzept, Werte implementations-spezifisch. Schema-Skizze: `anatomy[].tokens?: { spacing?, radius?, color?, elevation?, typography? }`. Datei: `docs/adr/006-token-layer.md`.
- [ ] **P0-4 Roadmap-Pin** auf Site-Index: Banner "Phase 1 — keine Beispiele, kein Live-Code. Phase 2 ab Q3." Datei: `site/src/pages/index.astro`.

## P1 — strukturelle Schema-Erweiterungen

- [ ] **P1-5 Token-Layer Schema + Migration** — `shared/src/schema.ts` Felder ergänzen, alle 5 YAMLs migrieren (mind. spacing + radius pro Slot), Designer-View-Komponente `TokensTable.astro` rendern. Hängt an P0-3.
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

- [ ] **P3-17 Site-A11y-Fixes** — Skip-Link in `site/src/layouts/Base.astro`, `<nav>`-Landmark auf Index + Komponenten-Liste.
- [ ] **P3-18 Anatomy-SVG-Verbesserungen** in `shared/src/svg.ts`: Required vs. Optional (durchgezogen vs. gestrichelt), Floating-Layer (Schatten + "z"-Badge), Repeats mit "n×"-Annotation, asymmetrische Layouts (echte Aspect-Ratios).
- [ ] **P3-19 Shiki-Integration** in `astro.config.mjs` für künftige Code-Blocks.
- [ ] **P3-20 Eyebrow ohne MutationObserver** — CSS `::before { content: attr(data-eyebrow); }`. Vereinfacht `site/src/pages/components/[id].astro:65-92`.

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

P0-1 (✓) → P0-2 (✓) → P0-3 → P0-4 → P1-5 → P1-6 → P1-7 → P1-8 → P3-17 → P3-18.

P0-3 ist Vorbereitung für P1-5 (größte Schema-Migration, eigene Plan-Session wert). P0-4 ist Quick-Win.

## Wartung dieses Backlogs

Bei jeder erledigten Aufgabe Status auf `[x]` setzen, Erledigungs-Datum + Datei-Verweis ergänzen. Neue Items nach Priorität einsortieren. Phase-2-Items (P5) bleiben offen bis Phase 1 stabil.
