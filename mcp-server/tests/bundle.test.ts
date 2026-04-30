import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  loadComponents,
  loadComponentsFromBundle,
  loadImplementations,
  loadImplementationsFromBundle,
} from '@uianatomy/shared';
import bundleJson from '@uianatomy/shared/content-bundle.json';
import implBundleJson from '@uianatomy/shared/implementations-bundle.json';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const contentDir = resolve(repoRoot, 'content', 'components');
const implementationsDir = resolve(repoRoot, 'implementations');

describe('bundle vs fs loader equivalence', () => {
  it('produce equivalent component maps', async () => {
    const fsMap = await loadComponents({ contentDir });
    const bundleMap = loadComponentsFromBundle(bundleJson as Record<string, unknown>);
    expect(bundleMap.size).toBe(fsMap.size);
    for (const id of fsMap.keys()) {
      expect(bundleMap.get(id)).toEqual(fsMap.get(id));
    }
  });

  it('produce equivalent implementation maps', async () => {
    const fsMap = await loadImplementations({ implementationsDir });
    const bundleMap = loadImplementationsFromBundle(
      implBundleJson as Record<string, Record<string, unknown>>,
    );
    expect(bundleMap.size).toBe(fsMap.size);
    for (const [libraryId, fsByComponent] of fsMap) {
      const bundleByComponent = bundleMap.get(libraryId);
      expect(bundleByComponent).toBeTruthy();
      expect(bundleByComponent!.size).toBe(fsByComponent.size);
      for (const [componentId, fsImpl] of fsByComponent) {
        expect(bundleByComponent!.get(componentId)).toEqual(fsImpl);
      }
    }
  });
});
