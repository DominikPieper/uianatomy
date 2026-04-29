import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { componentSchema } from '@uianatomy/shared/schema';

const components = defineCollection({
  loader: glob({ pattern: '*.yaml', base: '../content/components' }),
  schema: componentSchema,
});

export const collections = { components };
