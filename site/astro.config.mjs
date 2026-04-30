import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import sitemap from '@astrojs/sitemap';
import llms from 'astro-llms-md';
import brokenLinks from 'astro-broken-links-checker';
import icon from 'astro-icon';
import expressiveCode from 'astro-expressive-code';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// Per-component lastReviewed dates, parsed once at config load. Used by the
// sitemap integration's `serialize` callback so each /components/<id>(/<view>)
// entry's <lastmod> reflects the canonical YAML's lastReviewed instead of the
// build clock — telling crawlers the actual content-freshness signal.
const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '..', 'content', 'components');
const lastReviewedById = new Map();
for (const file of readdirSync(contentDir)) {
  if (!file.endsWith('.yaml')) continue;
  const id = file.replace(/\.yaml$/, '');
  const raw = readFileSync(resolve(contentDir, file), 'utf-8');
  const parsed = yaml.load(raw);
  if (parsed && typeof parsed === 'object' && 'lastReviewed' in parsed) {
    lastReviewedById.set(id, parsed.lastReviewed);
  }
}

export default defineConfig({
  site: 'https://uianatomy.dev',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [
    expressiveCode(),
    icon(),
    pagefind(),
    sitemap({
      filter: (page) =>
        !page.includes('/api/') &&
        !page.includes('/og/') &&
        !page.endsWith('/404') &&
        !page.endsWith('/404/'),
      serialize(item) {
        // Map /components/<id> and /components/<id>/<view> URLs to the
        // canonical lastReviewed date so crawlers see real freshness.
        const match = item.url.match(/\/components\/([^/]+)(?:\/[^/]+)?\/?$/);
        if (match) {
          const lastReviewed = lastReviewedById.get(match[1]);
          if (lastReviewed) item.lastmod = lastReviewed;
        }
        return item;
      },
    }),
    llms({
      contentSelector: 'article',
      titleSelector: 'h1',
      generateIndividualMd: true,
      generateLlmsTxt: true,
      generateLlmsFullTxt: true,
      exclude: ['404', '404.html', '_astro', '**.xml', '**.txt', 'node_modules', 'api/**', 'pagefind/**', 'og/**', 'compare', 'compare/**'],
    }),
    brokenLinks({
      checkExternalLinks: false,
      throwError: false,
    }),
  ],
  vite: {
    plugins: [tailwind()],
  },
});
