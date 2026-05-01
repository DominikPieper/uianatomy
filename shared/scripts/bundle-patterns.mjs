import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadPatterns } from '../dist/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const patternsDir = resolve(repoRoot, 'content', 'patterns');
const outPath = resolve(here, '..', 'dist', 'patterns-bundle.json');

const patterns = await loadPatterns({ patternsDir });
const obj = Object.fromEntries(patterns);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(obj), 'utf-8');
console.log(`Bundled ${patterns.size} patterns → ${outPath}`);
