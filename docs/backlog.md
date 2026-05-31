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

**Cut-Liste komplett (P6-163…167).** Nur noch **Improve**-Items offen: die größte
Produkt-Lücke ist Implementations-Coverage (**P6-168**, nur 14/41 Komponenten, L) +
Canon-Content-Gaps (P6-169…173, je S–M). Empfohlener Start: P6-168 menu/popover/
tooltip × {radix, react-aria, headlessui}, dann die Content-Gaps in einem Batch.

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

- [ ] **P6-168 High-Leverage-Implementations ergänzen** — 33 Impl-Files decken nur 14/41 Komponenten, Skew zu Low-Risk-Primitives (button/badge/avatar/card). Die Komponenten, für die ein AI-Agent am meisten Library-Guidance braucht — **menu, popover, tooltip, switch, radio-group** — haben **null** Coverage, obwohl sie in Radix/React Aria/Headless UI First-Class-Primitives sind (Portalling, Focus, controlled state divergieren genau hier). Erste Batch: menu + popover + tooltip × {radix, react-aria, headlessui}. Datei: `implementations/{radix,react-aria,headlessui}/*.yaml`.
- [ ] **P6-169 button + combobox: `contracts`-Block fehlt komplett** — `grep -L '^contracts:' content/components/*.yaml` → button, combobox. Beides High-Traffic-Primitives mit harten Non-Negotiables (button: echtes `<button>`/role, accessible name, `type=button` default, 24×24 hit-target). Schema macht contracts optional → läuft still durch. Datei: `content/components/{button,combobox}.yaml`.
- [ ] **P6-170 alert + drawer: `contracts` ohne `nonNegotiable`** — beide haben `contracts:` nur mit `vocabularyDrift:`. Harte Regeln fehlen (alert: `role=alert` vs `status` live-region; drawer: focus-management / inert-when-modal). Liest sich halbfertig neben modal (4 Regeln) / text-input (5). Datei: `content/components/{alert,drawer}.yaml`.
- [ ] **P6-171 `vocabularyDrift` auf 8 Komponenten backfillen** — fehlt auf accordion, button, combobox, link, menu-button, modal, tabs, tooltip — gerade die meistreferenzierten, wo Naming-Divergenz (Material/Carbon/Polaris/Atlassian) am stärksten ist. Peers: switch 7 Einträge, breadcrumbs 6. Priorität modal/tabs/accordion/tooltip. Datei: `content/components/*.yaml`.
- [ ] **P6-172 Patterns: `sources`-Block ergänzen + re-review** — `confirmation-flow` + `login-form` haben **0** sources (Components erzwingen ≥3 via depth-test, Patterns sind exempt) und tragen die ältesten `lastReviewed` (2026-05-01/02). Decision/mistake-Claims unbelegt. APG-Flows + WCAG 3.3.x + Login-Best-Practice zitieren; ggf. leichten depth-guard auf Patterns ausweiten. Datei: `content/patterns/*.yaml`.
- [ ] **P6-173 `text-input` formIntegration-Prosa entduplizieren** — `submittedValue` + `formData` wiederholen fast identischen FormData-Absatz (Z. ~742-764) → Drift-Risiko bei künftigen Edits. `formData` behält den mechanischen Detail, `submittedValue` referenziert ihn. Datei: `content/components/text-input.yaml`.

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
