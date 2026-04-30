// Postbuild fixup for astro-llms-md output.
//
// astro-llms-md writes the homepage markdown as `dist/.md` (empty stem
// derived from the empty path of `/`), which is a hidden file on POSIX
// systems and is filtered out by Cloudflare Pages' static asset server.
// Rename it to `dist/index.md` so the markdown-negotiation middleware
// can fetch it via a normal asset URL.

import { renameSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');
const hidden = resolve(distDir, '.md');
const target = resolve(distDir, 'index.md');

if (existsSync(hidden)) {
  renameSync(hidden, target);
  console.log(`[fix-llms-md] renamed ${hidden} -> ${target}`);
} else {
  console.log('[fix-llms-md] no dist/.md to rename (skipping)');
}
