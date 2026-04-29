# ADR 016: Form Integration Section

**Status:** Accepted
**Date:** 2026-04

## Context

Three Phase-1 components participate in HTML form lifecycle, each in a different role:

- **Button** is a *form control* — `<button>` with `name`/`value` contributes to FormData when it is the submit activator; `type="submit"` triggers HTML5 validation; `type="reset"` calls `form.reset()`; `formnovalidate` opts out.
- **Combobox** is a *form control* whose inner `<input>` carries the `name` attribute; FormData contains the canonical value (id/token) of the selected option for strict mode, or the typed string for free-input variants. `setCustomValidity()` is the canonical hook for "must select from list" enforcement.
- **Modal** is a *form container* — it does not submit anything itself, but forms hosted inside cooperate with native `<dialog>` via `<form method="dialog">` to commit-and-close in a single action; the focus trap keeps validation-failure focus inside the dialog naturally.

The canon today documents some of this implicitly — `axes.properties[type]` for Button mentions `'button | submit | reset'`, `mistakes.combobox-strict-without-feedback` mentions strict-mode validation, `mistakes.modal-no-focus-trap` mentions the form-context. But the canonical authority for "how does this component play with `<form>`?" is fragmented across mistakes, mismatches, and a11y prose. A developer integrating any of the three has to prose-grep four files to assemble the form story.

The Phase-1 schema lacks a structural surface for this. Backlog item P2-13 fills it with a `formIntegration` field carrying four prose facets (`name`, `formData`, `reset`, `validation`) — the four orthogonal HTML-form concerns every form control must answer.

## Decision

`formIntegration` enters the schema as **one optional top-level field on `componentSchema`**, parallel to `motion`, `responsive`, `events`, `whenToUse`, `a11yAcceptance`, `propertyMap`. Four sub-fields, each independently optional, with a refine requiring at least one declared:

```yaml
formIntegration:                              # optional
  name: >-                                    # optional prose
    `<button>` with a `name` attribute participates in form submission
    — the button's `[name]=[value]` is appended to FormData when this
    button is the submitter.
  formData: >-                                # optional prose
    On submit, only the activating submit button's `[name]=[value]`
    pair is appended (not all buttons in the form).
  reset: >-                                   # optional prose
    `<button type="reset">` calls `form.reset()` on the parent form.
  validation: >-                              # optional prose
    `<button type="submit">` triggers `form.checkValidity()`; the
    first invalid field receives focus.
```

The schema:

```ts
export const formIntegrationSchema = z
  .object({
    name: z.string().min(1).optional(),
    formData: z.string().min(1).optional(),
    reset: z.string().min(1).optional(),
    validation: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.name !== undefined ||
      v.formData !== undefined ||
      v.reset !== undefined ||
      v.validation !== undefined,
    { message: 'formIntegration must declare at least one of name, formData, reset, validation' },
  );
```

Render: `FormIntegrationSection.astro` slots into Dev view (after Events, before Accessibility) and Bridge view (after Events, before Accessibility). Designer view does not render the section — form integration is dev-side technical content (HTML attribute names, FormData API, validity API).

## Rationale

### Why four sub-fields, not free-form prose

A single `formIntegration: string` was considered. Rejected: the four concerns are *orthogonal* — a developer integrating with a form needs each answer independently. Mixing them in one paragraph either forces every reader to re-extract their concern, or leads to authors skipping the concerns they don't think about (validation is the most-skipped in informal docs). Structured fields force authors to answer all four.

### Why all four are optional with a refine, not all required

Modal's role differs from Button/Combobox: Modal is a *container*, not a control. Some of Button/Combobox's facets translate to "Modal does not contribute" prose for Modal. Forcing all four required would either:

1. Push authors to write filler prose ("N/A") for fields that don't apply, or
2. Push the field to be skipped entirely on container-style components, losing the parts that *do* apply.

Optional-with-refine threads the needle: Modal can document `name` (container surface), `formData` (form-method-dialog), `reset` (independent of dialog), and `validation` (focus trap interaction) where each genuinely applies; control components like Button declare all four; future container components (Drawer, Popover-with-form) can mirror Modal's pattern.

The refine rejects `formIntegration: {}` (declaring then-empty) — same dead-letter discipline as `events: []`, `axeRules: []`, `a11yAcceptance: {}` elsewhere.

### Why prose, not structured payloads

A structured shape (`name: { attribute: 'name', participatesInFormData: true, multiActionPattern: true }`) was considered. Rejected:

1. **The space of form-integration nuances is open.** Button has multi-action submit-button patterns; Combobox has canonical-value-vs-display-label distinctions; Modal has `<form method="dialog">` interaction with `dialog.returnValue`. Encoding each as structure either over-fits to the three Phase-1 components or balloons into a "any string"-keyed bag that adds no validation.
2. **Prose is the audience.** Developers reading "the form's `:invalid` pseudo-class state propagates" parse it once and integrate; reading `{ propagates: ['invalid'], to: 'parentForm' }` is harder, not easier.
3. **Phase-2 implementations record the actual code.** `eventBindings` and `tokenBindings` (deferred to follow-up Phase-2 ADRs) handle the structured per-implementation form. The canonical text is the spec.

Same reasoning as ADR-009 (transition triggers as prose), ADR-008 (responsive change prose), ADR-011 (event payload prose).

### Why per-component, not per-property

A "form integration is a property of `axes.properties[type]`" axis was considered (e.g. attaching a sub-block to Button's `type` property). Rejected: form integration spans the whole component. Button's form story spans `name`, `value`, `type`, `formaction`, `formnovalidate` — multiple properties. Combobox's spans the inner input plus the wrapping component plus the popup behaviour. Modal's spans the container plus contained forms. Per-property attachment would force a 1:N or N:M relationship that obscures the unified surface; per-component is the right granularity, same as motion / responsive / events / whenToUse / a11yAcceptance.

### Why Dev + Bridge views, not Designer

Form integration is HTML-attribute-and-API content (`name=`, FormData, `setCustomValidity()`, `form.reset()`). Designers care that components participate in forms but rarely need the per-attribute nuance. The existing per-slot `a11y.hint` covers designer-level a11y guidance; `mistakes` cover designer-relevant pitfalls (e.g. `button-submit-default-in-toolbar`). Adding form-integration prose to Designer view crowds it with content the audience does not act on.

Bridge view earns it because the cross-team mismatch is real ("designer thinks the button is just a click handler; developer needs to know it auto-submits the parent form unless `type='button'` is set").

## Schema sketch

Canonical side — `shared/src/schema.ts` (lands in P2-13):

```ts
export const formIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  formData: z.string().min(1).optional(),
  reset: z.string().min(1).optional(),
  validation: z.string().min(1).optional(),
}).strict().refine(
  (v) => v.name !== undefined || v.formData !== undefined || v.reset !== undefined || v.validation !== undefined,
  { message: '...' },
);

// componentSchema gains: formIntegration: formIntegrationSchema.optional()
```

Implementation side — none. `formIntegration` is canonical HTML-form vocabulary; per-implementation deltas (Headless UI's controlled-`value` pattern vs React Aria's uncontrolled-default-value) live as Phase-2 divergence rows referencing `formIntegration[*]` paths.

## Phase 1 implication

Three Phase-1 components migrate: Button, Combobox, Modal. Each declares all four sub-fields (the form story is rich enough for the three roles to fill all four). Card and Tabs stay unmigrated:

- **Card** is a layout container with no canonical form participation. Cards may host forms (a contact-card with an inline edit form, a search-result card with a save-bookmark button), but the form story belongs to those nested components, not to Card itself.
- **Tabs** is a navigation control, not a form control. Selected-tab state is rarely a form value; if a use case ever surfaces (e.g. a wizard tabset with submit-on-final-tab), file as a follow-up.

The render component (`FormIntegrationSection.astro`) lands in Dev + Bridge views after the existing Events section and before Accessibility. Designer view stays unchanged.

The MCP tool surface gains `get_form_integration` once Phase-2 audits surface a concrete consumer — file as a follow-up after the next batch of P4-24-style tool extensions.

## Consequences

**Positive:**

- Developers integrating Button / Combobox / Modal with a `<form>` get one structured surface answering the four orthogonal concerns. No more prose-grepping mistakes / mismatches / a11y for the form story.
- Bridge view captures a real cross-team mismatch ("designer doesn't think about `type='button'`; developer must override the default `type='submit'`").
- Phase-2 implementation audits can record per-library form-integration deltas as divergence rows pointing at `formIntegration.validation` etc.
- The "Form Library Compatibility" Phase-2 question (does this library work with React Hook Form, Zod-resolver, Vue's `v-model` form state) gets a structured comparison surface.

**Negative:**

- Authoring overhead per form-aware component (~20–40 lines of prose). Mitigated by the small migrant set (3 of 5) and the high signal — the prose was previously implicit and re-derived per-integrator.
- The four sub-field set is opinionated; some HTML-form concerns (e.g. `autocomplete`, `enctype`, file-input handling, async-validation patterns) are not represented. Mitigated: extend with a fifth/sixth sub-field in a follow-up ADR if a concrete component needs it. The four chosen are the common universal core.

**Neutral:**

- A future structured `formIntegrationBindings` (per-implementation: actual handler signatures, library-specific compose patterns) is logical follow-up. Out of scope for P2-13.
- A future `formCompose` field documenting how the component composes with adjacent form controls (e.g. Combobox-with-FormControl-wrapper pattern, Button-as-FormProvider-action) may emerge. File when a real audit needs it.

## Alternatives considered

**Single `formIntegration: string` prose**: rejected. Loses the structural orthogonality; encourages skipping the less-thought-about concern (validation, reset).

**All four sub-fields required**: rejected. Forces filler prose for container-role components like Modal whose form story partially applies.

**Per-property attachment** (`axes.properties[type].formIntegration`): rejected. Form integration spans multiple properties and slot behaviour; per-property forces unnatural fragmentation.

**Render in Designer view**: rejected. Per-attribute HTML-form prose is dev-side; Designer view stays focused on visual + structural concerns.

**Empty `formIntegration: {}` allowed**: rejected. Same dead-letter rejection as elsewhere — the refine forces commit-or-omit.

**Structured payloads for each sub-field**: rejected. The space of form-integration nuances is open and tail-heavy; prose carries the spec; Phase-2 bindings own the structured form per implementation.

**Adding `autocomplete`, `enctype` as additional sub-fields now**: rejected. The four chosen cover the universal core. Extension lands when a real component needs it.
