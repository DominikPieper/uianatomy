// Per-page OpenGraph + Twitter images, generated at build via Skia
// (astro-og-canvas / canvaskit-wasm). One PNG per route under /og/<slug>.png.
//
// URL convention mirrors the page tree:
//   /                          → /og/index.png
//   /components/modal          → /og/components/modal.png
//   /components/modal/dev      → /og/components/modal/dev.png
//   /search                    → /og/search.png

import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';

type ViewKey = 'designer' | 'dev' | 'bridge';

// Brand-aligned palette (paper bg + ink on top, accent rule on the leading edge).
const PAPER: [number, number, number] = [250, 248, 240];
const INK: [number, number, number] = [28, 28, 28];
const INK_MUTED: [number, number, number] = [110, 110, 110];

// Per-view accents — match the site's data-view tint vocabulary.
const VIEW_ACCENT: Record<ViewKey | 'site', [number, number, number]> = {
  site: [120, 90, 200],
  designer: [200, 120, 80],
  dev: [70, 130, 200],
  bridge: [120, 90, 200],
};

interface PageData {
  title: string;
  description: string;
  view?: ViewKey;
}

const components = await getCollection('components');
const patterns = await getCollection('patterns');

const pages: Record<string, PageData> = {
  index: {
    title: 'UI Anatomy',
    description: 'Canonical reference for UI component anatomy — the same truth, in three views.',
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
    view: 'designer',
  };
  for (const view of ['dev', 'bridge'] as const) {
    pages[`patterns/${entry.data.id}/${view}`] = {
      title: entry.data.name,
      description: entry.data.description,
      view,
    };
  }
}

for (const entry of components) {
  const id = entry.id;
  // Default route renders the designer view.
  pages[`components/${id}`] = {
    title: entry.data.name,
    description: entry.data.description,
    view: 'designer',
  };
  for (const view of ['dev', 'bridge'] as const) {
    pages[`components/${id}/${view}`] = {
      title: entry.data.name,
      description: entry.data.description,
      view,
    };
  }
}

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path, page: PageData) => {
    const accent = page.view ? VIEW_ACCENT[page.view] : VIEW_ACCENT.site;
    return {
      title: page.title,
      description: page.description,
      bgGradient: [PAPER],
      border: {
        color: accent,
        width: 12,
        side: 'inline-start',
      },
      padding: 80,
      font: {
        title: { color: INK, size: 72, weight: 'Bold', families: ['Inter', 'system-ui', 'sans-serif'] },
        description: { color: INK_MUTED, size: 32, weight: 'Normal', families: ['Inter', 'system-ui', 'sans-serif'] },
      },
    };
  },
});
