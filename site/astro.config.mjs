import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import sitemap from '@astrojs/sitemap';
import llms from 'astro-llms-md';
import brokenLinks from 'astro-broken-links-checker';
import icon from 'astro-icon';
import expressiveCode from 'astro-expressive-code';

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
      filter: (page) => !page.includes('/api/') && !page.includes('/og/'),
    }),
    llms({
      contentSelector: 'article',
      titleSelector: 'h1',
      generateIndividualMd: true,
      generateLlmsTxt: true,
      generateLlmsFullTxt: true,
      exclude: ['404', '404.html', '_astro', '**.xml', '**.txt', 'node_modules', 'api/**', 'pagefind/**', 'og/**'],
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
