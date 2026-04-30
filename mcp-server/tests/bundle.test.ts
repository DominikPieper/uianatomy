import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadComponents, loadComponentsFromBundle } from '@uianatomy/shared';
import bundleJson from '@uianatomy/shared/content-bundle.json';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const contentDir = resolve(repoRoot, 'content', 'components');

describe('bundle vs fs loader equivalence', () => {
  it('produce equivalent component maps', async () => {
    const fsMap = await loadComponents({ contentDir });
    const bundleMap = loadComponentsFromBundle(bundleJson as Record<string, unknown>);
    expect(bundleMap.size).toBe(fsMap.size);
    for (const id of fsMap.keys()) {
      expect(bundleMap.get(id)).toEqual(fsMap.get(id));
    }
  });
});
