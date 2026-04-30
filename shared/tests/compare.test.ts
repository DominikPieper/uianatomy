import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadComponents } from '../src/loader.js';
import { computeCompareDiff } from '../src/compare.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');

describe('computeCompareDiff', () => {
  it('returns trivial diff when both inputs are the same component', async () => {
    const map = await loadComponents({ contentDir });
    const card = map.get('card')!;
    const diff = computeCompareDiff(card, card);

    expect(diff.ids).toEqual({ a: 'card', b: 'card' });
    expect(diff.anatomy.requiredOnlyInA).toEqual([]);
    expect(diff.anatomy.requiredOnlyInB).toEqual([]);
    expect(diff.anatomy.optionalOnlyInA).toEqual([]);
    expect(diff.anatomy.optionalOnlyInB).toEqual([]);
    expect(diff.variants.onlyInA).toEqual([]);
    expect(diff.variants.onlyInB).toEqual([]);
    expect(diff.properties.onlyInA).toEqual([]);
    expect(diff.properties.onlyInB).toEqual([]);
    expect(diff.properties.sharedDifferentKind).toEqual([]);
    expect(diff.interactiveStates.onlyInA).toEqual([]);
    expect(diff.dataStates.onlyInA).toEqual([]);
    expect(diff.axeRules.onlyInA).toEqual([]);
  });

  it('surfaces the canon-pinned difference when A.vsRelated cites B', async () => {
    const map = await loadComponents({ contentDir });
    // Card declares vsRelated: [{ id: 'tile', difference: '...' }, ...]
    const card = map.get('card')!;
    const tile = map.get('tile')!;
    const diff = computeCompareDiff(card, tile);

    expect(diff.vsRelated.aMentionsB).toBeTypeOf('string');
    expect(diff.vsRelated.aMentionsB!.length).toBeGreaterThan(20);
    // Tile also cross-references Card in canon, so the mirror prose is also
    // present.
    expect(diff.vsRelated.bMentionsA).toBeTypeOf('string');
  });

  it('reports asymmetric anatomy when components differ structurally', async () => {
    const map = await loadComponents({ contentDir });
    const button = map.get('button')!;
    const combobox = map.get('combobox')!;
    const diff = computeCompareDiff(button, combobox);

    // Button has no slots in common with Combobox's listbox / option / clear /
    // input set — the anatomy diff should be predominantly asymmetric.
    expect(diff.anatomy.requiredOnlyInB.length).toBeGreaterThan(0);
    // Combobox declares variants (e.g. multi-select / async) that Button
    // doesn't, so the variant diff is non-trivial.
    expect(diff.variants.onlyInA.length + diff.variants.onlyInB.length).toBeGreaterThan(0);
    // Combobox declares data states like "busy" that Button doesn't (Button's
    // data states are essentially empty).
    expect(diff.dataStates.onlyInA.length + diff.dataStates.onlyInB.length).toBeGreaterThan(0);
  });

  it('classifies shared properties by kind match vs mismatch', async () => {
    const map = await loadComponents({ contentDir });
    const button = map.get('button')!;
    const link = map.get('link')!;
    const diff = computeCompareDiff(button, link);

    // Shape assertions: same-kind list is sorted strings, mismatched list is
    // sorted records with name + aKind + bKind.
    expect(Array.isArray(diff.properties.sharedSameKind)).toBe(true);
    for (const entry of diff.properties.sharedDifferentKind) {
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('aKind');
      expect(entry).toHaveProperty('bKind');
      expect(entry.aKind).not.toBe(entry.bKind);
    }
    // The same-kind list and the different-kind list never overlap.
    const sameNames = new Set(diff.properties.sharedSameKind);
    for (const entry of diff.properties.sharedDifferentKind) {
      expect(sameNames.has(entry.name)).toBe(false);
    }
  });
});
