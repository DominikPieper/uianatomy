import { z } from 'zod';

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case');

export const layoutSpan = z.union([
  z.literal('full'),
  z.literal('half'),
  z.literal('third'),
  z.literal('quarter'),
  z.number().int().positive(),
]);

export const layoutHintSchema = z.object({
  row: z.number().int().positive(),
  col: z.number().int().positive().optional(),
  span: layoutSpan,
  aspect: z
    .string()
    .regex(/^\d+:\d+$/, "aspect must look like '16:9'")
    .optional(),
});

export const figmaHintSchema = z.object({
  type: z.string().min(1),
  hint: z.string().min(1),
});

export const codeHintSchema = z.object({
  slot: z.string().min(1),
  semantic: z.string().min(1),
});

export const a11yHintSchema = z.object({
  hint: z.string().min(1),
});

export const anatomySlotSchema = z.object({
  id: slug,
  required: z.boolean(),
  purpose: z.string().min(1),
  layout: layoutHintSchema,
  figma: figmaHintSchema,
  code: codeHintSchema,
  a11y: a11yHintSchema,
});

export const propertySchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});

export const axesSchema = z.object({
  variants: z.array(z.string().min(1)),
  properties: z.array(propertySchema),
  states: z.object({
    interactive: z.array(z.string().min(1)),
    data: z.array(z.string().min(1)),
  }),
});

export const mismatchSchema = z.object({
  figma: z.string().min(1),
  code: z.string().min(1),
  consequence: z.string().min(1),
  correct: z.string().min(1),
});

export const mistakeSchema = z.object({
  id: slug,
  title: z.string().min(1),
  description: z.string().min(1),
  fix: z.string().min(1),
});

const frameworkEntrySchema = z.object({
  structureMechanism: z.string().min(1),
  variantMechanism: z.string().min(1),
});

export const frameworkMapSchema = z.object({
  webComponents: frameworkEntrySchema,
  react: frameworkEntrySchema,
  angularSignals: frameworkEntrySchema,
  vue: frameworkEntrySchema,
});

export const componentSchema = z.object({
  id: slug,
  name: z.string().min(1),
  description: z.string().min(1),
  related: z.array(slug).optional(),
  notes: z.string().optional(),
  lastReviewed: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'lastReviewed must be ISO YYYY-MM-DD')
    .optional(),
  sources: z.array(z.string().min(1)).optional(),
  anatomy: z.array(anatomySlotSchema).min(1),
  axes: axesSchema,
  mismatches: z.array(mismatchSchema).min(1),
  mistakes: z.array(mistakeSchema).min(1),
  frameworkMap: frameworkMapSchema,
});

export type LayoutHint = z.infer<typeof layoutHintSchema>;
export type AnatomySlot = z.infer<typeof anatomySlotSchema>;
export type Property = z.infer<typeof propertySchema>;
export type Axes = z.infer<typeof axesSchema>;
export type Mismatch = z.infer<typeof mismatchSchema>;
export type Mistake = z.infer<typeof mistakeSchema>;
export type FrameworkMap = z.infer<typeof frameworkMapSchema>;
export type Component = z.infer<typeof componentSchema>;
