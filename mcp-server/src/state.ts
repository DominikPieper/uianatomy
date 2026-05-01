import type { Component, Implementation, Pattern } from '@uianatomy/shared/schema';

let cache: Promise<Map<string, Component>> | null = null;
let implCache: Promise<Map<string, Map<string, Implementation>>> | null = null;
let patternCache: Promise<Map<string, Pattern>> | null = null;

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

export function setPatterns(map: Map<string, Pattern>): void {
  patternCache = Promise.resolve(map);
}

export function setPatternsPromise(p: Promise<Map<string, Pattern>>): void {
  patternCache = p;
}

export function getPatterns(): Promise<Map<string, Pattern>> {
  if (!patternCache) {
    throw new Error('uianatomy patterns not initialized — call setPatterns() or setPatternsDir() first');
  }
  return patternCache;
}

export function resetCache(): void {
  cache = null;
  implCache = null;
  patternCache = null;
}
