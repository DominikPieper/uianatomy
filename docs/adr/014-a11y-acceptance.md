# ADR 014: A11y Acceptance Section

**Status:** Accepted
**Date:** 2026-04

## Context

Phase-1 components carry per-slot `a11y.hint` prose (a single sentence per anatomy slot describing how that slot should be implemented for assistive tech). The hints are *guidance*, not *acceptance criteria* — they document what the implementer should do, but they do not state what a test would assert. Two questions go unanswered:

1. **What is the keyboard walk?** Modal's mistake `modal-no-focus-trap` says "implement a focus trap"; the Tabs mistake `tabs-no-arrow-keys` says "Arrow keys move focus". But the canon does not list, in order, what each key does on each component. Implementers re-derive the walk from APG every time, and reviewers have no checklist to assert against.
2. **What does the screen reader say?** Modal's `a11y.hint` on the container says "label via `aria-labelledby`"; Combobox's mistake `combobox-no-aria-expanded` says "set `aria-expanded`". But the canon does not say what the SR *announces* — "Edit profile, dialog" vs "<label>, combobox, expanded false".
3. **Which axe-core rules apply?** axe-core ships ~90 rules; only a fraction are relevant per component. Without a list, reviewers either run all rules and over-report, or skip axe entirely.

Backlog item P2-15 closes the gap with a structured `a11yAcceptance` field. The field is *testable* — keyboard walks can be enumerated in vitest + Playwright, announcements can be enumerated against axe + virtual SR snapshots, and axe rules can be enumerated as the assertion list for `axe.run()` in CI.

ADR-001 (Canon first) and ADR-008 / ADR-009 / ADR-011 (free prose for triggers / changes / payloads) constrain the design. `keyboardWalk` and `announcements` use prose for the expected-behavior side; `axeRules` is a closed list of kebab-case identifiers.

## Decision

`a11yAcceptance` enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`, `responsive`, `events`. Three sub-arrays, each independently optional:

```yaml
a11yAcceptance:                                 # optional
  keyboardWalk:                                 # optional, min 1 when present
    - keys: Tab
      expected: >-
        Focus moves to the next focusable inside the dialog. After the
        last focusable, focus cycles back to the first.
    - keys: Shift+Tab
      expected: >-
        Focus moves to the previous focusable inside the dialog.
  announcements:                                # optional, min 1 when present
    - trigger: Dialog opens
      expected: >-
        SR announces the title via `aria-labelledby`, then "dialog"
        (e.g. "Edit profile, dialog").
  axeRules:                                     # optional, min 1 when present
    - aria-dialog-name
    - aria-modal-misuse
    - color-contrast
```

The schema:

```ts
const axeRuleId = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    'axe rule id must be kebab-case (e.g. button-name, color-contrast)',
  );

const keyboardWalkEntrySchema = z
  .object({
    keys: z.string().min(1),
    expected: z.string().min(1),
  })
  .strict();

const announcementEntrySchema = z
  .object({
    trigger: z.string().min(1),
    expected: z.string().min(1),
  })
  .strict();

export const a11yAcceptanceSchema = z
  .object({
    keyboardWalk: z.array(keyboardWalkEntrySchema).min(1).optional(),
    announcements: z.array(announcementEntrySchema).min(1).optional(),
    axeRules: z.array(axeRuleId).min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.keyboardWalk !== undefined ||
      v.announcements !== undefined ||
      v.axeRules !== undefined,
    { message: 'a11yAcceptance must declare at least one of keyboardWalk, announcements, axeRules' },
  );
```

Render: `A11yAcceptanceTable.astro` slots into Dev view and Bridge view immediately after the existing `A11yTable` (per-slot hints). Designer view is intentionally not changed — the per-slot `a11y.hint` is already in Designer view via the existing A11yTable, and a full keyboard walk + axe-rules table reads as dev-tooling content. If designer feedback later requests a stripped-down keyboard walk in Designer view, it can land as a follow-up.

## Rationale

### Why three sub-arrays, not one flat list

The three concerns are read by different audiences in different moments:

- **keyboardWalk** is the test plan for keyboard QA — read top-to-bottom, executed key-by-key.
- **announcements** is the test plan for SR QA — read trigger-by-trigger, asserted against virtual SR output.
- **axeRules** is the configuration for axe-core in CI — read as a flat list, fed to `axe.run({ runOnly: { type: 'rule', values: [...] } })`.

Mixing them into one array forces every consumer to filter by shape. Splitting them makes the structure self-explanatory and lets each render section choose the right table layout (two-column for walk, two-column for announcements, chip list for axe rules).

### Why all three sub-arrays are optional but the top-level field requires at least one

A component might genuinely have no canonical keyboard walk worth recording (Card's "focus enters nested actions" is too generic to enumerate), no SR announcement worth pinning (announcements are inherent to standard role+name+state semantics), or no axe-rule list (a purely visual concern). Forcing all three would punish components with sparse a11y stories.

But `a11yAcceptance: {}` — the field present, all sub-arrays absent — is a dead-letter declaration. The Zod refine catches it at parse time with a clear message ("must declare at least one of …"). Same discipline as the `events: []` and `breakpoints: []` rejections elsewhere.

### Why `keys` and `trigger` are free prose, not structured

A structured `keys: { primary: 'Escape', modifier: null }` was considered. Rejected:

1. **The space of key combos is open and tail-heavy.** Tabs has "ArrowLeft / ArrowRight (horizontal) or ArrowUp / ArrowDown (vertical)" — that is one *keyboardWalk entry*, not four. Encoding it as structure either splits into four entries (loses the orientation context) or invents a "key set" sub-schema with branching logic.
2. **Triggers are similarly open.** Modal's "Dialog closes" trigger is fine as prose; trying to encode it as `{ event: 'closed', source: 'escape' | 'backdrop' | 'closeButton' }` re-creates the structured-trigger problem ADR-009 already rejected.
3. **The `expected` side must be prose anyway.** Once `expected` is prose, spending the structure budget on the *cause* side adds asymmetry without adding validation.

### Why `axeRules` is a flat list of kebab-case ids, not structured

axe-core publishes a fixed set of rule ids (https://dequeuniversity.com/rules/axe/). Each id is kebab-case (`aria-dialog-name`, `color-contrast`, `button-name`). The schema enforces shape (regex) but not membership — axe-core ships new rules in minor versions, and pinning the membership in the canonical schema would force a schema bump per axe release. Review and CI catch invalid ids when the actual `axe.run()` call rejects them.

A structured rule entry (`{ id, criticality, notes }`) was considered. Rejected: criticality is set by axe-core, not by the canonical author; notes belong in `mistakes` or `a11y.hint` if they describe the *why*. The list is a reference to axe-core's vocabulary, not a parallel definition of it.

### Why per-component, not per-slot

Keyboard walks and announcements are component-level vocabulary — Tabs's roving-tabindex behavior spans tablist + tab + tabpanel; Combobox's arrow-key model spans input + listbox + option. Per-slot attachment would either duplicate the same walk across multiple slots or invent a "primary slot owns the walk" rule. Same anchor as motion (ADR-007), responsive (ADR-008), events (ADR-011).

The existing per-slot `a11y.hint` covers slot-level a11y guidance ("body retains its native semantics"); `a11yAcceptance` covers component-level acceptance criteria ("Tab cycles within the dialog"). Both fields earn their keep — the former is *guidance*, the latter is *test contract*.

### Why Dev + Bridge views, not Designer

Designer view already shows per-slot `a11y.hint` (Designer-specific phrasing: "label via `aria-labelledby`"). A keyboard walk + axe-rules table reads as dev-tooling content — designer audiences care that the walk *exists* (it does, surfaced via mistakes like `modal-no-focus-trap`), not the per-key acceptance criterion. Bridge view exists exactly for the cross-team-misalignment case ("designer thinks tabs work like radio buttons; dev knows the roving tabindex"), so rendering acceptance there is high-value.

If designer audiences later request a stripped keyboard walk (just the `keys` column without expected prose), it lands as a follow-up. P2-15 ships Dev + Bridge.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P2-15):

```ts
const axeRuleId = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);

export const keyboardWalkEntrySchema = z.object({
  keys: z.string().min(1),
  expected: z.string().min(1),
}).strict();

export const announcementEntrySchema = z.object({
  trigger: z.string().min(1),
  expected: z.string().min(1),
}).strict();

export const a11yAcceptanceSchema = z.object({
  keyboardWalk: z.array(keyboardWalkEntrySchema).min(1).optional(),
  announcements: z.array(announcementEntrySchema).min(1).optional(),
  axeRules: z.array(axeRuleId).min(1).optional(),
}).strict().refine(
  (v) => v.keyboardWalk !== undefined || v.announcements !== undefined || v.axeRules !== undefined,
  { message: '...' },
);

// componentSchema gains: a11yAcceptance: a11yAcceptanceSchema.optional()
```

Implementation side — deferred. A future Phase-2 audit field could record per-implementation deltas (e.g. "Radix Dialog ships `aria-modal` automatically; React Aria requires manual config"), but the canonical contract is what readers test against. File as P5-3X if a real audit exposes the gap.

## Phase 1 implication

All five Phase-1 components migrate to declare `a11yAcceptance`. Each gets at least `axeRules` (every component has applicable rules); most also get `keyboardWalk` + `announcements`. The render component (`A11yAcceptanceTable.astro`) lands in Dev view and Bridge view after the existing A11yTable. Designer view is unchanged.

The MCP tool surface gains `get_a11y_acceptance` once the field has been stable for one or more Phase-2 audits — file as a follow-up. P4-24 already expanded the MCP tool surface; one more tool is mechanical.

## Consequences

**Positive:**

- Implementers get a reference test plan for keyboard QA, SR QA, and axe-core CI configuration — three documents condensed into one structured field.
- Bridge view gains the cross-team-misalignment surface for a11y ("the designer thinks Escape closes; the developer knows it depends on `dismissible`").
- Phase-2 implementation audits can record a11y deltas against a structured contract instead of prose.
- CI a11y checks get a per-component axe-rules whitelist that filters out noise from rules irrelevant to the component.

**Negative:**

- Authoring overhead per component grows by ~30–50 lines of prose. Mitigated by the fact that the prose was already implicit in `mistakes` + `a11y.hint` — formalising it costs less than re-deriving it on every audit.
- YAML colons inside backtick-formatted prose (e.g. `` `dismissible: true` ``) require quoting the surrounding string. Discovered during migration; documented in the schema docs as a YAML-syntax footnote rather than a schema constraint.

**Neutral:**

- A future Phase-2 `a11yAcceptanceBindings` field could record the actual axe runs per implementation. Out of scope for P2-15; file when the first implementation audit needs it.
- A future MCP tool `get_a11y_acceptance` is mechanical. Defer until P4-24-style refactor that adds Phase-2 tools.

## Alternatives considered

**Per-slot `a11y.acceptance`**: rejected. Acceptance is component-level vocabulary; per-slot duplication is the failure mode the existing `a11y.hint` already avoided in the other direction. Same anchor as motion / responsive / events.

**Single flat `acceptance: [{ kind, ... }]` array**: rejected. Three concerns with three audiences; consumers would filter by `kind` on every read. Sub-arrays are self-documenting.

**Required `keyboardWalk`**: rejected. Card has no canonical keyboard walk worth recording — its keyboard story is "nested elements in document order". Forcing it would invent prose for prose's sake.

**Structured `keys` field**: rejected. The space of key combos is open; orientation-conditional combos (Tabs's "ArrowLeft / ArrowRight horizontal or ArrowUp / ArrowDown vertical") are one entry, not four; spending the structure budget on the cause side adds asymmetry without adding validation.

**Validating `axeRules` against a fixed axe-core vocabulary**: rejected. Axe-core ships new rules in minor versions; pinning the vocabulary in the canonical schema would force schema bumps per axe release. Shape regex is enough; CI catches invalid ids when `axe.run()` rejects them.

**Rendering `a11yAcceptance` in Designer view too**: deferred. The per-slot `a11y.hint` already covers Designer needs; full acceptance reads as dev tooling. If designer feedback later requests a stripped walk, it lands as a follow-up.

**Empty sub-arrays allowed (`keyboardWalk: []`)**: rejected. Same dead-letter rejection as everywhere else in the schema. `min(1)` is the right shape for any array that is opted into.
