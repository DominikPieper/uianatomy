import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const patterns = await getCollection('patterns');
  const body = {
    patterns: patterns
      .map((entry) => ({
        id: entry.data.id,
        name: entry.data.name,
        description: entry.data.description,
        components: [
          ...new Set(entry.data.composition.map((c) => c.componentId)),
        ],
        lastReviewed: entry.data.lastReviewed,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
};
