import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { componentSchema, implementationSchema } from '@uianatomy/shared/schema';

const components = defineCollection({
  loader: glob({ pattern: '*.yaml', base: '../content/components' }),
  schema: componentSchema,
});

const implementations = defineCollection({
  loader: glob({ pattern: '*/*.yaml', base: '../implementations' }),
  schema: implementationSchema,
});

export const collections = { components, implementations };
