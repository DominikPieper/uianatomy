import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

const SITE_ORIGIN = 'https://uianatomy.dev';

export const GET: APIRoute = async () => {
  const entries = await getCollection('changelog');
  entries.sort((a, b) => b.data.date.localeCompare(a.data.date));
  return rss({
    title: 'UI Anatomy changelog',
    description:
      'Dated record of substantive changes to the UI Anatomy canon, schema, MCP server, and site.',
    site: SITE_ORIGIN,
    items: entries.map((entry) => ({
      title: entry.data.title,
      pubDate: new Date(entry.data.date),
      description: entry.data.summary,
      link: `${SITE_ORIGIN}/changelog#${entry.id}`,
      categories: entry.data.tags,
    })),
    customData: '<language>en-us</language>',
  });
};
