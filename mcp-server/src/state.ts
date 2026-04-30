import type { Component, Implementation } from '@uianatomy/shared/schema';

let cache: Promise<Map<string, Component>> | null = null;
let implCache: Promise<Map<string, Map<string, Implementation>>> | null = null;

export function setComponents(map: Map<string, Component>): void {
  cache = Promise.resolve(map);
}

export function setComponentsPromise(p: Promise<Map<string, Component>>): void {
  cache = p;
}

export function getComponents(): Promise<Map<string, Component>> {
  if (!cache) {
    throw new Error('uianatomy components not initialized — call setComponents() or setContentDir() first');
  }
  return cache;
}

export function setImplementations(map: Map<string, Map<string, Implementation>>): void {
  implCache = Promise.resolve(map);
}

export function setImplementationsPromise(p: Promise<Map<string, Map<string, Implementation>>>): void {
  implCache = p;
}

export function getImplementations(): Promise<Map<string, Map<string, Implementation>>> {
  if (!implCache) {
    throw new Error('uianatomy implementations not initialized — call setImplementations() or setImplementationsDir() first');
  }
  return implCache;
}

export function resetCache(): void {
  cache = null;
  implCache = null;
}
