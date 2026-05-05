import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadComponents, loadSubAnatomies } from '../dist/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const contentDir = resolve(repoRoot, 'content', 'components');
const subAnatomiesDir = resolve(repoRoot, 'content', 'sub-anatomies');
const outPath = resolve(here, '..', 'dist', 'content-bundle.json');
const subAnatomyOutPath = resolve(here, '..', 'dist', 'sub-anatomies-bundle.json');

// P6-126 / ADR-030 — load sub-anatomies first so loadComponents can resolve
// `$ref` entries eagerly. The component bundle written below contains
// pre-resolved flat anatomy; the worker never needs to resolve refs at
// runtime. The sub-anatomy bundle is written separately for tools that
// want the canonical patterns (MCP get_sub_anatomy, etc.).
const subAnatomies = await loadSubAnatomies({ subAnatomiesDir });
const components = await loadComponents({ contentDir, subAnatomies });
const obj = Object.fromEntries(components);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(obj), 'utf-8');
console.log(`Bundled ${components.size} components → ${outPath}`);

const subObj = Object.fromEntries(subAnatomies);
await writeFile(subAnatomyOutPath, JSON.stringify(subObj), 'utf-8');
console.log(`Bundled ${subAnatomies.size} sub-anatomies → ${subAnatomyOutPath}`);
