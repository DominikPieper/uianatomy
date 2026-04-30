import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://uianatomy.dev',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [
    pagefind(),
    sitemap({
      filter: (page) => !page.includes('/api/'),
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark-default',
      },
      defaultColor: false,
      wrap: true,
    },
  },
  vite: {
    plugins: [tailwind()],
  },
});
