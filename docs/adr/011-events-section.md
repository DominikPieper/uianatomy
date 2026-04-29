# ADR 011: Events Section as a Top-Level Component Concern

**Status:** Accepted
**Date:** 2026-04

## Context

Three of the five Phase-1 canonical components — Modal, Combobox, Tabs — expose first-class event vocabulary that the canon does not yet name:

- **Modal** has a controlled-pattern open/close cycle and a *dismiss* path that needs to be distinguishable from a programmatic close (the mistake `modal-no-focus-restore` and the mismatch on close-button-as-static-glyph both touch this, but the events themselves are not declared).
- **Tabs** has a selection event whose semantics differ between `activation: automatic` and `activation: manual`. Today the `activation` property is documented but the consumer-facing event surface is not — implementers re-derive `onValueChange` vs `onAction` per library.
- **Combobox** has at least three first-class events (input-string change, selection commit, popup open/close) that already drive the existing transition graph (ADR-009) but have no canonical name. The mistake `combobox-strict-without-feedback` is partly about the *absence* of an event for blur-with-invalid.

Without an explicit `events` field, this knowledge is trapped in prose across `mistakes`, `mismatches`, and `a11y` hints. Bridge view cannot surface the designer/developer mismatch around event vocabulary ("designers think 'click' is the only thing happening; developers track six callbacks"). Phase-2 audits cannot record per-implementation handler signatures. The `frameworkMap` field documents *structure* and *variant mechanism* but is silent on event surface — by design, because mixing structure-level and event-level concerns in one record was already known to crowd the table.

ADR-007 (Motion) reserved this slot in its Consequences:

> Some motion concepts straddle the boundary with state machines (P1-8): a duration like `open` implies a transition like `closed → opening → open`.

ADR-009 (Transitions) carried that further by declaring the graph but explicitly leaving event-payload semantics to a future ADR:

> Phase 2 implementations record the concrete event handlers. When `implementations/atelier/modal.yaml` lands, it records the actual code (`onKeyDown` predicate, `onPointerDown` capture handler, `useEffect` cleanup). The canonical `trigger` is the *spec*; the implementation `transitionBindings` (a future Phase-2 field) is the *binding*. The spec is prose; the binding is structured.

This ADR is that future ADR for events. It is the precondition for backlog item P1-10. After P1-10 ships, Phase 1 is structurally complete — every concern that has a structural representation has one, and the path opens to P2 (content sections) and P5 (implementations).

ADR-001 (Canon first) and ADR-006 (canonical names, not values) constrain the design. Canonical events store *names* and *cross-framework idiom prose*; concrete handler signatures live in `implementations/<lib>/`.

## Decision

Events enter the schema as **one optional top-level field on `componentSchema`**, parallel to `axes`, `mismatches`, `mistakes`, `frameworkMap`, `motion`, `responsive`. Not on `anatomySlotSchema`.

Three required keys per event entry:

```yaml
events:                                            # optional, non-empty when present
  - name: selectedChange                           # camelCase
    payload: >-                                    # free-text prose
      The id of the newly selected tab — always a string matching one of
      the rendered tab ids; never empty.
    frameworkNotes:                                # all four required
      webComponents: '`change` CustomEvent on the host …'
      react: '`onValueChange(value: string)` (Radix) or `onSelectionChange(key)` (React Aria).'
      angularSignals: '`output<string>(''selectedChange'')`; pair with `[(selected)]`.'
      vue: '`@update:modelValue` for `v-model` on the selected id.'
```

The schema:

```ts
const eventName = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'event name must be camelCase, e.g. select, openChange');

export const eventFrameworkNotesSchema = z
  .object({
    webComponents: z.string().min(1),
    react: z.string().min(1),
    angularSignals: z.string().min(1),
    vue: z.string().min(1),
  })
  .strict();

export const eventSchema = z
  .object({
    name: eventName,
    payload: z.string().min(1),
    frameworkNotes: eventFrameworkNotesSchema,
  })
  .strict();

// componentSchema gains: events: z.array(eventSchema).min(1).optional();
```

Render: a new `EventsTable.astro` slots into Dev view (after `FrameworkMapTable`) and Bridge view (after `FrameworkMapTable`). Designer view does not render events — events are dev-side concept, and the Designer view is intentionally lighter on dev concerns.

## Rationale

### Why per-component, not per-anatomy-slot

Events are component-level vocabulary. Tabs's `selectedChange` is not "an event on the tablist slot" — it is the event the consumer wires to handle the component's primary mutation. Modal's `dismiss` is not "an event on the close-button slot" — Escape, backdrop click, and the close button all funnel into the same canonical event. Per-slot attachment would force every component to either duplicate the same event across slots (every slot of Modal carries `dismiss`) or invent a "primary slot owns the event" rule. Neither earns its complexity. Same anchor as ADR-007 (motion) and ADR-008 (responsive).

### Why structured `frameworkNotes` mirroring `frameworkMap`, not free text

A free-text `frameworkNotes: 'React: onChange(value); Vue: @update:modelValue; ...'` was considered. Rejected:

1. **Render parity with `frameworkMap`.** The Dev view already presents per-framework structure/variant rows in a four-column table. Events follow the same per-framework breakdown so consumers can scan one framework's idioms across all events without parsing prose.
2. **Search and tooling.** A future MCP tool (`get_events`) returns structured JSON; every consumer can extract "what is the React handler signature for Combobox `selectionChange`?" with `events.find(e => e.name === 'selectionChange').frameworkNotes.react` — no string-splitting on `;`.
3. **Required-all-four discipline.** Forcing each migrated component to write all four framework idioms catches the "we forgot Vue" gap at parse time. Free text would let a one-framework note slip through review.

### Why `payload` as prose, not structured

A structured payload (`payload: { kind: 'object', shape: {...} }` or `payload: { kind: 'enum', values: [...] }`) was considered. Rejected for the same reasons ADR-009 rejected structured triggers:

1. **The space of payloads is open.** Modal's `dismiss` payload is `{ reason: 'escape' | 'backdrop' | 'closeButton' }`. Combobox's `selectionChange` payload is `T | T[] | null` parameterised over the option type. Tabs's `selectedChange` payload is a string. A payload schema that captures all three would either be Zod-like (a parser inside a parser) or so loose that it adds no validation.
2. **Payload prose is the audience.** The consumer reads "the id of the newly selected tab — always a string matching one of the rendered tab ids; never empty" once and knows what to wire. A structured payload requires the same prose anyway, plus the structure itself.
3. **Phase-2 bindings own the structured form.** When `implementations/<lib>/<id>.yaml` lands, `eventBindings` records the concrete TypeScript signature. The canonical `payload` is the *spec*; the implementation binding is the *binding*. Same separation as transitions (ADR-009).

### Why `name` is camelCase, not kebab-case

Three of four target frameworks (React, Angular Signals, Vue) use camelCase event identifiers. Web Components conventionally use lowercase or kebab-case for native CustomEvent names, but `frameworkNotes.webComponents` documents the actual emitted name per host — the canonical `name` is the *concept*, and the WC note translates to the wire format. Authoring a kebab-case canonical name would force three of four frameworks into a translation in the notes; camelCase reads cleanly in JSX/templates and the WC note carries the kebab form when needed.

### Why required-all-four `frameworkNotes`, not optional

Optional per-framework keys would let an author skip "we don't know how Vue spells this" and ship an incomplete reference. The discipline of requiring all four is the same discipline `frameworkMap` already enforces: if the component is canonical, it has a story in every supported framework. Reviewers catch missing frameworks at the `frameworkMap` level today; events extend that contract.

If a framework genuinely cannot express an event (a hypothetical `onAnimationFrame` event that no current Web Components host emits), the note documents the gap explicitly: `webComponents: 'No host-level event; consumers can listen on the underlying animation primitive directly.'` That is more useful than an absent key.

### Why `min(1)` on the events array, not a default empty array

Empty `events: []` is a dead-letter — it expresses "this component declared events, then declared zero of them". The minimum-of-one constraint forces authors to either commit (`events: [{...}]`) or omit the field entirely. Same discipline as `breakpoints.min(1)` (ADR-008) and `durations` non-empty refine (ADR-007).

### Why Dev + Bridge views, not Designer

Designer view is intentionally lighter on dev concerns. Events are dev-side vocabulary — callback signatures, framework idioms, payload shapes. Bridge view exists to surface the designer/developer mismatch, and event vocabulary is exactly that ("designers think one click; devs see six callbacks"). Designer view would need either a stripped-down event list (which loses the cross-framework value) or full notes (which crowds the Designer view). The split is the same as `FrameworkMapTable`: Dev + Bridge render it, Designer does not.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P1-10):

```ts
const eventName = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'event name must be camelCase, e.g. select, openChange');

export const eventFrameworkNotesSchema = z
  .object({
    webComponents: z.string().min(1),
    react: z.string().min(1),
    angularSignals: z.string().min(1),
    vue: z.string().min(1),
  })
  .strict();

export const eventSchema = z
  .object({
    name: eventName,
    payload: z.string().min(1),
    frameworkNotes: eventFrameworkNotesSchema,
  })
  .strict();

// componentSchema gains: events: z.array(eventSchema).min(1).optional();
```

Implementation side — deferred. When `implementations/<lib>/<id>.yaml` is created in Phase 2, `eventBindings` will record the concrete handler signatures per canonical event:

```yaml
eventBindings:
  - canonicalEvent: selectedChange
    implementation:
      handlerName: onValueChange
      signature: '(value: string) => void'
      libraryReference: 'https://radix-ui.com/primitives/docs/components/tabs#root'
      notes: >-
        Radix passes the canonical id directly. No transformation needed.
```

The shape is sketched here for review continuity; the schema entry for `eventBindings` is filed as a Phase-2 backlog item, not added in P1-10.

## Phase 1 implication

The `events` field on `componentSchema` is **optional**. Phase 1 ships migrating only the three components whose canonical content already encodes event vocabulary (Modal, Tabs, Combobox). Card and Button stay unmigrated:

- **Card**: a card's primary "event" is a click on its title-as-link or its action buttons — already documented at the slot level via `interactive: boolean` and the overlay pattern. No component-level event surface beyond what the underlying `<a>` or `<button>` exposes natively.
- **Button**: `click` is the native DOM event. Adding it as a canonical event would document a tautology; the `frameworkMap` already covers structure, the native event is the event. If Button later adds a `loadingChange` event around its `loading` state (currently a data state with no exposed callback), file as a separate item.

The Dev view and Bridge view both gain an Events section after `FrameworkMapTable`. Designer view does not render events. The MCP tool surface stays unchanged. Backlog item P4-24 picks up `get_events` once Phase-2 audits surface a concrete consumer.

## Consequences

**Positive:**

- Modal's dismiss-vs-commit distinction (currently buried in `mistakes` and `a11y` prose) gains a canonical name and payload.
- Tabs's `activation: automatic` vs `manual` mode now has an event-level counterpart: `selectedChange` covers automatic, `tabActivate` distinguishes manual.
- Combobox's three primary events (`inputChange`, `selectionChange`, `openChange`) are first-class data, not implicit knowledge in `frameworkMap` or `mistakes`.
- Bridge view gains real event content — the canonical "designer thinks one click, developer wires six handlers" mismatch is visible.
- Phase-2 implementation bindings get a structured target. `eventBindings` in a future `implementations/<lib>/<id>.yaml` can match against canonical event names without re-parsing prose.

**Negative:**

- One more optional top-level field on `componentSchema`. Mitigated: optional fields have zero migration cost for unaffected components, and events concern only three of five Phase-1 components.
- `frameworkNotes` requires all four framework idioms per event. For three components × ~2.3 events each, that is roughly 28 prose entries to write and review. Mitigated by the small count and the high signal: every entry documents real cross-framework variation.
- Authors may be tempted to add canonical events for trivial cases (e.g., Button's `click`). Mitigated by ADR rationale and review discipline — events are for cross-framework vocabulary that varies, not for native DOM events that don't.

**Neutral:**

- A future ADR may add `eventBindings` (Phase-2 implementation field) and `get_events` (MCP tool). Both are deferred until Phase 2 audits surface concrete consumers.
- Some events overlap with state transitions (ADR-009): Modal's `openChange` correlates with `closing → closed` and `opening → open`. The two fields stay separate — transitions describe *what state does the component move through*, events describe *what does the consumer receive*. They reference each other in prose but stay structurally independent.

## Alternatives considered

**Per-slot events (`anatomy[].events`)**: rejected. Events are component-level vocabulary; per-slot attachment forces duplication or a "primary slot owns the event" rule. Same anchor as motion (ADR-007) and responsive (ADR-008).

**Free-text `frameworkNotes`**: rejected. Loses render parity with `frameworkMap`, loses the required-all-four discipline, makes future MCP `get_events` consumers parse prose to extract per-framework idioms.

**Structured `payload`** (Zod-like shape descriptor): rejected. The space of payloads is open and parameterised over option types; structured form requires either a parser inside the schema or so loose a shape that it adds no validation. Phase-2 bindings own the structured form.

**Optional `frameworkNotes` keys**: rejected. Lets a missing framework slip through review. The required-all-four discipline catches the "we forgot Vue" gap at parse time.

**`name` as kebab-case**: rejected. Three of four target frameworks use camelCase; `frameworkNotes.webComponents` documents the wire format when WC needs kebab. Canonical `name` is the *concept*, not the wire format.

**Designer view also rendering events**: rejected. Events are dev-side concept; full notes crowd the Designer view, stripped notes lose the cross-framework value. Same split as `FrameworkMapTable`.

**Default empty `events: []`**: rejected. `events: []` is a dead-letter that expresses "I declared events, then declared zero". The min-1 constraint forces commit-or-omit, same discipline as `breakpoints.min(1)` (ADR-008).

**Bundling events into `frameworkMap` as a fifth row**: rejected. `frameworkMap` documents *structure* and *variant mechanism*; mixing event surface in the same record crowds the table and loses the ability to render events as a discrete section. Separate concerns deserve separate fields.
