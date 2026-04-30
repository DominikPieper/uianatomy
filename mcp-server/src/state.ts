import type { Component } from '@uianatomy/shared/schema';

let cache: Promise<Map<string, Component>> | null = null;

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

export function resetCache(): void {
  cache = null;
}
