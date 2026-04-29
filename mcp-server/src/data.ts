import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadComponents, type Component } from '@uianatomy/shared';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONTENT_DIR = resolve(here, '..', '..', 'content', 'components');

let cache: Promise<Map<string, Component>> | null = null;

export function setContentDir(_dir: string): void {
  cache = loadComponents({ contentDir: _dir });
}

export function getComponents(contentDir: string = DEFAULT_CONTENT_DIR): Promise<Map<string, Component>> {
  if (!cache) cache = loadComponents({ contentDir });
  return cache;
}

export function resetCache(): void {
  cache = null;
}
