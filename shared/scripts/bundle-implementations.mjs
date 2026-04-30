import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadImplementations } from '../dist/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const implementationsDir = resolve(repoRoot, 'implementations');
const outPath = resolve(here, '..', 'dist', 'implementations-bundle.json');

const byLibrary = await loadImplementations({ implementationsDir });

// Serialize the nested Map<libraryId, Map<componentId, Implementation>> as
// Record<libraryId, Record<componentId, Implementation>> so the JSON survives
// a round-trip through the Workers import-attribute import path.
const obj = {};
for (const [libraryId, byComponent] of byLibrary) {
  obj[libraryId] = Object.fromEntries(byComponent);
}

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(obj), 'utf-8');

const total = [...byLibrary.values()].reduce((acc, m) => acc + m.size, 0);
console.log(
  `Bundled ${total} implementation${total === 1 ? '' : 's'} across ${byLibrary.size} librar${byLibrary.size === 1 ? 'y' : 'ies'} → ${outPath}`,
);
