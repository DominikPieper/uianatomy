# ADR 028: Central `LIBRARY_VERSIONS` table

**Status:** Accepted
**Date:** 2026-05
**Supersedes:** none (additive)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-006](./006-token-layer.md) (vocabulary structure), Atelier-feedback v2 P5-33, anti-hallucination defense layer #4

## Context

`docs/methodology.md` mandates: "Date library-specific claims. Library APIs change. Any claim about how Library X currently behaves should be timestamped or verifiable against current docs at write-time."

The 2026-05-03 `canon-auditor` batch over 24 components surfaced this rule as routinely-not-enforced. Every component cites Radix / React Aria / Headless UI / Polaris / Carbon / Material / Atlassian / GOV.UK / Sonner / Reach / vaul / Angular CDK by bare name in `frameworkMap`, `notes`, and `contracts.vocabularyDrift` prose. None pin a version. None record a verification date. Library API drift is invisible — Radix could rename `Dialog.Root` to `Modal.Root` in v2 and the canonical claim "Radix Dialog with focus trap" would still be in the YAML, broken.

Three options surfaced in the P5-33 backlog item:

1. **Per-source `lastReviewed` date in `sources[]` array** — additive, low blast-radius. Each source URL gets its own date. Cost: 24 × N edits per re-verification cycle; no cross-component-shared truth.

2. **Structured `{ url, version, verifiedAt }` object per source** — schema change. Would migrate every `sources[]` entry. Cost: 24-component schema migration plus per-source bump cost.

3. **Site-wide `LIBRARY_VERSIONS` table** in `shared/src/vocabulary.ts`, single pin per library. Components reference library by key; bumping a library is a one-line edit. Cost: zero schema migration; component-level claims remain prose; verification cost concentrates in one file.

## Decision

Option 3. Add `LIBRARY_VERSIONS` to `shared/src/vocabulary.ts` as a const-record keyed by short library identifier. Each entry carries `name`, `url`, optional `version`, optional `verifiedAt` (ISO date). `getCanonicalVocabularies()` returns it as a top-level surface so MCP clients can consume the same baseline.

```ts
export const LIBRARY_VERSIONS = {
  radix: {
    name: 'Radix UI Primitives',
    url: 'https://www.radix-ui.com/primitives',
    version: undefined,    // Populated by user during verification cycles
    verifiedAt: undefined, // Populated alongside version
  },
  reactAria:  { name: 'React Aria',              url: '…' },
  headlessUi: { name: 'Headless UI',             url: '…' },
  // …
} as const;
```

The phase-1 commit ships the structure with `version` and `verifiedAt` optional. The user fills them in during the next verification cycle (manually re-checking each library's current major-version against canonical claims). Subsequent re-verifications bump `verifiedAt` and optionally bump `version`.

## Rationale

- **Single source of truth.** One file lists every library the canon refers to. Adding a new library to the canon means adding a key here; the test suite (phase-2 P5-35) can then enforce that every library named in `frameworkMap` prose maps to a known key.
- **Low schema-migration cost.** No `sources[]` shape change. The 24 component YAMLs stay untouched today; the structure is added without breaking any existing parse path.
- **Bump cost amortised.** When Radix releases a new major, the canon needs one edit (`version: '2.0'`, `verifiedAt: '<today>'`) instead of N component-level edits. The maintainer scans every component that names `radix` in `frameworkMap` and validates that the cited API still exists.
- **MCP tool consumption.** `get_canonical_vocabularies` already exists (P6-66). Adding `libraryVersions` to its return shape lets agents enumerate libraries the canon endorses without reading prose; downstream tooling (validate_implementation, audit) can use the keys to type-check library-specific claims.
- **canon-auditor hookup.** The audit agent learns to compare `component.lastReviewed` against `max(LIBRARY_VERSIONS.verifiedAt)` for libraries the component cites and emit a staleness flag when the component pre-dates the most recent library bump.

### Why optional version / verifiedAt

The phase-1 commit cannot fabricate the version numbers safely — that would itself be hallucination. Verification of "what is Radix's current major" requires fetching upstream docs or reading the npm registry, which is the user's call (this skill's `library-audit-runner` subagent could automate it later). Shipping with `version: undefined` documents the vacuum honestly; the schema gates that bumps must include both `version` and `verifiedAt` together (cross-refine in `vocabulary.ts`).

### Why not extend `sources[]` shape now

That migration touches every component YAML and forces a Zod-schema change. It also conflates "URL I cited" with "library this URL belongs to" — useful for some components but not for sources that point to APG / WCAG / MDN (no library to pin). Phase-2 (P5-34) can structure `sources[]` if pain accumulates; phase-1 keeps the smaller surface.

## Consequences

**Positive:**
- A single edit cycle (one file, one PR) keeps the canon honest about every library it references.
- MCP clients can enumerate library roster without reading prose.
- canon-auditor gains a deterministic staleness signal (date arithmetic, not heuristics).
- Sets up phase-2 work (P5-35 framework-map library-name lint, P5-36 auto-version-bump CI).

**Negative:**
- Phase-1 ships with empty version fields — the table is a schema-state declaration, not a verified-knowledge artifact yet. Honest, but the user must do a verification pass before the staleness lint becomes meaningful.
- Library identifiers are camelCase JS-keys (`reactAria`, `headlessUi`); prose-references use natural names. Consumers translating between key and prose-form need a mapping (`name` field carries it).

**Migration footprint:**
- New file lines in `shared/src/vocabulary.ts` (~50)
- Type addition in `CanonicalVocabularies` interface
- Update of `getCanonicalVocabularies()` reducer
- 1 new consistency-test (every key has non-empty `name` + `url`; if `version` set, `verifiedAt` also set)
- Update of `canon-auditor.md` (new audit-dimension G)
- Update of `docs/schema.md` (vocabulary documentation)
- No YAML migration in phase-1.

## Phase-2 follow-ups (separate items)

- **P5-34** — Optional `sources[]` shape upgrade to `{ url, library?: keyof LIBRARY_VERSIONS, verifiedAt?: date }` for sources that are library-specific.
- **P5-35** — Lint that every library name appearing in `frameworkMap.*` prose corresponds to a known `LIBRARY_VERSIONS` key.
- **P5-36** — CI script that fetches each library's latest stable version (npm registry / docs sniff) and opens a PR when local pin lags upstream by N months.

## Alternatives considered

- **Per-source date** (option 1) rejected: scales linearly with component count; bumping Radix means visiting every component that references it.
- **Structured sources[] shape** (option 2) rejected: forces a schema change for all components, conflates URL-list with library-list, and the URL-list also contains spec/doc URLs that have no library to pin.
- **No table at all, rely on commit-message discipline** rejected: invisible, ungrep-able, breaks under any contributor turnover.
