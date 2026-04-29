import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadComponents, type Component } from '@uianatomy/shared';

const here = dirname(fileURLToPath(import.meta.url));

function pickContentDir(): string {
  const candidates = [
    process.env.UIANATOMY_CONTENT_DIR,
    resolve(here, '..', '..', 'content', 'components'),
    resolve(process.cwd(), 'content', 'components'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[1] ?? resolve(process.cwd(), 'content', 'components');
}

const DEFAULT_CONTENT_DIR = pickContentDir();

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
