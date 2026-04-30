import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadComponents } from '../src/loader.js';
import type { Component } from '../src/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');

// Canonical vocabularies (mirrored from docs/schema.md).
const CANON_SPACING = new Set([
  'spacing.tight',
  'spacing.compact',
  'spacing.cozy',
  'spacing.comfortable',
  'spacing.loose',
]);
const CANON_RADIUS = new Set([
  'radius.none',
  'radius.sm',
  'radius.md',
  'radius.lg',
  'radius.pill',
  'radius.full',
]);
const CANON_COLOR = new Set([
  'color.surface.bg',
  'color.surface.raised',
  'color.surface.sunken',
  'color.surface.scrim',
  'color.text.primary',
  'color.text.muted',
  'color.text.inverse',
  'color.text.accent',
  'color.border.subtle',
  'color.border.strong',
  'color.border.focus',
  'color.accent.bg',
  'color.accent.fg',
]);
const CANON_ELEVATION = new Set([
  'elevation.none',
  'elevation.sm',
  'elevation.md',
  'elevation.lg',
  'elevation.overlay',
]);
const CANON_TYPOGRAPHY = new Set([
  'text.xs',
  'text.sm',
  'text.md',
  'text.lg',
  'text.xl',
  'weight.regular',
  'weight.medium',
  'weight.semibold',
  'weight.bold',
  'leading.tight',
  'leading.snug',
  'leading.normal',
  'leading.relaxed',
  'tracking.normal',
  'tracking.wide',
]);
const CANON_MOTION_DURATION = new Set([
  'motion.duration.instant',
  'motion.duration.fast',
  'motion.duration.base',
  'motion.duration.slow',
  'motion.duration.slower',
]);
const CANON_MOTION_EASING = new Set([
  'motion.easing.standard',
  'motion.easing.decelerate',
  'motion.easing.accelerate',
  'motion.easing.sharp',
]);
const CANON_BREAKPOINTS = new Set([
  'breakpoint.xs',
  'breakpoint.sm',
  'breakpoint.md',
  'breakpoint.lg',
  'breakpoint.xl',
]);

// Property-name → expected enum values (when the component uses that property).
const PROPERTY_VOCAB: Record<string, ReadonlySet<string>> = {
  density: new Set(['comfortable', 'compact']),
};

// Property-name → values that may appear (subset allowed).
// `size: full` is a canonical extension for full-viewport variants
// (e.g. Drawer with mobile-fullscreen fallback). Documented in
// docs/schema.md alongside the standard sm/md/lg/xl scale.
const PROPERTY_BOUNDED: Record<string, ReadonlySet<string>> = {
  size: new Set(['sm', 'md', 'lg', 'xl', 'full']),
};

// Interactive state vocabulary — every interactive state must be in this set.
const CANON_INTERACTIVE_STATES = new Set([
  'hover',
  'focus-visible',
  'active',
  'disabled',
  'visited',
  'current',
]);

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
  checkCategory('spacing', tokens.spacing, CANON_SPACING);
  checkCategory('radius', tokens.radius, CANON_RADIUS);
  checkCategory('color', tokens.color, CANON_COLOR);
  checkCategory('elevation', tokens.elevation, CANON_ELEVATION);
  checkCategory('typography', tokens.typography, CANON_TYPOGRAPHY);
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
        if (!CANON_MOTION_DURATION.has(value)) {
          failures.push(
            `${c.id}: motion.durations.${key} = "${value}" not in canonical motion-duration vocabulary`,
          );
        }
      }
      if (!CANON_MOTION_EASING.has(c.motion.easing)) {
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
        if (!CANON_BREAKPOINTS.has(bp.at)) {
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
        if (!CANON_INTERACTIVE_STATES.has(s)) {
          failures.push(
            `${c.id}: interactive state "${s}" not in canonical interactive-state vocabulary [${[...CANON_INTERACTIVE_STATES].join(', ')}]`,
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
        if (!ids.has(ref.id)) {
          failures.push(`${c.id}: vsRelated.id "${ref.id}" does not resolve to a canonical component`);
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
