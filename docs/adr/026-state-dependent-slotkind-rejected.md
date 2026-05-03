# ADR 026: State-Dependent `slotKind` — Rejected

**Status:** Rejected
**Date:** 2026-05
**Related:** [ADR-020](./020-slot-kind.md) (the static `slotKind` accepted today)

## Context

[ADR-020](./020-slot-kind.md) introduced an optional four-value `slotKind` enum (`structural | interactive | content | decorative`) on each anatomy slot. The field is **static per slot** — every instance of that slot in every state of the component carries the same `slotKind` value.

The Atelier-feedback v2 review (2026-05-02, P6-50) flagged a real edge case in the canon roster:

> `anatomy[].slotKind` is static. Stepper's `step` is interactive but pending-in-linear-mode is non-interactive. Should support state-dependent kind.

The observation is correct in fact. In `Stepper` with `linear: true`, a `step` slot in the `pending` state is rendered as non-clickable text (the user cannot jump ahead until they complete the current step) — `interactive` is the wrong tag for that *configuration* of the slot, even though it is correct for the slot's dominant role. Similar (weaker) cases exist:

- `Tabs.tab[disabled]` — an `interactive` slot that is non-interactive while disabled.
- `Combobox.option` in async-loading state — an `interactive` slot that is rendered but not yet selectable until the data resolves.
- `Accordion.trigger` while the `lazy` content is hydrating.

The proposal: extend `slotKind` from a single value to a state-keyed map:

```yaml
# Hypothetical, NOT canonical
- id: step
  slotKind:
    default: interactive
    when:
      - axis: linear
        value: true
        state: pending
        kind: content
```

## Decision

**Reject.** `slotKind` stays static — exactly the four-value enum ADR-020 landed. ADR-020's escape hatch ("rare edge cases resolve by picking the dominant role and noting nuance in `purpose`") covers the Stepper case canonically. The Stepper `step.purpose` already reads:

> Individual step in the flow. Interactive when navigation is permitted (non-linear mode, or completed/current steps in linear mode); presentational when locked (pending steps in linear mode).

That prose is the correct surface for the nuance. The structural tag stays `interactive` because the slot's *dominant role* is interaction — and the diagram's semantic legend reads "interactive controls live here", which is true even if a configuration disables a subset.

## Rationale

### The state-dependent shape multiplies surface area

A state-keyed `slotKind` requires four schema additions, not one:

1. The map shape itself (`default: K, when: { axis, value, state, kind }[]`).
2. Cross-validation that referenced `axis`/`state` names exist in `axes.properties` and `axes.states`.
3. Per-state SVG rendering: the diagram now has to choose which `kind` to draw, which means picking a "default state" for the diagram (or rendering N diagrams, one per state-permutation).
4. Per-state propagation through every downstream consumer (MCP tool surface, JSON-LD, llms-md, accessibility-fixture endpoint).

The schema cost is real. The render cost is the dominant one — the anatomy SVG today is a single rendering, and state-dependent `slotKind` forces either a state selector (UI complexity, navigation friction) or a multiplied page (LCP regression, content duplication for crawlers). Neither outcome serves the canon's "single canonical diagram per component" anchor.

### The dominant-role tag is informationally correct in the dominant case

The diagram's `slotKind` legend reads "this slot is structurally an interactive control". For Stepper.step that is true of every step except the pending-in-linear configuration — which is a minority case the canon documents in `purpose` and `axes.states.transitions` (linear mode's `idle → pending → current → completed` graph). A reader scanning the diagram sees the dominant role; a reader drilling in reads the prose.

### State-dependence already lives in two places that handle it well

- **`axes.states`** carries the state machine. `Stepper.axes.states.data` includes `pending | current | completed | error`. A renderer that wants to convey "the slot's effective interactivity changes with state" reads the states list, not the slot tag.
- **`purpose` prose** carries the nuance. ADR-020 deliberately left this as the escape hatch; Stepper.step uses it; Tabs.tab uses it ("Disabled tabs use `aria-disabled` and remain focusable"); Combobox.option uses it ("highlighted via `aria-activedescendant` rather than DOM focus").

A state-keyed `slotKind` would duplicate the information that already lives in `axes.states` + `purpose`, with a markup surface that is harder to author and read.

### Counter to "Stepper is a real edge case"

Yes — and the right response to a real edge case is *better prose in the slot's `purpose`*, not a schema-shape change that distorts every other component to handle one configuration of one component. The 24-component roster has exactly four cases (Stepper, Tabs, Combobox, Accordion) where state changes affect interactivity, and three of them (Tabs.disabled, Combobox.async, Accordion.lazy) are well-served by `purpose` prose alone. Stepper is the strongest case and it is also well-served by `purpose` + `axes.states.transitions`.

If a fifth case emerges that prose cannot handle — for example, a slot whose role *fundamentally inverts* across states (interactive in one config, decorative in another, with no structural overlap) — reopen this ADR. The trigger for revisiting is "≥3 components have a `slotKind` that is misleading without state-context" measured against real consumer feedback (not theoretical edge cases). Today the count is one (Stepper), and Stepper's `purpose` covers it.

### Counter to "the diagram lies about Stepper.step"

The diagram does not lie. It says "this slot is in the `interactive` family" and Stepper.step is in that family — its dominant role is interaction. The diagram is a structural overview, not a state-machine simulator. Readers who need the state-machine read the `TransitionsTable` directly below the diagram and the `axes.states` documentation. Conflating diagram semantics with state-machine semantics is the original confusion that produces the request.

## Consequences

**Positive:**

- Schema stays at the four-value enum ADR-020 introduced. No author-cost increase, no render-cost increase, no MCP-surface change.
- The `purpose` field's role as the nuance-carrier is reinforced — authors who hit the edge case have the canonical place to document it and a precedent to follow (Stepper.step.purpose).
- The diagram's legend stays simple ("interactive / structural / content / decorative") and readers do not have to track which state is "selected" to understand the slot tag.

**Negative:**

- Stepper.step's "pending in linear mode is non-interactive" remains a prose-only assertion; an automated check that "linear-mode pending steps render as `<span>` not `<button>`" cannot be derived from `slotKind` alone.
  Mitigation: the same check derives from `axes.states.data: pending` + `axes.properties: linear` cross-referenced with `frameworkMap` prose, which is where the rendered-element decision lives. Adding `slotKind` to the derivation would not improve the assertion.

**Neutral:**

- This ADR exists explicitly so future contributors do not re-propose the same shape without the rejection rationale being visible. The ADR roster's discipline is that "we considered this and rejected" is just as valuable a record as "we adopted".

## Alternatives considered

**Per-state `slotKind` map with declarative `when` predicate** (the proposed shape): rejected for the schema- and render-cost reasons above.

**Loosen the `slotKind` enum to allow comma-separated multi-values** (`slotKind: interactive, content`): rejected. Splits the four-tag legend into 4 + (4 choose 2) = 10 combinations; none of the legend-readability gains of ADR-020 survive. The dominant-role discipline is the right answer.

**Extend `purpose` into a structured object** (`purpose: { dominant: string, stateNuance: { state, prose }[] }`): rejected. The current `purpose` is a single prose string per ADR-005, and re-shaping it touches every component for one edge case. If the structure becomes worth it for unrelated reasons (e.g., translation support, SEO snippets), revisit then.

**Add a separate `slotKindOverrides` array next to `axes.states`**: rejected. Same surface-area concern as the per-state map, just relocated. The right surface for state-dependent rendering is `axes.states` + framework prose; a sidecar array adds noise.
