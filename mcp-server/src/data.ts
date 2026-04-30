import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadComponents } from '@uianatomy/shared';
import { setComponentsPromise } from './state.js';

export { setComponents, resetCache, getComponents } from './state.js';

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

export function setContentDir(dir: string = DEFAULT_CONTENT_DIR): void {
  setComponentsPromise(loadComponents({ contentDir: dir }));
}
