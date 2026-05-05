import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { componentSchema, implementationSchema, patternSchema, type AnatomySlot, type AnatomySlotRef, type SubAnatomy } from '@uianatomy/shared/schema';
import { resolveAnatomyRefs } from '@uianatomy/shared/loader';
import subAnatomiesBundle from '@uianatomy/shared/sub-anatomies-bundle.json' with { type: 'json' };
import { subAnatomySchema } from '@uianatomy/shared/schema';

// P6-126 / ADR-030 — load sub-anatomies once at module top-level so the
// componentSchema transform below can resolve `$ref` entries synchronously
// during Astro's content-collection parse.
const subAnatomies: Map<string, SubAnatomy> = new Map(
  Object.entries(subAnatomiesBundle as Record<string, unknown>).map(([id, raw]) => {
    const result = subAnatomySchema.safeParse(raw);
    if (!result.success) {
      throw new Error(`Sub-anatomy bundle entry "${id}" failed validation: ${JSON.stringify(result.error.format())}`);
    }
    return [id, result.data];
  }),
);

// Wrap componentSchema with a transform that resolves anatomy refs eagerly.
// Output type stays compatible — anatomy becomes a flat AnatomySlot[].
//
// P6-126b — `resolveAnatomyRefs` attaches provenance as a non-enumerable
// `__subAnatomy` property on each resolved slot (loader.ts:354). Astro 5's
// content-layer caches collection entries to JSON on disk, which strips
// non-enumerable own properties. Lift the marker into an enumerable own
// property here so it survives the cache round-trip and is reachable from
// `.astro` templates as `slot.__subAnatomy`.
const resolvedComponentSchema = componentSchema.transform((c) => {
  const resolved = resolveAnatomyRefs(
    c.anatomy as Array<AnatomySlot | AnatomySlotRef>,
    subAnatomies,
  );
  const withProvenance = resolved.map((slot) => {
    const prov = (slot as { __subAnatomy?: { id: string; slot: string } }).__subAnatomy;
    return prov ? { ...slot, __subAnatomy: prov } : slot;
  });
  return { ...c, anatomy: withProvenance };
});

const components = defineCollection({
  loader: glob({ pattern: '*.yaml', base: '../content/components' }),
  schema: resolvedComponentSchema,
});

const implementations = defineCollection({
  loader: glob({ pattern: '*/*.yaml', base: '../implementations' }),
  schema: implementationSchema,
});

const changelog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/changelog' }),
  schema: z.object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be ISO YYYY-MM-DD'),
    title: z.string().min(1),
    summary: z.string().min(1),
    tags: z.array(z.string().min(1)).optional(),
  }),
});

const patterns = defineCollection({
  loader: glob({ pattern: '*.yaml', base: '../content/patterns' }),
  schema: patternSchema,
});

export const collections = { components, implementations, changelog, patterns };
