# ADR 036: React Required, Other Frameworks Optional on Multi-Framework Fields

**Status:** Accepted
**Date:** 2026-07
**Supersedes:** none (loosens a requirement; additive/backwards-compatible)
**Related:** Design-review 2026-07-03 (P6-205)

## Context

Four schema surfaces require prose for all of `webComponents`, `react`, `angularSignals`, `vue` simultaneously, with no way to declare fewer:

- `frameworkMapSchema` (`shared/src/schema.ts`) — required top-level on every component (41/41).
- `eventFrameworkNotesSchema`, nested in every `events[]` entry — required whenever a component declares events.
- `formIntegrationBridgesSchema`, nested in `formIntegration.bridges` — required whenever a component declares `bridges`.
- `frameworkSkeletonsSchema` (`shared/src/schema.ts`) — required top-level on every pattern (2/2).

The 2026-07-03 design review's data-model pass counted roughly 380 event-note cells alone (41 components × ~2-3 events each × 4 frameworks) and found many formulaic or interpolated rather than researched: `output<boolean>('checkedChange')`-style Angular signal notes and `@update:modelValue`-style Vue notes recur near-verbatim across unrelated components, because the *mechanism* (Angular's `output()`, Vue's `v-model` convention) is a framework idiom, not a fact specific to the component. Forcing all four to be authored every time produces two costs: authors (agent or human) spend effort restating a mechanical idiom instead of researching a real divergence, and adding a fifth framework (Svelte, Solid — both open in `docs/backlog.md` as P6-78) would require touching all 41 components × 4 surfaces just to backfill a non-optional field.

The canon's own research priorities (`docs/methodology.md`, and every `library-audit-runner` pass to date) are React-first: Radix, React Aria, Headless UI's React variant, and most cited implementation audits are React libraries. React is also the framework with an actual Phase-2 implementation corpus behind it (`implementations/{radix,react-aria,headlessui,cdk}/*.yaml` are all React-ecosystem libraries except `cdk`, which is Angular but audits the *component*, not the framework-mapping prose). Vue, Angular-signals, and Web-Components notes on `frameworkMap`/events/bridges are comparatively less-researched by construction — they exist to satisfy the schema requirement, not because the canon audited a Vue library the way it audited Radix.

## Decision

Make `webComponents`, `angularSignals`, and `vue` optional on all four schemas; `react` stays required.

```ts
const frameworkEntrySchema = z.object({
  structureMechanism: z.string().min(1),
  variantMechanism: z.string().min(1),
});

export const frameworkMapSchema = z.object({
  react: frameworkEntrySchema,
  webComponents: frameworkEntrySchema.optional(),
  angularSignals: frameworkEntrySchema.optional(),
  vue: frameworkEntrySchema.optional(),
});

export const eventFrameworkNotesSchema = z
  .object({
    react: z.string().min(1),
    webComponents: z.string().min(1).optional(),
    angularSignals: z.string().min(1).optional(),
    vue: z.string().min(1).optional(),
  })
  .strict();

export const formIntegrationBridgesSchema = z
  .object({
    react: z.string().min(1),
    webComponents: z.string().min(1).optional(),
    vue: z.string().min(1).optional(),
    angularSignals: z.string().min(1).optional(),
  })
  .strict();

export const frameworkSkeletonsSchema = z
  .object({
    react: z.string().min(1),
    webComponents: z.string().min(1).optional(),
    vue: z.string().min(1).optional(),
    angularSignals: z.string().min(1).optional(),
  })
  .strict();
```

No backfill: this is a pure loosening — every one of the 41 existing components and 2 patterns already declares all four, so nothing in the corpus needs to change. The effect is entirely forward-looking: new components/events/skeletons may omit the three optional frameworks when their notes would just restate a mechanical idiom, and a fifth framework (P6-78) can land as its own optional field on all four schemas without a 41-file backfill.

Render-side (`FrameworkMapTable.astro`, `EventsTable.astro`, `PatternFrameworkSkeletons.astro`) is updated to skip a framework row/column when its entry is absent, instead of rendering an empty cell.

## Rationale

**React, not some other framework, is the anchor.** The alternative — no anchor, all four optional — was rejected because a fully-optional set has no guaranteed content at all (a component could ship zero framework mapping and still pass validation), which is worse than the status quo, not better. React is the framework the canon's actual research corpus (Radix, React Aria, most Phase-2 audits) is grounded in, so requiring it costs nothing the canon wasn't already doing, and gives every record a guaranteed, well-researched framework mapping.

**Loosen the requirement, don't derive the mechanical idiom from a convention table.** The review's alternative framing — "derive the mechanical Vue/WC idioms from a convention table in `vocabulary.ts`" — was considered and rejected for now. It would need a new data shape (a per-component note is either free prose *or* a reference to a shared convention entry, i.e. a discriminated union) and a decision about which idioms are "mechanical enough" to templatize versus genuinely divergent per component — Vue's `v-model` binding is mechanical for a simple input but not for a component with multiple bindable properties (Combobox's value vs. its open state). That's a second, larger schema change with its own migration question; this ADR keeps scope to "stop requiring authorship nobody researched," not "auto-generate what authorship would have said."

**Consistency with ADR-035.** Both this ADR and ADR-035 respond to the same review finding pattern: a uniform requirement (a count floor, a 4-framework fan-out) that pressures authors toward filler content, fixed by loosening the requirement to what the canon can actually back with research, while leaving richer alternatives (citation lint, convention-table derivation) as deferred follow-ups rather than bundling them in.

## Consequences

**Positive:**
- New content no longer forces formulaic Vue/Angular/Web-Components prose. An author who genuinely researched Vue's binding can still write it; an author with nothing specific to say is no longer pressured to invent something to pass Zod.
- P6-78 (frameworkMap expansion to Svelte/SolidJS/Lit/Qwik) becomes additive on its own terms — a new optional field, no backfill obligation on the existing 43 records (41 components + 2 patterns).
- No migration risk: every existing YAML already satisfies the new, weaker schema.

**Negative:**
- The corpus can now legitimately have framework-mapping gaps (a component with only a React note). This is an accepted trade-off — the review's finding was that non-React notes were frequently low-value filler, so their absence is not a real information loss in the cases that matter.
- Render components (`FrameworkMapTable`, `EventsTable`, `PatternFrameworkSkeletons`) need to handle a framework being absent per-entry rather than assuming a fixed 4-column grid; this is contained to three files and does not change their column layout when all four are present (today's default).

## Alternatives considered

**All four optional, no required anchor.** Rejected — see Decision. Guarantees nothing; a schema that can validate an empty framework mapping is a schema that will eventually contain one.

**Convention-table derivation for mechanical idioms (`vocabulary.ts`).** Rejected for now, not rejected outright. Requires a new discriminated data shape and a per-idiom judgment call about what's "mechanical enough" to templatize; worth a dedicated `schema-field-add` cycle if optional-framework gaps prove to be a real content problem rather than a solved one.

**Leave all four required, rely on editorial discipline to keep notes substantive.** Rejected — this is the status quo the review's finding was about; discipline without a schema change did not prevent the formulaic-content pattern from recurring at ~380-cell scale.
