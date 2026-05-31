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

**Next:** Surface-Reduktion aus der Cut-Liste (P6-163 Versioning parken +
P6-164 MCP-Slice-Tools kollabieren) — das ist das „zu viel", nach dem der Owner
gefragt hat, mittlerer Aufwand, senkt laufende Wartung. Danach die größte
Produkt-Lücke: Implementations-Coverage (P6-168, nur 14/41 Komponenten).

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
- [ ] **P6-164 10 von 13 Single-Field-MCP-Slice-Tools kollabieren** — `get_changelog`/`get_events`/`get_transitions`/`get_motion`/`get_responsive`/`get_axes`/`get_tokens`/`get_framework_map`/`get_when_to_use` u.a. sind identische 6-Zeilen-Projektionen einer Schema-Sektion; existieren weil das Schema 13 Sektionen hat, nicht weil Agents 13 Retrieval-Intents haben (mehrere geben null für den Großteil des Korpus). Kollabieren in parametrisiertes `get_component_view` (oder `sections: string[]`-Arg auf `get_component`); nur `anatomy` + `mismatches` als named shortcuts behalten (CLAUDE.md sanktioniert die als echte Intents). Halbiert die Tool-Count. Datei: `mcp-server/src/server.ts` (+ Tests).
- [ ] **P6-165 Per-Instanz-Sub-Anatomy-ADRs (032/033/034) zu ADR-030-Registry demoten** — jede ist eine konkrete Anwendung von ADR-030 (Sub-Anatomy als Klasse bereits autorisiert), kein architektonischer Mechanismus. Treiber dafür, dass 34 ADRs nach Prozess-Overhead aussehen. Neue Sub-Anatomien künftig als Registry-/Changelog-Note unter ADR-030; ADR nur minten wenn der Mechanismus sich ändert. Dateien: `docs/adr/{032,033,034}-*.md`, `docs/adr/030-sub-anatomy.md`.
- [ ] **P6-166 Client-seitiges `/compare`-Re-Render entduplizieren** — `compare.astro` baut ~190 Zeilen HTML von Hand nach, die `CompareDiff.astro` deklarativ erzeugt (duplizierte `optionalLabels`-Map, `escape()`-Helper, Matrix-Table) → zwei Kopien einer View per Hand im Gleichschritt. Entweder static `?a=&b=`-Route ohne Live-Re-Render, oder eine geteilte diff-to-HTML-Funktion in `@uianatomy/shared`. Genau die Dual-Maintenance, vor der CLAUDE.md warnt. Datei: `site/src/pages/compare.astro`, `site/src/components/compare/`.
- [ ] **P6-167 `backlog-tick`-Skill + Dual-File-ID-Ritual überdenken** — Skill (141 Zeilen) automatisiert die Heavyweight-Backlog-Zeremonie, die dieser Rewrite gerade wegvereinfacht; bei 1-Zeilen-Format verliert es den Großteil seines Jobs. Dual-File-PX-NN-Collision-Scan über 72KB+215KB ist reiner Overhead — IDs brauchen nur Eindeutigkeit (highest-seen+1 oder date+slug). Auch `canon-auditor` evaluieren (P6-151 war 4/8 False-Positives → Audit-Zeremonie erzeugt evtl. mehr Verifikations- als Spar-Arbeit). Dateien: `.claude/skills/backlog-tick`, `.claude/skills/canon-auditor`.

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
