# Backlog

Single source of truth für offene Arbeit. Neu aufgesetzt **2026-05-31** aus dem
Multi-Dimensions-Review-Workflow (7 Reviewer + Synthese). Der alte 72KB-Stand
(Essay-lange Done-Einträge) wurde ersetzt — Done-Historie lebt in git +
[`docs/backlog-archive.md`](backlog-archive.md).

**Format-Disziplin (neu):** Done-Einträge sind **eine Zeile** (Titel · Datum ·
Outcome · Dateien). Implementierungs-Details gehören in die Commit-Message, nicht
hierher. Counts (Tests/Tools/Pages) werden **nicht** in Prosa gepflegt — sie
driften; Quelle ist der Test-Runner bzw. `grep -c '\.tool(' mcp-server/src/server.ts`.

IDs sequenziell pro Bucket; beim Vergeben auch `backlog-archive.md` scannen.
Legende: `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt

---

## Empfohlener Pfad

Projekt-Gesundheit nach Review **2026-05-31: 4/5** — Produkt (Canon, Schema,
Site, Build/Deploy) solide; Hauptbefund war *build/record-ahead-of-demand* +
*Source-of-truth driftet von Realität*. Die 4 Quick-Wins (P6-159…162) + der
P4-27-Merge sind gelandet → die Source-of-truth-Drift ist geschlossen.

**Erledigt 2026-05-31 (Review-Run + komplette Code-Cut-Liste):** Quick-Wins
P6-159…162, P4-27-Merge, + Cut-Items P6-163 (Versioning geparkt), P6-164
(9 Slice-Tools → `get_component_section`, 28→20 Tools), P6-165 (Sub-Anatomy-ADRs
→ Registry), P6-166 (`/compare` entdupliziert, −309 Zeilen + latenter Bug gefixt).

**Cut-Liste komplett (P6-163…167). Improve-Bucket abgearbeitet 2026-06-05:**
P6-168(b) Implementations-Coverage 14→19 Komponenten (Bundle 47 impls), P6-169/170
contracts auf button/combobox/alert/drawer, P6-171 vocabularyDrift-Backfill (8),
P6-172 Pattern-sources (+Schema-Feld), P6-173 text-input-dedup, P6-174 menu/popover/
tooltip Canon-Gaps. **Neu offen:** P6-175 (switch/radio-group Canon-Gaps aus dem
batch-2-Audit, S–M). Danach nur noch das alte P4/P5/P6-Defer-Backlog (meist
build-ahead-of-demand, owner-driven oder bewusst geparkt).

---

## Done — Review-Run 2026-05-31

- [x] **P6-159 P4-27-Härtung mit Realität abgeglichen (Branch gemerged)** — Befund: MEMORY+CLAUDE.md führten P4-27 als done, `main` hatte 0 `registerTool`/`outputSchema`; Arbeit lag nur auf Branch `harden-mcp-server-mcp-builder` (main war Ancestor → sauberer FF). Branch isoliert getestet (300 grün), fast-forward in main gemerged: jetzt 29 `registerTool` + 13 `outputSchema` + annotations + CHARACTER_LIMIT + stdio-entry auf main. Schließt zugleich Improve-#6 (outputSchema). Erledigt 2026-05-31. **Noch nicht gepusht.** Dateien: `mcp-server/src/{server,annotations,constants,output-schemas,local}.ts`, `mcp-server/tests/server.test.ts`.
- [x] **P6-160 Test-/Tool-Counts aus Prosa entfernt** — stale „27 MCP tools / 293 tests" im Empfohlener-Pfad widersprach Realität (29/300+). Count-Klauseln raus, Hinweis auf derivierbare Quelle gesetzt. Erledigt 2026-05-31. Datei: `docs/backlog.md` (+ dieser Rewrite).
- [x] **P6-161 `prefers-reduced-motion`-Guard auf der Site** — 0 Treffer site-weit trotz ~10 Transitions in global.css (WCAG 2.3.3 Lücke für eine Referenz, die sich als exemplarisch framed). Ein `@media (prefers-reduced-motion: reduce)`-Block neutralisiert Transitions/Animations/Smooth-Scroll + `@view-transition: none`. Erledigt 2026-05-31. Datei: `site/src/styles/global.css`.
- [x] **P6-162 CI gated den Deploy-Pfad + Broken-Link gefixt** — Cloudflare auto-deployed von main ohne PR-Signal-Gate. `wrangler deploy --dry-run`-Step in `ci.yml` ergänzt (bundlet Worker ohne Credentials); Broken-Link `methodology → schema.md#versioning-optional` entlinkt (schema.md ist keine geroutete Page); `throwError: true` im broken-links-checker. Build grün, „No broken links detected". Erledigt 2026-05-31. Dateien: `.github/workflows/ci.yml`, `site/astro.config.mjs`, `docs/methodology.md`.
- [x] **Backlog-Rewrite (Improve-#5)** — 72KB → lean; Essay-Done-Einträge auf eine Zeile, Someday/Maybe von echter Queue getrennt. Erledigt 2026-05-31. Datei: `docs/backlog.md`.

---

## Cut / simplify — „zu viel" (aus Review-Synthese)

Vom Owner explizit erfragt: was kostet mehr als es bringt.

- [x] **P6-163 Versioning-Subsystem (ADR-023) geparkt** — Live-Surface entfernt (0/41 Adoption): `get_changelog`-MCP-Tool + 2 Tests raus (Tool-Count 29→28); Render entfernt (`VersionBadges.astro` + `ChangelogSection.astro` gelöscht, hero-since-Pill + Slot-/Variant-/Property-Deprecation-Badges aus ComponentPageShell/Figma+CodeSlotTable/AxesTable + `.hero-since`-CSS). Advertising-Surfaces bereinigt (SKILL.md-Tool-Table + per-axis-Liste, integrate.astro). Schema-Felder bleiben dormant; ADR-023 auf „Accepted (dormant)" + Amendment-Note; Changelog-Eintrag `2026-05-31-park-versioning.md`. 298 tests grün (225+73), build clean. Erledigt 2026-05-31. Dateien: `mcp-server/src/{server.ts,tests}`, `site/src/components/**`, `site/src/styles/global.css`, `site/src/pages/integrate.astro`, `site/public/.well-known/.../SKILL.md`, `docs/adr/023-versioning.md`, `site/src/content/changelog/2026-05-31-park-versioning.md`.
- [x] **P6-164 9 Single-Field-MCP-Slice-Tools in `get_component_section` kollabiert** — bandwidth-preserving: neues `get_component_section(id, sections[])` gibt nur angefragte Sektionen zurück (3KB-Vorteil bleibt, P6-82/P6-115-Rationale gewahrt). Entfernt 9 Tools (`get_axes`/`get_common_mistakes`/`get_framework_map`/`get_tokens`/`get_motion`/`get_responsive`/`get_transitions`/`get_events`/`get_when_to_use`). Behalten: `get_anatomy` + `get_mismatches` (Shortcuts), `get_contracts` (special: component-OR-pattern). **Tool-Count 28→20.** Tests umgeschrieben (jetzt 75), 2 unused outputSchema-Imports raus. Advertising-Surfaces bereinigt + entkoppelte „N tools"-Counts aus SKILL.md/integrate.astro (P6-160-Erweiterung). 300 tests grün, build clean. Erledigt 2026-05-31. Dateien: `mcp-server/src/server.ts`, `mcp-server/tests/server.test.ts`, `site/public/.well-known/.../SKILL.md`, `site/src/pages/integrate.astro`.
- [x] **P6-165 Per-Instanz-Sub-Anatomy-ADRs (032/033/034) zu ADR-030-Registry demoted** — neue „## Sub-anatomy registry"-Sektion in ADR-030 (Tabelle: id/slots/consumers/rationale/detail-link für action-group + close-button + header-bar + icon-leading-text) + Konventions-Statement „neue Sub-Anatomie = Registry-Row, kein neuer ADR; ADR nur wenn Mechanismus sich ändert". ADRs 032/033/034 auf Status „Folded into ADR-030 registry" + Banner; Bodies bleiben als historische Detail-Rationale. ADR-030 „Phase-2 follow-ups"-Zeile (vormals „Each requires its own ADR") aktualisiert. Doc-only (ADRs sind keine Site-Routes). Erledigt 2026-05-31. Dateien: `docs/adr/{030,032,033,034}-*.md`.
- [x] **P6-166 `/compare`-Re-Render entdupliziert (1 geteilte Funktion)** — neue `site/src/lib/compareDiffHtml.ts` (`renderDiffHtml` + `escapeHtml`) ist single source of truth für das Diff-Markup; `CompareDiff.astro` (333→14 Zeilen) und das Client-Script in `compare.astro` (347→218) nutzen beide dieselbe Funktion → kein Gleichschritt-Risiko mehr. Compare-Diff-Styles von scoped `<style>` nach global.css verschoben — **fixt latenten Bug**: client-injiziertes HTML war nach Re-Render unstyled (scoped-Attr fehlte). Static-Route-Alternative verworfen (Site ist static, kein SSR; ?a=&b= braucht Client-Fetch). Netto −309 Zeilen. 225 shared tests grün, build clean, gebaute compare-page + bundled CSS verifiziert. Erledigt 2026-05-31. Dateien: `site/src/lib/compareDiffHtml.ts` (neu), `site/src/components/compare/CompareDiff.astro`, `site/src/pages/compare.astro`, `site/src/styles/global.css`.
- [x] **P6-167 `backlog-tick` an Lean-Format angepasst; canon-auditor behalten** — Verdikt: beide Tools behalten, nicht retiren. `backlog-tick/SKILL.md` auf die Lean-Disziplin umgeschrieben (Lean-Reset-Note; Done-Einträge = **eine Zeile**; keine Counts in Prosa; id = highest-seen+1, Archiv nur für Kollisions-Check statt Dual-File-Ritual; stale Hardcoded-Datum + „≥500-Zeilen"-Annahme + „match corpus depth / 3-4 lines" + `(✓)`-Pfad-Konvention raus). `canon-auditor` **unverändert** — die P6-151-False-Positives sind dort bereits durch Pre-Flight-Rule-2 (lint-trust + literal grep+Read statt Skim) gefixt, und es emittiert schon one-line Backlog-Items; es ist die Batch-Audit-Capability, die P6-169…173 produziert hat. Erledigt 2026-05-31. Dateien: `.claude/skills/backlog-tick/SKILL.md`.

---

## Improve — Produkt-Lücken (aus Review-Synthese)

- [x] **P6-168 (Batch 1) menu/popover/tooltip Implementations ergänzt** — 8 neue Impl-Files via `library-audit-runner` (live-doc-research, 2026-05-31): radix {menu, popover, tooltip}, react-aria {menu, popover, tooltip}, headlessui {menu, popover}. **headlessui/tooltip = not-shipped** (docs 404, export in index.ts auskommentiert — Evidenz dokumentiert, mirror des react-aria/alert-Präzedenz). Coverage 14→17 Komponenten; Bundle 33→41 impls. Test-Fixture radix-lib-filter 12→15 + componentIds aktualisiert. Alle `from`-Refs gegen Canon-Slots verifiziert, schema-valid, 300 tests grün, site 138 pages clean. Drafts sind agent-authored aus Live-Docs (reviewbar). Erledigt 2026-05-31. Dateien: `implementations/{radix,react-aria,headlessui}/{menu,popover,tooltip}.yaml` (8 neu), `mcp-server/tests/server.test.ts`.
- [x] **P6-168b switch/radio-group Implementations (Batch 2)** — 6 neue Impl-Files via `library-audit-runner` (live-doc-research, 2026-06-05): {radix, react-aria, headlessui} × {switch, radio-group}. Dominantes Muster: alle drei Libs kollabieren die 4-Slot-Anatomy (root/track/thumb/input) auf `<button role="switch">` bzw. ersetzen native radios durch `role="radio"`-spans + hidden bubble-input → track/thumb/indicator omitted/reshaped. Coverage 17→19 Komponenten; Bundle 41→47 impls. radix-Fixture 15→17 + switch/radio-group in componentIds. 300 tests grün, site 138 pages clean. Flaggte Canon-Gaps → P6-175. Erledigt 2026-06-05. Dateien: `implementations/{radix,react-aria,headlessui}/{switch,radio-group}.yaml` (6 neu), `mcp-server/tests/server.test.ts`.
- [x] **P6-174 Canon-Gaps aus P6-168-Audit** — per-item entschieden: (a) `menu` `group-label`-Slot **hinzugefügt** (child of group, role-less heading, aria-labelledby-Target; Radix `Label`/HeadlessUI heading rendern ihn) — Anatomy-Addition, SVG rendert sauber; (b) `tooltip` WCAG 1.4.13-nonNegotiable **ergänzt** (dismissible/hoverable/persistent + grace) + Radix `instant-open`/`delayed-open` als vocabularyDrift (Motion-Concern, nicht neuer State); (c) `popover` Radix `Popover.Anchor` + React-Aria `placement`-Compound als vocabularyDrift **dokumentiert** (orthogonale `side`+`align` bleiben canon); (d) events-payload `{itemId, originalEvent}`: **keine Änderung** — `frameworkNotes` mappen bereits auf React-Aria `onAction(key)`/Radix `onSelect(value)`, canon-Shape ist bewusst normalisiert. Erledigt 2026-06-05. Dateien: `content/components/{menu,popover,tooltip}.yaml`.
- [ ] **P6-175 Canon-Gaps aus P6-168b-Audit (switch/radio-group)** — die batch-2-Audits flaggten: (a) `switch.anatomy[track]` ist `required:true`, aber Radix/HeadlessUI shippen **kein** Track-Subcomponent (CSS auf Root) — in `frameworkMap.react` surfacen, ggf. required lockern; (b) `switch.axes.properties[required]` evtl. aspirational — keine Lib im Korpus shippt `aria-required` auf switch; (c) `switch.a11yAcceptance` Enter-Semantik mehrdeutig (toggle vs form-submit — HeadlessUI bindet Enter an submit, nicht toggle); (d) `radio-group.anatomy[radio]` ist `slotKind:content`, wrappt aber interaktiven input → eher `structural`/`interactive`; (e) per-radio `description`-Prop (React Aria) nicht modelliert; (f) "single hidden input at group level"-Form-Submission (HeadlessUI custom-element radios) fehlt in `formIntegration`. Pro Item: Canon erweitern oder als vocabularyDrift/Note dokumentieren. Datei: `content/components/{switch,radio-group}.yaml`.
- [x] **P6-169 button + combobox: `contracts`-Block fehlt komplett** — beide bekommen jetzt `nonNegotiable` + `vocabularyDrift`. button: 5 Regeln (echtes `<button>`/role, accessible name, `type` explizit, 24×24 hit-target WCAG 2.5.8, disabled vs aria-disabled). combobox: 5 Regeln (role=combobox+aria-expanded+aria-controls, aria-activedescendant statt Fokus-Move, listbox/option-Rollen, Keyboard-Vertrag, name+aria-autocomplete). Erledigt 2026-06-05. Dateien: `content/components/{button,combobox}.yaml`.
- [x] **P6-170 alert + drawer: `contracts` ohne `nonNegotiable`** — beide bekommen je 4 harte Regeln. alert: role=alert vs status, Live-Region-vor-Content-DOM-Regel, kein Focus-Steal (sonst alertdialog), Severity nicht nur Farbe (WCAG 1.4.1). drawer: role=dialog+aria-modal+name, Focus-into/trap/return, inert-when-modal (Kern-Unterschied modal/non-modal), Escape+echter Dismiss. Erledigt 2026-06-05. Dateien: `content/components/{alert,drawer}.yaml`.
- [x] **P6-171 `vocabularyDrift` auf 8 Komponenten backfillen** — accordion/button/combobox/link/menu-button/modal/tabs/tooltip je 4-5 Einträge (button+combobox via P6-169 mitgeliefert). Nur Systeme aus der `LIBRARY_NAME_ALIASES`/`KNOWN_NON_LIBRARY_SYSTEMS`-Whitelist zitiert (consistency-test P5-35); neue Libs (Downshift/Ant/Bootstrap) vermieden, da Alias-Keys LIBRARY_VERSIONS spiegeln müssen (→ P6-152). Erledigt 2026-06-05. Dateien: `content/components/*.yaml`, `shared/tests/schema.test.ts` (2 Tests die alten Gap kodierten).
- [x] **P6-172 Patterns: `sources`-Block ergänzen + re-review** — `patternSchema` um optionales `sources` (gleiche Shape wie component, **kein** ≥3-depth-guard) erweitert; confirmation-flow (6 sources: APG alertdialog, WCAG 3.3.4, MDN dialog, Radix, HeadlessUI, M3) + login-form (6: WAI forms, WCAG 3.3.1/1.3.5, autocomplete-spec, NIST 800-63B, OWASP) belegt, lastReviewed → 2026-06-05. schema.md nachgezogen. Erledigt 2026-06-05. Dateien: `shared/src/schema.ts`, `content/patterns/*.yaml`, `docs/schema.md`.
- [x] **P6-173 `text-input` formIntegration-Prosa entduplizieren** — `submittedValue` auf kurzen Verweis gekürzt, `formData` behält die volle Mechanik (single source). Erledigt 2026-06-05. Datei: `content/components/text-input.yaml`.

---

## Offen — übernommen aus altem Backlog (Stand 2026-05-31)

### P4 — Skalierung & Tooling
- [ ] **P4-26 State-Graph-Renderer** — eigener Graph-Renderer für `axes.states.transitions` (heute reine `TransitionsTable.astro`). Zweiter SVG-Generator parallel zu `renderAnatomySVG`, gleicher Wireframe-Stil, eigener Layout-Algo (Stack für lineare State-Maschinen, force-directed mit fixem Seed für Combobox-artige Graphen). Eigene ADR (Graph- vs Grid-Layout-Problem). Datei: `site/src/`, `shared/src/svg.ts`.

### P5 — Implementations / Sources
- [~] **P5-34c sources[] verified-Migration: 28 Komponenten verbleiben** — 13/41 migriert (button + accordion/alert/avatar/badge + banner/breadcrumbs/card/checkbox + avatar-group/code-block/combobox/disclosure), 61 lib-URLs verifiziert+drift-korrigiert. Rest resumable in 4er-Gruppen (Start: drawer/modal/table/tabs); ~50% URL-Drift-Rate erwartet. Improve-#8. Datei: `content/components/*.yaml`.
- [ ] **P5-36 Library-Versionen Phase-4: auto-version-bump CI** — Script fetcht LIBRARY_VERSIONS-keys via npm-registry/docs-sniff, öffnet PR wenn pin > N Monate lagged. Defer bis baseline-versions gefüllt. Datei: `scripts/check-library-versions.mjs` + `.github/workflows/`.
- [ ] **P5-37 sources[] bare-URL Restcleanup (3 Komponenten)** — bare-URLs ohne `library`/`verifiedAt` in avatar-group (5), avatar (2), checkbox (1) — Libraries nicht in `LIBRARY_KEYS`. Abhängig von P6-152: bei Aufnahme auf `{url,library,verifiedAt}` heben, sonst bewusst bare lassen. Datei: `content/components/{avatar-group,avatar,checkbox}.yaml`.

### P6 — Reichweite & Schema-Followups
- [ ] **P6-44 Backlinks + Outreach** (non-code, owner-driven) — größter SEO-Hebel, Domain-Authority 0 ohne Backlinks. Targets: awesome-* GitHub-Listen, Show-HN, designsystems.com Slack, Storybook-Blog, Twitter/Mastodon. Tracking-Surface für gelandete Mentions.
- [ ] **P6-52 `@uianatomy/skill` npm-package + install-CLI** — heavier Alternative zur curl-one-liner: `npx @uianatomy/skill install` schreibt SKILL.md + `.mcp.json`. Trigger wenn ≥3 externe Projekte die one-liner adopted haben + Friction-Feedback. Eigene ADR bei landing.
- [ ] **P6-74 i18n.rtl-restructure** — prose → strukturiert (mirroredAxes, directionNeutralGlyphs, logicalProperties[]). ADR-017 wählte prose bewusst. Touch 24 Komponenten. Defer bis prose-search-pain real. ADR-017-Followup. (Überschneidet sich mit Review-Theme „Schema build-ahead-of-demand" — erst bei echter Query-Nachfrage.)
- [ ] **P6-78 frameworkMap-Expansion** — Svelte/SolidJS/Lit/Qwik fehlen; `angularSignals` evtl. Suffix droppen. Trade-off: jedes Framework +25% Prosa, verwässert Tiefe. Defer bis consumer-demand. ADR bei landing.
- [ ] **P6-84 migrate-tool / codemod-hints** — bei Canon-Rename (`nonLinear`→`linear`) kein diff/codemod-hint. Heavy Infra, Renames selten. Defer.
- [ ] **P6-85 testRecipes-Block** — neues Feld `testRecipes?: {framework, snippet}[]` für pre-baked a11y-Test-Snippets pro Framework×Komponente. Kombiniert mit a11y-fixture-endpoint. Heavy: Schema + per-Komponente. Multi-session.
- [ ] **P6-152 LIBRARY_VERSIONS-Expansion (ADR-028 Followup)** — 11+ zitierte Libraries ohne Eintrag in `vocabulary.ts.LIBRARY_VERSIONS`: mantine (8), chakraUi (4), heroui (3), mui (3), naiveUi (3), vuetify (2), primereact/elementPlus/radixVue/downshift (je 1), 4 Router-Libs. Pro Library: Eintrag anlegen oder Zitat entfernen/umlenken. Schließt P5-37 ab. Datei: `shared/src/vocabulary.ts` + 11+ yamls.
- [ ] **P6-154 link.notes → contracts migrieren** — `link.yaml` `notes` (542 Zeichen) überschreitet 400-Zeichen-Threshold; passt nach `contracts.editorial`/`designRationale`. Reine Verschiebung. Datei: `content/components/link.yaml`.
- [ ] **P6-157 textarea.responsive-Sektion ergänzen** — fehlt, obwohl `resize`-Axis + `minRows`/`maxRows` direkte Narrow-Viewport-Implikationen haben (WCAG 1.4.10 in contracts zitiert). Kurze Sektion reicht. Datei: `content/components/textarea.yaml`.
