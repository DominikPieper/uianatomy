import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const components = await getCollection('components');
  const body = {
    components: components
      .map((entry) => ({
        id: entry.id,
        name: entry.data.name,
        description: entry.data.description,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
