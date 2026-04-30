import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadComponents } from '../dist/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const contentDir = resolve(repoRoot, 'content', 'components');
const outPath = resolve(here, '..', 'dist', 'content-bundle.json');

const components = await loadComponents({ contentDir });
const obj = Object.fromEntries(components);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(obj), 'utf-8');
console.log(`Bundled ${components.size} components → ${outPath}`);
