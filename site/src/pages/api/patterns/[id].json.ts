import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const patterns = await getCollection('patterns');
  return patterns.map((entry) => ({
    params: { id: entry.data.id },
    props: { entry },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as CollectionEntry<'patterns'>;
  return new Response(JSON.stringify(entry.data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
};
