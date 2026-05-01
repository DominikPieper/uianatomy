#!/usr/bin/env node
// Pings IndexNow (https://www.indexnow.org/) with the canonical URL list
// after a successful deploy. Bing, Yandex, Seznam, and Naver act on it
// directly; Google has expressed intent to consume the protocol.
//
// Wired into the root `deploy` script: `wrangler deploy && node
// scripts/indexnow-ping.mjs`. Skips silently if the IndexNow key file is
// missing (e.g. local builds, branch deploys without the secret).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HOST = 'uianatomy.dev';
const KEY = '44e5f5f3939b4bab8c4b23198b0c54c5';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const here = dirname(fileURLToPath(import.meta.url));
const sitemapPath = resolve(here, '..', 'site', 'dist', 'sitemap-0.xml');

async function urlsFromSitemap() {
  const xml = await readFile(sitemapPath, 'utf8');
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return matches.filter((u) => u.startsWith(`https://${HOST}`));
}

async function ping(urls) {
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res;
}

async function main() {
  let urls;
  try {
    urls = await urlsFromSitemap();
  } catch (err) {
    console.warn(`[indexnow] sitemap not found at ${sitemapPath} — skipping ping (run \`pnpm -C site build\` first).`);
    process.exit(0);
  }
  if (urls.length === 0) {
    console.warn('[indexnow] sitemap had no URLs — nothing to ping.');
    return;
  }
  if (process.env.INDEXNOW_DRY_RUN === '1' || process.argv.includes('--dry-run')) {
    console.log(`[indexnow] dry-run — would POST ${urls.length} URLs to ${ENDPOINT}`);
    console.log(`[indexnow] first 5: ${urls.slice(0, 5).join(', ')}`);
    return;
  }
  const res = await ping(urls);
  if (res.status === 200 || res.status === 202) {
    console.log(`[indexnow] pinged ${urls.length} URLs — HTTP ${res.status}`);
    return;
  }
  const text = await res.text();
  console.error(`[indexnow] HTTP ${res.status}: ${text}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('[indexnow] unexpected error:', err);
  process.exitCode = 1;
});
