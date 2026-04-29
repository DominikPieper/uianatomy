# ADR 009: State-Machine Transitions Under `axes.states`

**Status:** Accepted
**Date:** 2026-04

## Context

Phase-1 canonical components declare states under `axes.states.interactive` and `axes.states.data` (per ADR-004's three-way `axes` distinction). The lists are vocabulary — "this component has these states" — but the canon is silent about *how* the component moves between them. Two cases make the gap concrete:

- **Modal** declares the four data states `opening`, `open`, `closing`, `closed`. Without transition vocabulary, the canon does not say that `closed → opening` requires capturing the trigger element for focus restoration, that `opening → open` engages the focus trap, that `open → closing` can be triggered by Escape only when `dismissible` is true, or that `closing → closed` releases the `inert` lock. The mistake `modal-no-focus-restore` describes one consequence of getting the graph wrong, but the graph itself is implicit.
- **Combobox** declares `closed`, `open`, `busy`, `invalid`. Without transitions, the canon does not say that `busy` is reachable only from `open`, that `invalid` is reachable only from `open` and only when `strict: true`, or that filtered async results return the component to `open` (not directly to `closed`). Implementations re-derive this graph from prose every time.

ADR-007 (Motion) added the *timing* of transitions but explicitly deferred the *shape* of the transition graph:

> Some motion concepts straddle the boundary with state machines (P1-8): a duration like `open` implies a transition like `closed → opening → open`. ADR-007 owns the *timing* of the transition; ADR-008 (when written) owns the *shape* of the transition graph. They reference each other but stay separate.

(ADR-007 referred to "ADR-008" as the planned state-machine ADR; the actual numbering shifted because P1-7 Responsive shipped between P1-6 and P1-8 and took ADR-008. This is ADR-009 — the ADR-007 reference resolves to *this* document.)

This ADR owns the transition graph. It is the precondition for backlog item P1-8.

## Decision

Transitions enter the schema as **an optional `transitions` array nested under `axes.states`**, not as a new top-level field. Each entry is `{ from, to, trigger }` where `from` and `to` reference declared interactive or data state names and `trigger` is a free-text description of what causes the transition.

```yaml
axes:
  states:
    interactive: [focus-visible]
    data: [opening, open, closing, closed]
    transitions:                              # NEW, optional
      - from: closed
        to: opening
        trigger: User activates the trigger that owns the dialog.
      - from: opening
        to: open
        trigger: The enter animation completes; focus moves into the dialog.
      - from: open
        to: closing
        trigger: Escape, close button, dismissible backdrop click, or programmatic close.
      - from: closing
        to: closed
        trigger: The exit animation completes; focus restores to the trigger.
```

The schema enforces a **cross-field invariant**: every `from` and `to` must be a member of the union `interactive ∪ data`. A `from` or `to` referring to an unknown state name is a build error.

## Rationale

### Why nested under `axes.states`, not a top-level `transitions` field

States are vocabulary; transitions are *changes between* the vocabulary. They are not independent concerns. A top-level `transitions` field would force authors to declare states in two places (the existing `axes.states.{interactive, data}` lists *and* a separate `transitions[]` keyed by the same names), or — worse — to imply states by mentioning them in transitions only. The cross-field refine then has to live across two top-level fields, which crosses an architectural boundary that no other refine in the schema crosses.

Nesting under `axes.states` keeps the state vocabulary and the state graph next to each other, mirrors how state machines are conventionally drawn (vertices and edges in one diagram), and keeps the cross-field refine local — `statesSchema.superRefine` checks consistency within one object, not across the schema root.

### Why `from` / `to` reference state *names*, not structured handles

A more rigorous shape would be `from: { kind: 'data', name: 'open' }` to disambiguate which state list a name belongs to. Rejected because:

1. **State names are unique within a component.** Modal does not have an interactive state called `open` and a data state called `open` — that would already be a content bug. The cross-field refine validates against the union, so collision would produce a meaningful error before transition validation ever runs.
2. **Prose is the audience.** Transition tables are read top-to-bottom; `from: open` reads cleanly, `from: { kind: 'data', name: 'open' }` reads as schema noise.
3. **The structural distinction does not affect transitions.** A transition from a data state to an interactive state is rare but legal (e.g., `busy → focus-visible` is incoherent, but `closed → focus-visible` would model "closing the popup also blurs the input" — a real graph). Forcing the kind into the entry makes the schema louder without preventing any real bug.

### Why a free-text `trigger`, not a structured event payload

A structured trigger (`trigger: { kind: 'keyboard', key: 'Escape' }`, `trigger: { kind: 'click', target: 'backdrop' }`, `trigger: { kind: 'async', source: 'filter-results' }`) was considered. Rejected for the same reasons ADR-008 rejected a structured `change` payload:

1. **The space of triggers is open.** Modal has keyboard, pointer, programmatic, and animation-completion triggers. Combobox has typed input, async result returns, blur with a strict-mode guard, focus restoration, and option selection. Future components will have triggers we cannot enumerate (Drawer's swipe gesture, Toast's auto-dismiss timeout, Carousel's intersection-observer slide).
2. **Triggers are often compound.** Modal's `open → closing` is "Escape OR close-button OR dismissible-backdrop-click OR primary-action commit OR programmatic close." Encoding the compound disjunction in structure is uglier than writing the prose.
3. **Phase 2 implementations record the concrete event handlers.** When `implementations/atelier/modal.yaml` lands, it records the actual code (`onKeyDown` predicate, `onPointerDown` capture handler, `useEffect` cleanup). The canonical `trigger` is the *spec*; the implementation `transitionBindings` (a future Phase-2 field) is the *binding*. The spec is prose; the binding is structured.

### Why cross-field refine, not just regex on `from` / `to`

The whole point of declaring transitions is to drive the canonical graph. A typo in `from: opening` → `from: openning` produces a transition that goes nowhere — silently, in a free-text-validated schema. Refine catches the typo at parse time with a path-anchored Zod issue (`axes.states.transitions[2].from: from "openning" must reference a declared interactive or data state`).

This is the first cross-field refine in the canonical schema. Precedent matters; future refines (e.g., "anatomy slot ids referenced in `mistakes[].fix` must exist") will follow this pattern.

### Why the union `interactive ∪ data`, not just `data`

Modal's transitions happen entirely within data states. Combobox's too. But a future component might transition between a data state and an interactive state (a focus-trap modal where `open` data state → `focus-visible` interactive state on first child is a genuine modelling). Restricting `from` / `to` to data only would force authors to invent ghost data states that mirror interactive states, defeating the existing three-way distinction.

The interactive/data split (per ADR's `axes` design) is about *who drives the state* (browser vs. app). Transitions are a separate dimension entirely — they are *how the state changes*, not *who declared it*. Allowing both sides keeps the dimensions orthogonal.

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P1-8):

```ts
export const transitionSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    trigger: z.string().min(1),
  })
  .strict();

export const statesSchema = z
  .object({
    interactive: z.array(z.string().min(1)),
    data: z.array(z.string().min(1)),
    transitions: z.array(transitionSchema).optional(),
  })
  .superRefine((states, ctx) => {
    if (!states.transitions) return;
    const declared = new Set([...states.interactive, ...states.data]);
    states.transitions.forEach((t, i) => {
      if (!declared.has(t.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transitions', i, 'from'],
          message: 'from "...": must reference a declared interactive or data state',
        });
      }
      if (!declared.has(t.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transitions', i, 'to'],
          message: 'to "...": must reference a declared interactive or data state',
        });
      }
    });
  });

// axesSchema.states becomes statesSchema (was an inline object)
```

Implementation side — deferred. When `implementations/<lib>/<id>.yaml` is created in Phase 2, `transitionBindings` will record the concrete event-handler code per canonical transition:

```yaml
transitionBindings:
  - canonicalTransition: { from: closed, to: opening }
    implementation:
      eventName: onShow
      handlerSnippet: |
        const restoreTo = document.activeElement;
        captureFocusReturn(restoreTo);
        setState('opening');
```

The shape is sketched here for review continuity; the schema entry for `transitionBindings` is filed as a Phase-2 backlog item, not added in P1-8.

## Phase 1 implication

The `transitions` field on `axes.states` is **optional**. Phase 1 ships migrating only the two components whose canonical entries already encode a non-trivial state graph (Modal, Combobox). Card, Tabs, and Button stay unmigrated:

- **Card**: data states `selected`, `loading` are independent of each other; no graph worth declaring (`* → selected` and `* → loading` is the trivial graph that an empty transitions array would represent).
- **Tabs**: the per-tab `selected` state is parameterised by which tab is active, not by a graph; `busy / lazy / error` per panel are reachable from any state and the graph is `* → busy → (loaded | error)` per panel — modellable but the canonical value is low until Phase 2 audits surface a concrete need.
- **Button**: `loading` is the only data state with a graph (`idle → loading → (success | error | idle)`), and the canon does not yet declare `idle / success / error` — that is a content gap to file as a separate backlog item, not to fix inside P1-8.

The Designer view, Dev view, and Bridge view all gain a transitions section rendered immediately after the existing axes block (`site/src/components/views/{Designer,Dev,Bridge}View.astro`). Unlike motion (Designer-only) and responsive (Designer-only), transitions are spec for both designer and developer audiences — designers reason about which user actions cause which visual state, developers reason about which event handlers drive which state mutation. Bridge view shows the graph because the frequent mismatch ("designers think `closed → open` is one click; developers know it goes through `opening`") is exactly what Bridge view exists to surface.

The MCP tool surface stays unchanged. Backlog item P4-24 picks up `get_transitions` once the field has been stable for one or more Phase-2 audits.

## Consequences

**Positive:**

- Modal's focus-restoration story (mistake `modal-no-focus-restore`) gains a structural counterpart — the graph itself records that `closing → closed` is when restoration happens.
- Combobox's `busy` and `invalid` states are no longer islands — the canon declares which state graphs reach them and on what trigger.
- The first cross-field refine in the canonical schema lands. Future refines (anatomy-id referential integrity, mistake-id uniqueness across components) follow this template.
- Bridge view gains real graph content — the canonical "designer vs. developer mental model" mismatch is visible, not implicit.

**Negative:**

- Adding a state name to `axes.states.{interactive, data}` and forgetting to update `transitions` is a silent omission (the refine catches stale references but not missing transitions). Mitigated by review; deferred to a future backlog item if it becomes a recurring problem.
- One more optional field nested in `axes.states`. Mitigated: nesting keeps it local to the state vocabulary it depends on.

**Neutral:**

- A future ADR may introduce *guards* on transitions (e.g., `from: open, to: closing, trigger: backdrop click, guard: dismissible === true`). Rejected for P1-8 — the prose carries the guard ("dismissible backdrop click"), and structured guards are a Phase-2 binding concern. If the prose proves insufficient when the first audit lands, file P5-30 to add `guard?: string`.
- ADR-007 references "ADR-008" as the planned state-machine ADR. The actual filename is `009-state-transitions.md` because P1-7 Responsive shipped between P1-6 and P1-8 and took ADR-008. ADR-007 is not edited; the canonical reference resolves "future state-machine ADR" to this document.

## Alternatives considered

**Top-level `transitions` field:** rejected. State vocabulary and state graph are the same concern; splitting them across the schema root forces cross-root refine and double-declaration of state names.

**Structured `trigger` payload:** rejected. The space of triggers is open and tail-heavy (every component has its own action vocabulary); compound triggers (Modal's `open → closing` has five alternative triggers) collapse into ugly disjunctions; Phase-2 bindings own the structured form.

**Structured `from` / `to` handles** (`{ kind: 'data', name: 'open' }`): rejected. State names are unique within a component, prose is the audience, the kind distinction does not affect transitions.

**Restricting `from` / `to` to data states only:** rejected. The interactive/data split is orthogonal to the transition dimension; future components may model legitimate cross-kind transitions.

**Guards as a separate field:** considered. Deferred — prose currently carries them, structured guards are a Phase-2 binding concern. Re-evaluate after first implementation audit.

**Implicit graph from per-state `entry` / `exit` hooks:** rejected. Entry/exit hooks are a *behaviour* of states; transitions are a *relationship* between states. Conflating them re-creates the variant-explosion problem the existing `axes` distinction was designed to prevent.
