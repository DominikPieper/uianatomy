# ADR 034: Icon-leading-text as fourth canonical sub-anatomy

**Status:** Folded into the [ADR-030](./030-sub-anatomy.md#sub-anatomy-registry) sub-anatomy registry (2026-05-31, backlog P6-165)
**Date:** 2026-05
**Supersedes:** none (additive — fourth instance of the [ADR-030](./030-sub-anatomy.md) sub-anatomy mechanism)
**Related:** [ADR-001](./001-canon-first.md) (canon-first), [ADR-020](./020-slot-kind.md) (slot kind), [ADR-030](./030-sub-anatomy.md) (sub-anatomy mechanism), [ADR-032](./032-close-button-sub-anatomy.md) (close-button), [ADR-033](./033-header-bar-sub-anatomy.md) (header-bar)

> **2026-05-31 (P6-165).** Authoring one ADR per concrete sub-anatomy proved to be
> process overhead — each is an *application* of the ADR-030 mechanism, not a new
> architectural decision. The canonical index now lives in the
> [sub-anatomy registry](./030-sub-anatomy.md#sub-anatomy-registry) in ADR-030;
> new sub-anatomies get a registry row there, not a new ADR. This file stays as the
> detailed historical rationale for the `icon-leading-text` instance.

> **Update 2026-05-05 — P6-150 landed.** The deferred follow-up named in this ADR (Tab + Breadcrumb-item canon-expansion + Badge / Link partial-arity adoption) shipped on the same day as the original ADR. icon-leading-text is now the reuse-roster of **6 consumers** (Button, List-item, Tab, Breadcrumb-item, Badge, Link); the `omitted`-override is exercised three times (Breadcrumb-item drops `icon-trailing`, Badge drops `icon-trailing`, Link drops `icon-leading`). The "no `omitted` override exercised in this rollout" line under Rationale was the state at ADR-acceptance time and remains accurate as a historical record.

## Context

Backlog item P6-149 anticipated a wide reuse roster (Button + Menu-item + List-item + Tab + Breadcrumb-item — five consumers) and pitched the work as the "first real exercise of `subAnatomyOverrideSchema.omitted` for the variable-arity case." Exploration of the actual canon produced a different picture:

| Component       | Has `icon-leading`? | Has `label`? | Has `icon-trailing`? | Slot IDs                                            |
|-----------------|---------------------|--------------|----------------------|-----------------------------------------------------|
| Button          | yes                 | yes          | yes                  | `icon-leading` / `label` / `icon-trailing`          |
| List-item       | yes                 | yes          | yes                  | `leading-icon` / `primary` / `trailing-icon` (different IDs, same semantics) |
| Menu-item       | partial             | no (`shortcut` text-kbd, not text-label) | no | `icon` / `shortcut`                                 |
| Tab             | no                  | no           | no                   | none — current canon ships no icon affordance       |
| Breadcrumb-item | no                  | no           | no                   | text-only — separator slot is decorative-not-icon-leading |

Two genuine adopters today: Button and List-item. Menu-item is structurally a different composite (icon + text-kbd-shortcut) where forcing the icon-leading-text shape would either misname the kbd-shortcut as `icon-trailing` or require an `omitted`-override stripping the trailing slot — both worse than leaving Menu-item alone. Tab and Breadcrumb-item simply do not carry icon affordances in the current canon; mature library precedents (Radix Tabs supports icon, GOV.UK Breadcrumbs supports leading separator) make eventual canon-expansion realistic, but that expansion is its own work item.

Drift symptoms in canon today, even at two consumers:

- **Slot IDs differ for the same semantics** (`icon-leading` vs `leading-icon`, `label` vs `primary`, `icon-trailing` vs `trailing-icon`). A canon reader inspecting Button's slot IDs and then List-item's would not recognise the pattern as the same shape.
- **a11y rule duplicated**. Both Button and List-item declare independently in `a11y.hint` prose that "the icon is decorative when paired with a visible text label" — the canon has no surface where this rule lives once.
- **Token-set duplication.** Both consumers declare `typography.size: text.md` on the label slot. Other tokens (label weight, foreground colors) are consumer-context-specific (Button uses accent-context colors, List-item uses muted/primary semantic-row colors).

## Decision

**Author `content/sub-anatomies/icon-leading-text.yaml`** as the fourth canonical sub-anatomy. Three-slot composite:

| Slot            | `slotKind`    | `code.semantic`            | Required | Role |
|-----------------|---------------|----------------------------|----------|------|
| `icon-leading`  | `decorative`  | `presentational-or-img`    | false    | Optional leading glyph; aria-hidden when paired with the label. |
| `label`         | `content`     | `text`                     | true     | Required text; carries the host's accessible name. |
| `icon-trailing` | `decorative`  | `presentational-or-img`    | false    | Optional trailing glyph; aria-hidden, may indicate direction or state-affordance. |

**Slot IDs match Button.** List-item's current slot IDs (`leading-icon`, `primary`, `trailing-icon`) are renamed in canon to align with the sub-anatomy IDs as part of this rollout. Button has three Phase-2 implementation YAMLs (`implementations/{radix,headlessui,react-aria}/button.yaml`); List-item has zero implementations. Renaming List-item's three slot IDs is a smaller blast radius than renaming Button's — verified by `grep`.

**`a11y.groupRule` and `focusRule`** carry the canonical icon-text accessible-name rule (label drives the host's accessible name; icons are `aria-hidden` by default; icons that carry state-meaning the label does not require absorption into the host's `aria-label`) and the canonical focus rule (focus targets the host, not the icon or label).

**Token canonicalization.** The sub-anatomy ships:

- `icon-leading.tokens.spacing.gap: spacing.compact` (canonical inter-slot gap to label)
- `label.tokens.typography.size: text.md` (canonical text size — both consumers agree)
- `icon-trailing.tokens.spacing.gap: spacing.compact`

Foreground colors and label weight stay consumer-specific (Button uses `color.accent.fg` in accent context; List-item uses `color.text.muted` / `color.text.primary` in semantic-row context). Consumers express these via per-slot `tokens` overrides in their `$ref` entry — partial-merge per `loader.ts:351-352` (`mergeTokens(slot.tokens, ov.tokens)`), so consumers do not need to re-declare the canonical spacing/typography.

**Reuse roster: 2 components.**

| Component   | Migration                                                                                                              |
|-------------|------------------------------------------------------------------------------------------------------------------------|
| `button`    | Replace inline `icon-leading` + `label` + `icon-trailing` slot blocks with `$ref: icon-leading-text` (parent: root, row: 2). Override per-slot `tokens.color.foreground` to `color.accent.fg`; override `label.tokens.typography.weight` to `weight.semibold` and `label.tokens.typography.tracking` to `tracking.normal`; override `label.layout.span` to `8`. |
| `list-item` | Rename inline slots `leading-icon` → `icon-leading`, `primary` → `label`, `trailing-icon` → `icon-trailing`, then replace those three inline blocks with `$ref: icon-leading-text` (parent: root, row: 1). Override per-slot `tokens.color.foreground` (icons `color.text.muted`, label `color.text.primary`); override `label.tokens.typography.weight` to `weight.medium`; override `label.layout.span` to `5`; override `icon-trailing.layout.col` to `7` (List-item's row has avatar + secondary + badge + action between the label and the trailing icon). |

## Rationale

- **Two consumers is below precedent threshold but above zero.** action-group has 5 reuses, close-button has 6, header-bar has 3. icon-leading-text at 2 is the leanest sub-anatomy yet. The justification is not raw reuse density but **canon naming consistency**: today, two components encode the same icon-text pattern under different slot IDs. A canon reader cannot tell that the patterns are the same. Sub-anatomies are the canonical mechanism for de-duplicating slot-shape by surfacing a single named definition, and that benefit accrues at any reuse count ≥ 2.
- **Slot IDs follow Button, not List-item.** Two reasons: (a) Button has three Phase-2 audit YAMLs that reference `icon-leading` / `icon-trailing` / `label` semantically (even though those audits do not literally cite the slot IDs in `from:` paths, the Phase-2 audit ecosystem is anchored to Button). (b) The names `icon-leading` / `label` / `icon-trailing` are more explicit about layout direction and role than `leading-icon` / `primary` / `trailing-icon` — `primary` in particular is ambiguous (primary action? primary text? primary state?) and gains clarity when renamed to `label`.
- **Token canonicalization is partial by design.** Spacing.gap and typography.size are uniformly canonical (both consumers agree); foreground colors are canonically consumer-context-specific. A monolithic-token-canon (e.g. forcing all icon-text into `color.text.primary`) would force one consumer to override every slot, defeating the purpose. A no-token-canon (sub-anatomy ships nothing) would force every consumer to redeclare the gap and the size — the same boilerplate that motivates a sub-anatomy in the first place. The chosen split matches the actual shape of the cross-consumer agreement.
- **No `omitted` override exercised in this rollout.** Both consumers ship all three slots; both icons are optional in the sub-anatomy (`required: false`), so consumer-level "we don't visually use icon-trailing today" is expressed by the consumer simply not rendering the slot, not by an `omitted` override. The `omitted` machinery stays untested by this ADR — the next sub-anatomy that has a genuinely variable-arity reuse pattern will exercise it (P6-150 below is the natural candidate).

### Why Menu-item is excluded

Menu-item is structurally `icon` + `shortcut` (lines 349-411 in `content/components/menu.yaml`). The `icon` slot is semantically equivalent to `icon-leading`, but the `shortcut` slot is text content — a kbd-rendered keyboard shortcut display ("Ctrl+K"), not a trailing icon. There is no `label` slot per se on the menuitem itself; the label comes from menuitem's text content (the activatable line of text). Forcing icon-leading-text onto Menu-item would either:

(a) **Rename `shortcut` to `icon-trailing`** — semantically wrong; kbd display ≠ icon affordance.
(b) **Use an `omitted` override stripping `icon-trailing`** — leaves Menu-item with `icon-leading` (renamed from `icon`) + `label`, but Menu-item has no canonical `label` slot to map to (the text is on menuitem itself, not a separate slot). The shape simply doesn't fit.

The cleaner course is to leave Menu-item canon as-is. If a future canon refactor extracts a `label` slot from menuitem text, Menu-item could adopt the sub-anatomy with overrides at that point.

### Why Tab and Breadcrumb-item are excluded

Tab (`content/components/tabs.yaml` lines 124-158) and Breadcrumb-item (`content/components/breadcrumbs.yaml` lines 154-283) ship no icon-leading or icon-trailing slots in their current canon. Adopting icon-leading-text for these components would require **first adding the icon slots** to their canon, which is a substantive canon-expansion: it requires evidence from mature libraries that icons are an idiomatic affordance on Tab and Breadcrumb-item, decisions about canonical optionality (always optional? required for certain variants?), and a11y rule documentation specific to each host (Tab's icon must not break the role-tab implicit-label; Breadcrumb-item's leading-icon must not duplicate the separator semantics).

That work is beyond the scope of "ship a canonical name for the icon-text pattern." It is a separate backlog item (P6-150), unblocked by this ADR — once Tab and Breadcrumb-item gain icon slots, adopting icon-leading-text becomes a small editorial change.

### Why slot IDs are renamed in canon, not via override

`subAnatomyOverrideSchema.renamed` lets a consumer locally rename a slot from the sub-anatomy without changing the underlying canon. List-item could keep `leading-icon` / `primary` / `trailing-icon` and use `renamed` overrides. Why not?

- **Override cost recurs at every consumer.** A renamed override on List-item and a renamed override on every future consumer that prefers the old IDs (none today, but possible) is more total override surface than a one-time canon rename.
- **Renamed overrides hide the canonical pattern from a canon reader.** If someone reads `list-item.yaml` and sees `$ref: icon-leading-text` with `overrides: [renamed: icon-leading → leading-icon, ...]`, they have to mentally unwind the renames to see the canonical shape. A direct rename in canon means the canonical shape is what's literally written.
- **Implementation files do not reference List-item slot IDs.** Confirmed: `implementations/*/list-item.yaml` does not exist; `grep -r leading-icon implementations/` returns only substring-match false positives in unrelated component prose. The rename has zero downstream impact today.

The `renamed` override remains useful for cases where slot IDs really are consumer-specific (a future hypothetical where a design system uses `glyph-start` instead of `icon-leading` and refuses to rename). Not the situation here.

## Consequences

**Positive:**

- Two components share one canonical icon-leading-text definition. The icon-text accessible-name rule lives once.
- List-item slot IDs canonicalised — `leading-icon` / `primary` / `trailing-icon` retired in favour of `icon-leading` / `label` / `icon-trailing`. Canon is more navigable.
- Token canonicalization for spacing.gap and typography.size — these tokens stop being repeated across consumers.
- MCP `list_sub_anatomies` length grows from 3 to 4. `get_sub_anatomy icon-leading-text` returns the canonical icon-text definition.
- `search_components({ query: "icon-leading-text" })` matches Button / List-item via the existing referenced-sub-anatomy-id haystack extension.
- Unblocks P6-150 (Tab + Breadcrumb-item icon-affordance canon-expansion). Once those components gain icon slots, they can adopt icon-leading-text editorially without further sub-anatomy work.

**Negative:**

- Two consumers is the leanest sub-anatomy roster yet. The reuse-density argument is weaker than for action-group (5), close-button (6), or header-bar (3). The naming-consistency + canon-deduplication argument carries the decision; if this proves to be the only ever consumer pair (Tab and Breadcrumb-item never adopt), the sub-anatomy still earns its keep through token canonicalization and a single source of truth for the a11y rule.
- List-item slot rename is a canon-breaking change for any external consumer of `content/components/list-item.yaml` that hard-codes the old slot IDs. None known. Documented here so a future reader can trace the rename.

**Migration footprint:**

- `content/sub-anatomies/icon-leading-text.yaml` — new file.
- `content/components/button.yaml` — replace 3 inline slot blocks (lines 102-186) with one `$ref` entry plus per-slot token overrides for accent-context colors + label weight/tracking + label.layout.span.
- `content/components/list-item.yaml` — rename 3 slot IDs in the inline anatomy, then replace those 3 inline blocks with one `$ref` entry plus per-slot token overrides for muted/primary colors + label weight + label.layout.span + icon-trailing.layout.col.
- `mcp-server/tests/server.test.ts` — extend `list_sub_anatomies` count assertion (3 → 4) and add a `get_sub_anatomy('icon-leading-text')` test analogous to existing close-button / header-bar tests.
- `shared/tests/consistency.test.ts` — add a soft-lint analogous to existing close-button / header-bar tests detecting inline icon-leading + label patterns without `__subAnatomy` provenance marker.
- `docs/backlog.md` — flip `P6-149 [x]`; new `P6-150 Tab + Breadcrumb-item icon-affordance canon-expansion` entry; chronological "Done 2026-05-05 batch" updated.

No schema changes. No loader changes. No bundle-script changes. No site-render changes. Fourth proof that ADR-030's mechanism is sub-anatomy-id-agnostic and additive.

## Alternatives considered

- **Include Tab and Breadcrumb-item by adding icon slots to their canon as part of this ADR.** Rejected. Adding icon slots to Tab and Breadcrumb-item is real canon-expansion work that requires its own evidence, decisions, and a11y rule documentation — not a free side-effect of authoring a sub-anatomy. P6-150 owns that scope.
- **Include Menu-item by mapping `shortcut` to `icon-trailing` or by `omitted`-override on `icon-trailing`.** Rejected. Menu-item's `shortcut` is kbd text, not icon affordance; the omitted-override path would leave Menu-item without a canonical `label` slot to map to. Menu-item has its own structural shape and does not belong in icon-leading-text's reuse roster.
- **Keep List-item slot IDs (`leading-icon` / `primary` / `trailing-icon`) and use `renamed` overrides instead of canon-renaming.** Rejected. The override would cost re-unwinding at read-time and recurs at any future consumer that prefers the old names. A one-time canon rename is cheaper and surfaces the canonical pattern directly.
- **Choose List-item's slot IDs as canonical and rename Button's slots instead.** Rejected. Button has three Phase-2 audit YAMLs to ripple through; List-item has zero. Smaller blast radius wins.
- **Ship a single canonical foreground color (e.g. `color.text.primary`) in the sub-anatomy.** Rejected. Forces every consumer with a different context (Button's accent colors) to override every slot's foreground, defeating the canonicalization. Foreground stays consumer-specific by design.
- **Defer the entire ADR until Tab + Breadcrumb-item adoption is also ready, so the sub-anatomy lands with 4 consumers.** Rejected. The two-consumer drift exists today and the canonicalization benefit is real today; the followup expansion is not blocked by anything that landing this sub-anatomy now would invalidate. Shipping at 2 and growing to 4 later is strictly additive.
- **Author the sub-anatomy without renaming List-item — accept slot-id mismatch and rely on the `__subAnatomy` provenance marker for the canon-reader experience.** Rejected. The provenance marker indicates "this slot came from sub-anatomy X" but does not unify the slot ID. A canon reader inspecting List-item's resolved anatomy would still see `leading-icon` (from sub-anatomy `icon-leading-text` slot `icon-leading`) — readable but unnecessarily indirect. Direct rename produces canonical alignment without the indirection.
