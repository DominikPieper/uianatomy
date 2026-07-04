// Per-page OpenGraph + Twitter images, generated at build via Skia
// (astro-og-canvas / canvaskit-wasm). One PNG per route under /og/<slug>.png.
//
// URL convention mirrors the page tree:
//   /                          → /og/index.png
//   /components/modal          → /og/components/modal.png
//   /search                    → /og/search.png
//
// ADR-038 — one page per component/pattern now (role is a client-side lens,
// not a route), so this generates exactly one OG image per entity instead
// of three.

import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';

// Brand-aligned palette (paper bg + ink on top, accent rule on the leading edge).
const PAPER: [number, number, number] = [250, 248, 240];
const INK: [number, number, number] = [28, 28, 28];
const INK_MUTED: [number, number, number] = [110, 110, 110];
const ACCENT: [number, number, number] = [120, 90, 200];

interface PageData {
  title: string;
  description: string;
}

const components = await getCollection('components');
const patterns = await getCollection('patterns');

const pages: Record<string, PageData> = {
  index: {
    title: 'UI Anatomy',
    description: 'Canonical reference for UI component anatomy — one page per component, for designers and developers alike.',
  },
  search: {
    title: 'Search',
    description: 'Find canonical UI Anatomy components by name, slot, or variant.',
  },
  patterns: {
    title: 'Patterns',
    description: 'Canonical compositions of UI Anatomy components.',
  },
  integrate: {
    title: 'Integrate',
    description: 'Wire the UI Anatomy MCP server into Claude Code, Claude Desktop, Cursor, or a direct SDK.',
  },
  methodology: {
    title: 'Methodology',
    description: 'How UI Anatomy researches, writes, and validates each canonical component.',
  },
  changelog: {
    title: 'Changelog',
    description: 'Dated record of substantive changes to the UI Anatomy canon.',
  },
};

for (const entry of patterns) {
  pages[`patterns/${entry.data.id}`] = {
    title: entry.data.name,
    description: entry.data.description,
  };
}

for (const entry of components) {
  pages[`components/${entry.id}`] = {
    title: entry.data.name,
    description: entry.data.description,
  };
}

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path, page: PageData) => ({
    title: page.title,
    description: page.description,
    bgGradient: [PAPER],
    border: {
      color: ACCENT,
      width: 12,
      side: 'inline-start',
    },
    padding: 80,
    font: {
      title: { color: INK, size: 72, weight: 'Bold', families: ['Inter', 'system-ui', 'sans-serif'] },
      description: { color: INK_MUTED, size: 32, weight: 'Normal', families: ['Inter', 'system-ui', 'sans-serif'] },
    },
  }),
});
