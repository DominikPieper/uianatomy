import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const components = await getCollection('components');
  return components.map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as CollectionEntry<'components'>;
  return new Response(JSON.stringify(entry.data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
