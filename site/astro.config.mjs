import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import pagefind from 'astro-pagefind';

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'directory',
  },
  integrations: [pagefind()],
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
