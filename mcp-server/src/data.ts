import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadComponents, loadImplementations, loadPatterns, loadSubAnatomies } from '@uianatomy/shared';
import {
  setComponentsPromise,
  setImplementationsPromise,
  setPatternsPromise,
  setSubAnatomiesPromise,
} from './state.js';

export {
  setComponents,
  setImplementations,
  setPatterns,
  setSubAnatomies,
  resetCache,
  getComponents,
  getImplementations,
  getPatterns,
  getSubAnatomies,
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

function pickPatternsDir(): string {
  const candidates = [
    process.env.UIANATOMY_PATTERNS_DIR,
    resolve(here, '..', '..', 'content', 'patterns'),
    resolve(process.cwd(), 'content', 'patterns'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[1] ?? resolve(process.cwd(), 'content', 'patterns');
}

function pickSubAnatomiesDir(): string {
  const candidates = [
    process.env.UIANATOMY_SUB_ANATOMIES_DIR,
    resolve(here, '..', '..', 'content', 'sub-anatomies'),
    resolve(process.cwd(), 'content', 'sub-anatomies'),
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[1] ?? resolve(process.cwd(), 'content', 'sub-anatomies');
}

const DEFAULT_CONTENT_DIR = pickContentDir();
const DEFAULT_IMPLEMENTATIONS_DIR = pickImplementationsDir();
const DEFAULT_PATTERNS_DIR = pickPatternsDir();
const DEFAULT_SUB_ANATOMIES_DIR = pickSubAnatomiesDir();

export function setContentDir(dir: string = DEFAULT_CONTENT_DIR): void {
  // P6-126 / ADR-030 — components reference sub-anatomies via `$ref`. The
  // loader resolves them eagerly when the sub-anatomies map is supplied.
  // Pre-load sub-anatomies so component loading sees them.
  const subAnatomiesPromise = loadSubAnatomies({ subAnatomiesDir: DEFAULT_SUB_ANATOMIES_DIR });
  setSubAnatomiesPromise(subAnatomiesPromise);
  setComponentsPromise(
    subAnatomiesPromise.then((subAnatomies) =>
      loadComponents({ contentDir: dir, subAnatomies }),
    ),
  );
}

export function setImplementationsDir(dir: string = DEFAULT_IMPLEMENTATIONS_DIR): void {
  setImplementationsPromise(loadImplementations({ implementationsDir: dir }));
}

export function setPatternsDir(dir: string = DEFAULT_PATTERNS_DIR): void {
  setPatternsPromise(loadPatterns({ patternsDir: dir }));
}

export function setSubAnatomiesDir(dir: string = DEFAULT_SUB_ANATOMIES_DIR): void {
  setSubAnatomiesPromise(loadSubAnatomies({ subAnatomiesDir: dir }));
}
