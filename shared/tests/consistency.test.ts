import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import axe from 'axe-core';
import { loadComponents, loadPatterns } from '../src/loader.js';
import type { Component } from '../src/schema.js';
import {
  LIBRARY_VERSIONS,
  LIBRARY_NAME_ALIASES,
  KNOWN_NON_LIBRARY_SYSTEMS,
} from '../src/vocabulary.js';
import {
  CANON_SPACING,
  CANON_RADIUS,
  CANON_COLOR,
  CANON_ELEVATION,
  CANON_TYPOGRAPHY,
  CANON_MOTION_DURATION,
  CANON_MOTION_EASING,
  CANON_BREAKPOINTS,
  CANON_PROPERTY_VOCAB,
  CANON_PROPERTY_BOUNDED,
  CANON_INTERACTIVE_STATES,
  CANON_SEVERITY,
} from '../src/vocabulary.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');
const patternsDir = join(here, '..', '..', 'content', 'patterns');

const SPACING = new Set(CANON_SPACING);
const RADIUS = new Set(CANON_RADIUS);
const COLOR = new Set(CANON_COLOR);
const ELEVATION = new Set(CANON_ELEVATION);
const TYPOGRAPHY = new Set(CANON_TYPOGRAPHY);
const MOTION_DURATION = new Set(CANON_MOTION_DURATION);
const MOTION_EASING = new Set(CANON_MOTION_EASING);
const BREAKPOINTS = new Set(CANON_BREAKPOINTS);
const INTERACTIVE_STATES = new Set(CANON_INTERACTIVE_STATES);
const PROPERTY_VOCAB: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(CANON_PROPERTY_VOCAB).map(([k, v]) => [k, new Set(v)]),
);
const PROPERTY_BOUNDED: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(CANON_PROPERTY_BOUNDED).map(([k, v]) => [k, new Set(v)]),
);

function checkSlotTokens(
  slotId: string,
  tokens: NonNullable<Component['anatomy'][number]['tokens']>,
  failures: string[],
  componentId: string,
): void {
  const checkCategory = (
    name: string,
    map: Record<string, string> | undefined,
    canon: ReadonlySet<string>,
  ) => {
    if (!map) return;
    for (const [propKey, tokenName] of Object.entries(map)) {
      if (!canon.has(tokenName)) {
        failures.push(
          `${componentId}: anatomy[${slotId}].tokens.${name}.${propKey} = "${tokenName}" not in canonical ${name} vocabulary`,
        );
      }
    }
  };
  checkCategory('spacing', tokens.spacing, SPACING);
  checkCategory('radius', tokens.radius, RADIUS);
  checkCategory('color', tokens.color, COLOR);
  checkCategory('elevation', tokens.elevation, ELEVATION);
  checkCategory('typography', tokens.typography, TYPOGRAPHY);
}

describe('cross-component consistency', () => {
  it('all token references use canonical vocabularies', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of map.values()) {
      for (const slot of c.anatomy) {
        if (slot.tokens) {
          checkSlotTokens(slot.id, slot.tokens, failures, c.id);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('all motion durations use canonical motion-duration vocabulary', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of map.values()) {
      if (!c.motion) continue;
      for (const [key, value] of Object.entries(c.motion.durations)) {
        if (!MOTION_DURATION.has(value)) {
          failures.push(
            `${c.id}: motion.durations.${key} = "${value}" not in canonical motion-duration vocabulary`,
          );
        }
      }
      if (!MOTION_EASING.has(c.motion.easing)) {
        failures.push(
          `${c.id}: motion.easing = "${c.motion.easing}" not in canonical motion-easing vocabulary`,
        );
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('all responsive breakpoints use canonical breakpoint vocabulary', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of map.values()) {
      if (!c.responsive) continue;
      c.responsive.breakpoints.forEach((bp, i) => {
        if (!BREAKPOINTS.has(bp.at)) {
          failures.push(
            `${c.id}: responsive.breakpoints[${i}].at = "${bp.at}" not in canonical breakpoint vocabulary`,
          );
        }
      });
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('property values use canonical property vocabularies (density / size)', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of map.values()) {
      for (const prop of c.axes.properties) {
        if (prop.kind !== 'enum') continue;
        const expectedSet = PROPERTY_VOCAB[prop.name];
        if (expectedSet) {
          const actualSet = new Set(prop.values);
          const expectedArr = [...expectedSet].sort();
          const actualArr = [...actualSet].sort();
          if (
            expectedArr.length !== actualArr.length ||
            expectedArr.some((v, i) => v !== actualArr[i])
          ) {
            failures.push(
              `${c.id}: property "${prop.name}" values [${prop.values.join(', ')}] must equal canonical [${[...expectedSet].join(', ')}]`,
            );
          }
        }
        const boundedSet = PROPERTY_BOUNDED[prop.name];
        if (boundedSet) {
          for (const v of prop.values) {
            if (!boundedSet.has(v)) {
              failures.push(
                `${c.id}: property "${prop.name}" value "${v}" not in canonical bounded set [${[...boundedSet].join(', ')}]`,
              );
            }
          }
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('all interactive state names are in the canonical vocabulary', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of map.values()) {
      for (const s of c.axes.states.interactive) {
        if (!INTERACTIVE_STATES.has(s)) {
          failures.push(
            `${c.id}: interactive state "${s}" not in canonical interactive-state vocabulary [${[...INTERACTIVE_STATES].join(', ')}]`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('focus-ring tokens (anatomy[].tokens.color.ring) use color.border.focus', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of map.values()) {
      for (const slot of c.anatomy) {
        const ring = slot.tokens?.color?.ring;
        if (ring && ring !== 'color.border.focus') {
          failures.push(
            `${c.id}: anatomy[${slot.id}].tokens.color.ring = "${ring}", expected "color.border.focus" for canonical focus-ring consistency`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('axe rule ids are kebab-case (regex was schema-validated; this also catches obvious typos)', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    const kebabRe = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    for (const c of map.values()) {
      const rules = c.a11yAcceptance?.axeRules ?? [];
      for (const r of rules) {
        if (!kebabRe.test(r)) {
          failures.push(`${c.id}: axe rule "${r}" not kebab-case`);
        }
        if (r.includes('_') || r.includes(' ')) {
          failures.push(`${c.id}: axe rule "${r}" contains invalid characters`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('event names are camelCase (schema-validated; also catches snake_case typos)', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    const camelRe = /^[a-z][a-zA-Z0-9]*$/;
    for (const c of map.values()) {
      for (const e of c.events ?? []) {
        if (!camelRe.test(e.name)) {
          failures.push(`${c.id}: event name "${e.name}" not camelCase`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('whenToUse.vsRelated[].id resolves to an existing canonical component', async () => {
    const map = await loadComponents({ contentDir });
    const ids = new Set(map.keys());
    const failures: string[] = [];
    for (const c of map.values()) {
      for (const ref of c.whenToUse?.vsRelated ?? []) {
        // P6-133 — pending forward-references are allowed to point at
        // not-yet-authored components; resolution check is suspended for
        // them. The pair is still surfaced as a follow-up by the canon-
        // auditor.
        if (ref.pending) continue;
        if (!ids.has(ref.id)) {
          failures.push(`${c.id}: vsRelated.id "${ref.id}" does not resolve to a canonical component`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  // Bidirectional vsRelated lint: every `whenToUse.vsRelated[].id` reference
  // requires the target component to reference back. New asymmetric pairs may
  // be added to ALLOWED_ASYMMETRIC with explicit rationale; the canon today
  // has zero asymmetric pairs (P6-86 backfilled the original 19). Forward-
  // references with `pending: true` (P6-133) are excluded from the lint —
  // the target does not yet exist so a reverse-ref cannot be authored.
  it('whenToUse.vsRelated is bidirectional', async () => {
    const map = await loadComponents({ contentDir });
    const refs = new Map<string, Set<string>>();
    const pendingRefs = new Map<string, Set<string>>();
    for (const c of map.values()) {
      const allEntries = c.whenToUse?.vsRelated ?? [];
      refs.set(
        c.id,
        new Set(allEntries.filter((r) => !r.pending).map((r) => r.id)),
      );
      pendingRefs.set(
        c.id,
        new Set(allEntries.filter((r) => r.pending).map((r) => r.id)),
      );
    }
    const ALLOWED_ASYMMETRIC = new Set<string>();
    const failures: string[] = [];
    for (const [src, targets] of refs) {
      for (const t of targets) {
        const targetRefs = refs.get(t);
        if (!targetRefs) continue; // resolution failure already caught upstream
        if (targetRefs.has(src)) continue;
        // Allow the case where the target has a pending forward-ref back
        // to the source — the pair is being intentionally one-sided until
        // the target's authoring cycle authors the prose.
        if (pendingRefs.get(t)?.has(src)) continue;
        if (ALLOWED_ASYMMETRIC.has(`${src}->${t}`)) continue;
        failures.push(
          `${src}: vsRelated → "${t}" has no reverse ref. Add reverse-ref to ${t}.yaml or allowlist the pair in consistency.test.ts.`,
        );
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('pattern.composition[].componentId resolves to an existing canonical component', async () => {
    const components = await loadComponents({ contentDir });
    const patterns = await loadPatterns({ patternsDir });
    const ids = new Set(components.keys());
    const failures: string[] = [];
    for (const p of patterns.values()) {
      p.composition.forEach((c, i) => {
        if (!ids.has(c.componentId)) {
          failures.push(
            `${p.id}: composition[${i}].componentId "${c.componentId}" does not resolve to a canonical component`,
          );
        }
      });
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('every a11yAcceptance.axeRules entry exists in axe-core 4.10.2 ruleset', async () => {
    const components = await loadComponents({ contentDir });
    const validRuleIds = new Set(axe.getRules().map((r) => r.ruleId));
    const failures: string[] = [];
    for (const c of components.values()) {
      const rules = c.a11yAcceptance.axeRules ?? [];
      for (const ruleId of rules) {
        if (!validRuleIds.has(ruleId)) {
          failures.push(
            `${c.id}: a11yAcceptance.axeRules contains "${ruleId}" — not present in axe-core 4.10.2 ruleset (likely a typo, renamed rule, or hallucinated id). Verify against \`import('axe-core').default.getRules()\`.`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('LIBRARY_VERSIONS table is well-formed (ADR-028)', () => {
    const failures: string[] = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const keyRegex = /^[a-z][a-zA-Z0-9]*$/;
    for (const [key, entry] of Object.entries(LIBRARY_VERSIONS)) {
      if (!keyRegex.test(key)) {
        failures.push(`LIBRARY_VERSIONS["${key}"]: key must be camelCase (lowercase first letter, alphanumeric only).`);
      }
      if (!entry.name || entry.name.trim().length === 0) {
        failures.push(`LIBRARY_VERSIONS["${key}"]: name is required and non-empty.`);
      }
      if (!entry.url || !/^https?:\/\//.test(entry.url)) {
        failures.push(`LIBRARY_VERSIONS["${key}"]: url must be an http(s) URL.`);
      }
      // Cross-refine: version and verifiedAt are paired — either both set or both unset.
      if (entry.version !== undefined && entry.verifiedAt === undefined) {
        failures.push(`LIBRARY_VERSIONS["${key}"]: version is set but verifiedAt is missing.`);
      }
      if (entry.verifiedAt !== undefined && entry.version === undefined) {
        failures.push(`LIBRARY_VERSIONS["${key}"]: verifiedAt is set but version is missing.`);
      }
      if (entry.verifiedAt !== undefined && !dateRegex.test(entry.verifiedAt)) {
        failures.push(`LIBRARY_VERSIONS["${key}"]: verifiedAt must be YYYY-MM-DD; got "${entry.verifiedAt}".`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('LIBRARY_NAME_ALIASES keys mirror LIBRARY_VERSIONS keys (ADR-028 phase-3)', () => {
    const versionKeys = new Set(Object.keys(LIBRARY_VERSIONS));
    const aliasKeys = new Set(Object.keys(LIBRARY_NAME_ALIASES));
    expect([...aliasKeys].sort()).toEqual([...versionKeys].sort());
  });

  it('every contracts.vocabularyDrift[].system maps to a known library or non-library spec (P5-35)', async () => {
    const components = await loadComponents({ contentDir });
    const patterns = await loadPatterns({ patternsDir });

    const allAliases = new Set<string>();
    for (const aliases of Object.values(LIBRARY_NAME_ALIASES)) {
      for (const alias of aliases) allAliases.add(alias.toLowerCase());
    }
    for (const known of KNOWN_NON_LIBRARY_SYSTEMS) {
      allAliases.add(known.toLowerCase());
    }

    const matches = (system: string): boolean => {
      // Composite ("Radix / Headless UI") is acceptable if at least one part matches.
      const parts = system.split(/\s*[/+]\s*|\s+and\s+/i).map((p) => p.trim());
      for (const part of parts) {
        if (allAliases.has(part.toLowerCase())) return true;
      }
      // Whole-string fallback for systems that contain slashes intentionally (e.g. "GOV.UK").
      return allAliases.has(system.toLowerCase());
    };

    const failures: string[] = [];
    const yaml: Array<{ id: string; kind: 'component' | 'pattern'; drift: { system: string }[] | undefined }> = [];
    for (const c of components.values()) {
      yaml.push({ id: c.id, kind: 'component', drift: c.contracts?.vocabularyDrift });
    }
    for (const p of patterns.values()) {
      yaml.push({ id: p.id, kind: 'pattern', drift: (p as { contracts?: { vocabularyDrift?: { system: string }[] } }).contracts?.vocabularyDrift });
    }

    for (const item of yaml) {
      for (const entry of item.drift ?? []) {
        if (!matches(entry.system)) {
          failures.push(
            `${item.kind}/${item.id}: contracts.vocabularyDrift.system "${entry.system}" matches no LIBRARY_NAME_ALIASES alias and no KNOWN_NON_LIBRARY_SYSTEMS entry. Add an alias in shared/src/vocabulary.ts or correct the citation.`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  // P6-120 — performance-block coverage rule.
  // Components with a stack / count / queue / virtualisation / overlay-cost
  // dimension carry a `performance[]` block. Registry is explicit because
  // "does this component have a numeric perf threshold" is a judgement call
  // per ADR / authoring guidance — heuristic detection (variants count,
  // anatomy size) does not work. Adding a new component with a perf-relevant
  // dimension means adding it here; the lint surfaces the gap on next test
  // run. Tooltip explicitly opts in via openDelay/closeDelay even though
  // earlier audit notes called it "no real perf-budget" — the post-audit
  // canonical thresholds make the entry mandatory.
  it('every component in PERFORMANCE_REQUIRED registry declares a performance[] block', async () => {
    const components = await loadComponents({ contentDir });

    const PERFORMANCE_REQUIRED: readonly string[] = [
      'tabs',
      'modal',
      'combobox',
      'toast',
      'alert',
      'card',
      'list-item',
      'tile',
      'stepper',
      'drawer',
      'textarea',
      'tooltip',
      'sidebar-nav',
      'accordion',
      'segmented-control',
      'popover',
      'table',
      'grid-pattern',
      'tree-grid',
      'menu',
    ];

    const failures: string[] = [];
    for (const id of PERFORMANCE_REQUIRED) {
      const c = components.get(id);
      if (!c) {
        failures.push(
          `PERFORMANCE_REQUIRED registry includes "${id}" but no component with that id was loaded — remove from registry or add the component.`,
        );
        continue;
      }
      if (!c.performance || c.performance.length === 0) {
        failures.push(
          `${id}: declared in PERFORMANCE_REQUIRED registry but performance[] is missing or empty. Add at least one threshold (stack-depth, item-count, frame-budget, etc.) or remove from the registry with a rationale.`,
        );
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  // P6-118c — severity-variant-membership lint.
  // Components with a severity-axis must declare variants drawn from CANON_SEVERITY
  // (info / success / warning / error) plus an explicit allowlist of structural
  // exceptions per component. The registry is explicit (no heuristic detection)
  // because severity-themed-vs-structural variant detection is fragile per
  // P6-118c's own deferral note. Adding a new severity-axis component means
  // adding it here; the lint surfaces the gap on next test run.
  it('every severity-axis component has variants in CANON_SEVERITY plus documented exceptions', async () => {
    const components = await loadComponents({ contentDir });

    const SEVERITY_AXIS_REGISTRY: Readonly<Record<string, readonly string[]>> = {
      // Badge ships a neutral `default` variant alongside the four severity tones.
      badge: ['default'],
      // Alert and Toast use exactly the four canonical severity variants.
      alert: [],
      toast: [],
      // Banner ships `promotional` as a banner-specific marketing variant
      // (documented in ADR-029 as the canonical severity-vocabulary exception).
      banner: ['promotional'],
    };

    const canonSeveritySet = new Set<string>(CANON_SEVERITY);
    const failures: string[] = [];

    for (const [id, exceptions] of Object.entries(SEVERITY_AXIS_REGISTRY)) {
      const c = components.get(id);
      if (!c) {
        failures.push(
          `severity-axis registry includes "${id}" but no component with that id was loaded — remove from SEVERITY_AXIS_REGISTRY or add the component.`,
        );
        continue;
      }
      const allowed = new Set<string>([...canonSeveritySet, ...exceptions]);
      for (const variant of c.axes.variants) {
        if (!allowed.has(variant.name)) {
          failures.push(
            `${id}: variant "${variant.name}" is not in CANON_SEVERITY (${[...canonSeveritySet].join(', ')}) and not in the documented exception list (${exceptions.length === 0 ? '—' : exceptions.join(', ')}). Either rename to canonical severity or add to SEVERITY_AXIS_REGISTRY exceptions with rationale.`,
          );
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  // P6-126 / ADR-030 — soft conformance check for the action-group sub-anatomy.
  // After the initial migration (Card, Alert, Modal, Drawer footer), the only
  // remaining button-group semantic slots are the wrapper containers
  // (Modal.footer, Drawer.footer) that hold the resolved action-group
  // children. Any *other* component declaring an inline `code.semantic:
  // button-group` slot is a candidate for migration — surface it loudly so
  // future authors notice without blocking CI.
  it('button-group slots prefer the action-group sub-anatomy ($ref) over inline declaration', async () => {
    const components = await loadComponents({ contentDir });

    // Components that intentionally keep an inline `button-group` slot as a
    // wrapper container; the action buttons live inside via `$ref`.
    const WRAPPER_ALLOWLIST: Readonly<Record<string, readonly string[]>> = {
      modal: ['footer'],
      drawer: ['footer'],
    };

    const candidates: string[] = [];
    for (const c of components.values()) {
      const allowedSlotIds = new Set(WRAPPER_ALLOWLIST[c.id] ?? []);
      for (const slot of c.anatomy) {
        const provenance = (slot as { __subAnatomy?: { id: string } }).__subAnatomy;
        if (provenance) continue;  // resolved-from-ref slots already use sub-anatomy
        if (slot.code.semantic !== 'button-group') continue;
        if (allowedSlotIds.has(slot.id)) continue;  // documented wrapper
        candidates.push(`${c.id}.${slot.id} (semantic: button-group) — consider $ref: action-group`);
      }
    }
    // Soft assertion: log warnings rather than fail. The allowlist is the
    // contract; any new entry to `candidates` means an author should review
    // whether the component should migrate to action-group or extend the
    // allowlist with a documented rationale.
    if (candidates.length > 0) {
      console.warn(
        '[consistency soft-lint] button-group slots without action-group $ref:\n  ' +
          candidates.join('\n  '),
      );
    }
    // The empty-array assertion enforces zero drift relative to the
    // expected post-P6-126 state. To intentionally accept a new wrapper
    // pattern, extend WRAPPER_ALLOWLIST above with a one-line rationale.
    expect(candidates).toEqual([]);
  });
});
