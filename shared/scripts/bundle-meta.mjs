// P6-212 — minimum-viable corpus versioning. The full changelog machinery
// (per-component `since`/`changelog`) was deleted as dormant (P6-203,
// ADR-023); this is deliberately smaller — a build-time content hash so a
// consumer (agent, cache, CI) can answer "did the corpus change since I last
// looked" without diffing every bundle. Written last, after the four content
// bundles it hashes, so it reflects their final written bytes.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');
const outPath = resolve(distDir, 'meta-bundle.json');

const BUNDLE_FILES = [
  'content-bundle.json',
  'sub-anatomies-bundle.json',
  'implementations-bundle.json',
  'patterns-bundle.json',
];

const hash = createHash('sha256');
for (const file of BUNDLE_FILES) {
  hash.update(await readFile(resolve(distDir, file)));
}
const contentHash = hash.digest('hex').slice(0, 12);

const payload = {
  contentHash,
  generatedAt: new Date().toISOString(),
};

await mkdir(distDir, { recursive: true });
await writeFile(outPath, JSON.stringify(payload), 'utf-8');
console.log(`Bundled meta (contentHash ${contentHash}) → ${outPath}`);
