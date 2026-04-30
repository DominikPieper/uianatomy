import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadComponents, loadImplementations } from '@uianatomy/shared';
import { setComponentsPromise, setImplementationsPromise } from './state.js';

export {
  setComponents,
  setImplementations,
  resetCache,
  getComponents,
  getImplementations,
} from './state.js';

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

function pickImplementationsDir(): string {
  const candidates = [
    process.env.UIANATOMY_IMPLEMENTATIONS_DIR,
    resolve(here, '..', '..', 'implementations'),
    resolve(process.cwd(), 'implementations'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[1] ?? resolve(process.cwd(), 'implementations');
}

const DEFAULT_CONTENT_DIR = pickContentDir();
const DEFAULT_IMPLEMENTATIONS_DIR = pickImplementationsDir();

export function setContentDir(dir: string = DEFAULT_CONTENT_DIR): void {
  setComponentsPromise(loadComponents({ contentDir: dir }));
}

export function setImplementationsDir(dir: string = DEFAULT_IMPLEMENTATIONS_DIR): void {
  setImplementationsPromise(loadImplementations({ implementationsDir: dir }));
}
