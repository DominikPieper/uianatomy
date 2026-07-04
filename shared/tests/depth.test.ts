import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadComponents } from '../src/loader.js';
import type { Component } from '../src/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');

// mistakes/mismatches are a smoke floor, not a volume target (ADR-035):
// counts measure that the section was populated at all, not how much a
// component "should" have. The old MIN=4 induced padding (P6-186 had to
// hand-fix 11 components carrying a synthesized 4th mismatch); real depth
// judgment belongs to semantic review (canon-auditor / component-review),
// not this count.
const MIN = {
  anatomySlots: 3,
  variants: 2,
  properties: 2,
  statesCombined: 4,
  mistakes: 2,
  mismatches: 2,
  sources: 3,
} as const;

type Override = Partial<typeof MIN>;
const overrides: Record<string, Override> = {};

function effective(id: string): typeof MIN {
  return { ...MIN, ...(overrides[id] ?? {}) };
}

describe('component editorial depth', () => {
  it('every canonical component meets the minimum depth contract', async () => {
    const map = await loadComponents({ contentDir });
    const components = [...map.values()] as Component[];
    expect(components.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const c of components) {
      const min = effective(c.id);
      const stateCount =
        c.axes.states.interactive.length + c.axes.states.data.length;
      const sourceCount = c.sources?.length ?? 0;

      const checks: Array<[boolean, string]> = [
        [c.anatomy.length >= min.anatomySlots, `anatomy ${c.anatomy.length} < ${min.anatomySlots}`],
        [c.axes.variants.length >= min.variants, `variants ${c.axes.variants.length} < ${min.variants}`],
        [c.axes.properties.length >= min.properties, `properties ${c.axes.properties.length} < ${min.properties}`],
        [stateCount >= min.statesCombined, `states ${stateCount} < ${min.statesCombined}`],
        [c.mistakes.length >= min.mistakes, `mistakes ${c.mistakes.length} < ${min.mistakes}`],
        [c.mismatches.length >= min.mismatches, `mismatches ${c.mismatches.length} < ${min.mismatches}`],
        [sourceCount >= min.sources, `sources ${sourceCount} < ${min.sources}`],
        [Boolean(c.lastReviewed), `lastReviewed missing`],
      ];

      for (const [ok, msg] of checks) {
        if (!ok) failures.push(`${c.id}: ${msg}`);
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });
});
