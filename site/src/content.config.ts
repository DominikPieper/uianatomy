import { defineCollection, z } from 'astro:content';
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

export const collections = { components, implementations, changelog };
