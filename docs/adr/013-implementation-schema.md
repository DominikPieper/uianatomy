# ADR 013: Phase-2 Implementation YAML Schema (Divergence-First MVP)

**Status:** Accepted
**Date:** 2026-04

## Context

ADR-004 established that canonical and implementation data live in physically separated directories with separate schemas. The canonical side (`content/components/<id>.yaml`, schema in `shared/src/schema.ts:componentSchema`) has shipped Phase 1 with five components. The implementation side (`implementations/<lib>/<id>.yaml`) was sketched in ADR-004's Implementation-schema-for section but never landed.

Backlog item P5-26 is the first concrete Phase-2 contact: ship `implementations/radix/` with at least one component audit. This ADR defines the schema that lands with that audit.

ADRs 006–011 each reserved a Phase-2 follow-up field for implementation bindings:

- ADR-006 Tokens: `tokenBindings: [{ slotId, category, property, canonicalToken, value, sourceToken }]`
- ADR-007 Motion: `motionBindings: { durations: [...], easing: {...} }`
- ADR-009 Transitions: `transitionBindings: [{ canonicalTransition: { from, to }, implementation: { eventName, handlerSnippet } }]`
- ADR-011 Events: `eventBindings: [{ canonicalEvent, implementation: { handlerName, signature, libraryReference, notes } }]`

Each of those is a separate concern, owns its own discipline (token-name resolution, duration-value resolution, event-handler signature recording), and was deliberately filed as a *future* ADR rather than collected into one mega-schema.

P5-26 must land *something* — a fully-bindings-rich first cut would push P5-26 across multiple sessions and probably misjudge a dimension nobody has audited yet. The pragmatic answer is a **divergence-first MVP**: land the metadata + the divergence shape now, defer each binding family to its own ADR (014, 015, ...) when a real audit needs it.

## Decision

The Phase-2 implementation schema lands as a six-field record:

```yaml
componentId: modal                  # references content/components/<id>.yaml
libraryId: radix                    # matches the parent directory name
componentName: Dialog               # the actual name in the implementation
exampleCode: |                      # optional multi-line code sample
  import * as Dialog from '@radix-ui/react-dialog';
  ...
divergence:                         # optional, min 1 when present
  - from: anatomy[backdrop]
    type: renamed
    to: Dialog.Overlay
    rationale: Same role; Radix uses "Overlay" terminology.
rationale: |                        # optional free-text overall summary
  Radix Dialog is a low-level unstyled primitive that ...
lastReviewed: 2026-04-29            # required ISO date
```

The schema:

```ts
const canonicalRefPath = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*|\[[a-zA-Z0-9-]+\])+$/,
    'canonical reference must be a dotted path with optional [index] suffix',
  );

const omittedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('omitted'),
    rationale: z.string().min(1),
  })
  .strict();

const renamedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('renamed'),
    to: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const extendedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('extended'),
    addition: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const reshapedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('reshaped'),
    to: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const divergenceSchema = z.discriminatedUnion('type', [
  omittedDivergenceSchema,
  renamedDivergenceSchema,
  extendedDivergenceSchema,
  reshapedDivergenceSchema,
]);

export const implementationSchema = z
  .object({
    componentId: slug,
    libraryId: slug,
    componentName: z.string().min(1),
    exampleCode: z.string().min(1).optional(),
    divergence: z.array(divergenceSchema).min(1).optional(),
    rationale: z.string().min(1).optional(),
    lastReviewed: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'lastReviewed must be ISO YYYY-MM-DD'),
  })
  .strict();
```

Loaders: `loadImplementation(filePath)` and `loadImplementations({ implementationsDir })` parallel the existing canonical loaders. The aggregate loader returns `Map<libraryId, Map<componentId, Implementation>>`. Library-id mismatch (a YAML inside `implementations/radix/` declaring `libraryId: foo`) is a parse error, not a schema error — caught in the loader.

`tokenBindings`, `motionBindings`, `transitionBindings`, `eventBindings` are **deferred**. Each gets its own follow-up ADR + backlog item when a real audit needs it (ADR-014 through ADR-017, file separately).

## Rationale

### Why divergence-first, not bindings-rich

A "complete" Phase-2 schema would land all four binding families in one go: `tokenBindings`, `motionBindings`, `transitionBindings`, `eventBindings`. The cost is high (each family has its own validation discipline, each schema must be debugged against a real audit) and the discovery problem is real — every Phase-1 ADR that reserved a binding shape did so in advance of any audit. Real audits surface concerns the sketch cannot anticipate.

Divergence is the one shape that is *required* to do an audit at all. Without it, an implementation YAML reduces to "we have a Modal component named Dialog" — true but useless. The four divergence types (omitted / renamed / extended / reshaped) cover the entire space of canonical-vs-implementation deltas. Anything not captured by divergence is by definition *agreement* — the canonical entry holds.

Land divergence now, validate it against Radix Dialog (heaviest-divergence component), discover what the schema misses, fix it. Then bindings can land one family at a time against components that need them — `tokenBindings` for an audit that records token resolution, `motionBindings` for an audit that records timing values, etc. Each binding ADR is much smaller because it does not have to defend the entire Phase-2 surface in one document.

### Why a discriminated union by `type`

Same reason ADR-010 chose `kind`-discrimination for property types. Every consumer narrows on `type` and gets the appropriate payload (`to` for renamed/reshaped, `addition` for extended, neither for omitted). Shape-discrimination would force every consumer to write `'to' in d ? ... : 'addition' in d ? ...` chains; tagged discrimination reads at the call site.

The four type names mirror ADR-004's sketch verbatim (`omitted`, `renamed`, `extended`, `reshaped`). The names cover the full delta space:

- **omitted**: the canonical thing is not present in the implementation. `Dialog` has no header slot.
- **renamed**: the canonical thing is present under a different name. `backdrop` → `Dialog.Overlay`.
- **extended**: the canonical thing is present plus the implementation adds something. `axes.variants` plus a Radix-only `glass` variant. (Not used in the first audit; reserved.)
- **reshaped**: the canonical thing is present but the structural form differs. `container` is split across `Root` + `Portal` + `Content`. Or: a single `dismissible: boolean` prop becomes three separate callbacks.

### Why `from` is a string regex, not a typed reference into the canonical schema

A typed reference (`from: { kind: 'anatomySlot', slotId: 'backdrop' }`) was considered. Rejected:

1. **The space of references is open.** `anatomy[backdrop]`, `axes.variants[fullscreen]`, `axes.properties[size]`, `axes.states.transitions`, `motion.durations`, `responsive.breakpoints[breakpoint.sm]`, `events[openChange]`, `whenToUse.vsRelated[drawer]`. Encoding each as a typed kind would balloon the schema and force every new canonical field (each P1-* ADR introduced one) into a schema update on the implementation side too.
2. **String references survive canonical evolution.** When P1-9 transformed `property.type`, no implementation YAML existed that referenced it. A typed reference would have needed migration; a string reference is just prose that consumers can follow when they care to.
3. **Validation is lightweight.** The regex enforces shape (`identifier(\.identifier|\[index\])+`) without enforcing that the path actually resolves against the canonical schema. Cross-validation against the canon is a *future* refine — file as P5-30 if the gap becomes a recurring source of typos.

The bracket index allows `[a-zA-Z0-9-]+` so that kebab-case slot ids (`[backdrop]`), camelCase event/property names (`[openChange]`, `[size]`), single-token variant names (`[fullscreen]`), and dotted breakpoint tokens-as-keys (with adjustment) all parse.

### Why `divergence` is optional but `min(1)` when present

An implementation YAML with no divergence is meaningful — it asserts "this library implements the canonical anatomy as authored, with no deltas worth recording." Useful for trivial cases (a future Card audit might have zero divergence). Empty `divergence: []` is the dead-letter form rejected on the same grounds as `events: []` and `breakpoints: []` in earlier ADRs: declaring then-zero is a contentless act.

### Why `lastReviewed` is required and `componentName`/`componentId`/`libraryId` are required

`lastReviewed` is the audit-staleness signal. Phase 2's value collapses without it — an implementation YAML without a date is a snapshot of an unknown vintage. Requiring it forces every audit to commit to a moment in time, and a future "stale-audit" linter (P4-24-adjacent) can flag entries older than N months.

`componentId` is the join key against the canonical side. Without it, the implementation is unmappable. `libraryId` matches the parent directory and is also the join key on the library axis. `componentName` is the actual library symbol — needed for code generation and reference tooling.

`exampleCode`, `rationale`, `divergence` are all optional. A minimum-viable Phase-2 entry is `{ componentId, libraryId, componentName, lastReviewed }` — useful as a "we have this" record even before the audit prose lands.

### Why `.strict()` on the top-level + each divergence arm

Same discipline as ADR-008 / ADR-009 / ADR-011. Typos like `divergencce: [...]` or `addition:` on a `renamed` divergence fail loudly at parse time instead of silently dropping data. When binding families land in follow-up ADRs, each will add `.strict()` records and the top-level shape will gain the new fields explicitly.

### Why a parallel loader rather than extending `loadComponents`

`loadComponents` reads a flat directory of canonical YAMLs. `loadImplementations` reads a directory-of-directories (one subdirectory per library). The shapes differ enough that overloading one function would obscure both. The parallel loader also enforces the `libraryId === parentDirectoryName` invariant — a YAML claiming `libraryId: radix` inside `implementations/headlessui/` is caught at load time, not at consumer time.

## Phase 1 implication

P5-26 ships:

- The schema additions in `shared/src/schema.ts` (above).
- The `loadImplementation` / `loadImplementations` loaders in `shared/src/loader.ts`.
- The `Implementation` and `Divergence` type exports.
- The first audit at `implementations/radix/modal.yaml`.
- Eight new vitest cases (positive parse, all-four-types coverage, group-by-library, three negative cases, regex-failure case, strict-failure case).

Site rendering is **deferred**. The data is parseable and queryable; surfacing it in the site (per-component "Implementations" tab, divergence table) lands in a follow-up backlog item once a second library audit (Headless UI for Vue, CDK for Angular) lets the design choice "what does the implementations tab actually look like with multiple libraries?" be made against real data.

The MCP tool surface is **deferred**. `get_implementation`, `get_divergence`, `list_implementations` follow once site rendering settles — same staging discipline as P4-24.

P5-29 (test the divergence schema against a real implementation) is **implicitly closed by P5-26**. The Radix Modal audit exercises all four divergence types (one renamed, one omitted, two reshaped use cases, one regression-extended path filed in tests) plus the regex failure mode. The acceptance test for P5-29 was "does the schema survive a real audit?", and the answer is "yes, with one regex widening required to allow camelCase bracket indexes."

## Consequences

**Positive:**

- The first cross-canonical-vs-implementation audit lands. The discipline is in code, not in prose.
- Future implementation audits (Headless UI for Vue, CDK for Angular Signals, Radix expanding to other components) reuse the schema with no migration cost.
- The four divergence types are validated against a real audit; regex covers the full space of canonical-reference paths discovered to date.
- Phase-2 binding ADRs (014 token, 015 motion, 016 transition, 017 event — assuming this numbering) get a smaller scope each because the metadata + divergence chassis is already in place.

**Negative:**

- Implementation YAMLs cannot yet record concrete token values, duration values, transition handler snippets, or event handler signatures. These are deferred to follow-up ADRs. Audits that need to record them today will have to prose-it-into-the-rationale-field as a workaround.
- The site does not yet surface implementation data. Readers visiting `/components/modal` see the canonical Modal but not the Radix Dialog audit. Until the rendering work lands, the Phase-2 data is API-/test-/MCP-accessible but not page-visible.

**Neutral:**

- A "stale-audit" linter, a cross-canonical referential-integrity refine, and a per-implementation diff-vs-canon report are all logical follow-ups but not gating. File as P4-26+, P4-27+ as need surfaces.
- The first audit's regex widening (allow camelCase in bracket indexes) is a one-time discovery that future ADRs do not need to repeat. The widened regex covers slot ids (kebab), event names (camel), property names (camel), variant names (kebab single-token), and most reasonable dotted-token-as-bracket-index forms.

## Alternatives considered

**Bindings-rich first cut** (land all four binding families in P5-26): rejected. Each family deserves its own ADR debugged against a real audit. Shipping all four together would rush the design and probably miss dimensions only audits surface.

**Typed `from` reference**: rejected. The space of references is open; string regex is enough; canon-side referential validation is a future refine.

**No discriminator on divergence** (one shape with optional `to`/`addition`): rejected. Same reasons ADR-010 picked `kind`-discrimination for property types — typed narrowing, less prose, fewer "if `'to' in d`" chains in consumers.

**Putting `divergence` inside a generic `extensions: Record<string, unknown>` bag** (so future binding fields plug in without schema changes): rejected. Loses every benefit of typed validation. Phase 2 is meant to be the structured layer, not another unstructured prose dump.

**Single global `implementations.yaml` indexed by `[libraryId][componentId]`**: rejected. ADR-004's per-file-per-component-per-library structure is a deliberate forcing function — you cannot accidentally bundle two libraries' divergence data into a single edit, you cannot accidentally couple two components' audits. Per-file is better for diff review, blame, and parallel authoring.

**Keep `from` open without a regex**: considered. Rejected because typos like `from: 'anatomy/backdrop'` or `from: 'axes_variants'` would silently parse and confuse later consumers. The regex is loose enough to allow real paths without forcing structural validation.
