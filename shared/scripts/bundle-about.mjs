import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { loadAbout, ABOUT_SUMMARY } from '../dist/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const aboutPath = resolve(repoRoot, 'docs', 'about.md');
const outPath = resolve(here, '..', 'dist', 'about-bundle.json');

const payload = await loadAbout({ aboutPath });

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(payload), 'utf-8');
console.log(
  `Bundled about doc (${payload.markdown.length} chars markdown + ${ABOUT_SUMMARY.length} chars summary) → ${outPath}`,
);
