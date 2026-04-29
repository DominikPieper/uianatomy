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

export const floatingHintSchema = z.object({
  anchor: slug,
  position: z.enum(['below', 'right', 'above', 'left']),
  offset: z.number().int().nonnegative().optional(),
});

export const layoutHintSchema = z
  .object({
    row: z.number().int().positive().optional(),
    col: z.number().int().positive().optional(),
    span: layoutSpan.optional(),
    aspect: z
      .string()
      .regex(/^\d+:\d+$/, "aspect must look like '16:9'")
      .optional(),
    parent: slug.optional(),
    repeats: z.number().int().min(2).max(5).optional(),
    overlay: z.boolean().optional(),
    floating: floatingHintSchema.optional(),
  })
  .refine(
    (l) => l.parent !== undefined || l.overlay === true || l.floating !== undefined || l.row !== undefined,
    { message: 'layout requires `row` unless `parent`, `overlay`, or `floating` is set' },
  );

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

const tokenName = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/,
    'token name must be dotted lower-kebab, e.g. spacing.compact',
  );

export const slotTokenMap = z.record(z.string().min(1), tokenName);

export const slotTokensSchema = z
  .object({
    spacing: slotTokenMap.optional(),
    radius: slotTokenMap.optional(),
    color: slotTokenMap.optional(),
    elevation: slotTokenMap.optional(),
    typography: slotTokenMap.optional(),
  })
  .strict();

export const anatomySlotSchema = z.object({
  id: slug,
  required: z.boolean(),
  purpose: z.string().min(1),
  layout: layoutHintSchema,
  figma: figmaHintSchema,
  code: codeHintSchema,
  a11y: a11yHintSchema,
  tokens: slotTokensSchema.optional(),
});

const propertyPrimitiveSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('primitive'),
    of: z.enum(['boolean']),
  })
  .strict();

const propertyEnumSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('enum'),
    values: z
      .array(z.string().min(1))
      .min(2, 'enum must declare at least two values')
      .refine((v) => new Set(v).size === v.length, 'enum values must be unique'),
  })
  .strict();

export const propertySchema = z.discriminatedUnion('kind', [
  propertyPrimitiveSchema,
  propertyEnumSchema,
]);

export const transitionSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().min(1),
    trigger: z.string().min(1),
  })
  .strict();

export const statesSchema = z
  .object({
    interactive: z.array(z.string().min(1)),
    data: z.array(z.string().min(1)),
    transitions: z.array(transitionSchema).optional(),
  })
  .superRefine((states, ctx) => {
    if (!states.transitions) return;
    const declared = new Set([...states.interactive, ...states.data]);
    states.transitions.forEach((t, i) => {
      if (!declared.has(t.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transitions', i, 'from'],
          message: `from "${t.from}" must reference a declared interactive or data state`,
        });
      }
      if (!declared.has(t.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['transitions', i, 'to'],
          message: `to "${t.to}" must reference a declared interactive or data state`,
        });
      }
    });
  });

export const axesSchema = z.object({
  variants: z.array(z.string().min(1)),
  properties: z.array(propertySchema),
  states: statesSchema,
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

const motionDurationKey = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    'duration key must be camelCase, e.g. open, panelEnter',
  );

export const motionDurationMap = z
  .record(motionDurationKey, tokenName)
  .refine((m) => Object.keys(m).length > 0, {
    message: 'durations must declare at least one entry',
  });

export const reducedMotionFallbackSchema = z.enum([
  'instant',
  'reduced',
  'preserved',
]);

export const motionSchema = z
  .object({
    durations: motionDurationMap,
    easing: tokenName,
    reducedMotionFallback: reducedMotionFallbackSchema,
  })
  .strict();

export const breakpointEntrySchema = z
  .object({
    at: tokenName,
    change: z.string().min(1),
  })
  .strict();

export const responsiveSchema = z
  .object({
    breakpoints: z.array(breakpointEntrySchema).min(1),
  })
  .strict();

const eventName = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    'event name must be camelCase, e.g. select, openChange',
  );

export const eventFrameworkNotesSchema = z
  .object({
    webComponents: z.string().min(1),
    react: z.string().min(1),
    angularSignals: z.string().min(1),
    vue: z.string().min(1),
  })
  .strict();

export const eventSchema = z
  .object({
    name: eventName,
    payload: z.string().min(1),
    frameworkNotes: eventFrameworkNotesSchema,
  })
  .strict();

export const vsRelatedEntrySchema = z
  .object({
    id: slug,
    difference: z.string().min(1),
  })
  .strict();

export const whenToUseSchema = z
  .object({
    use: z.string().min(1),
    avoid: z.string().min(1),
    vsRelated: z.array(vsRelatedEntrySchema).min(1).optional(),
  })
  .strict();

const axeRuleId = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    'axe rule id must be kebab-case (e.g. button-name, color-contrast)',
  );

export const keyboardWalkEntrySchema = z
  .object({
    keys: z.string().min(1),
    expected: z.string().min(1),
  })
  .strict();

export const announcementEntrySchema = z
  .object({
    trigger: z.string().min(1),
    expected: z.string().min(1),
  })
  .strict();

export const formIntegrationSchema = z
  .object({
    name: z.string().min(1).optional(),
    formData: z.string().min(1).optional(),
    reset: z.string().min(1).optional(),
    validation: z.string().min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.name !== undefined ||
      v.formData !== undefined ||
      v.reset !== undefined ||
      v.validation !== undefined,
    {
      message:
        'formIntegration must declare at least one of name, formData, reset, validation',
    },
  );

export const figmaPropertyTypeSchema = z.enum([
  'Boolean',
  'Variant',
  'Text',
  'Instance Swap',
]);

export const propertyMapEntrySchema = z
  .object({
    figma: z.string().min(1),
    code: z.string().min(1),
    type: figmaPropertyTypeSchema,
    notes: z.string().min(1).optional(),
  })
  .strict();

export const propertyMapSchema = z.array(propertyMapEntrySchema).min(1);

export const a11yAcceptanceSchema = z
  .object({
    keyboardWalk: z.array(keyboardWalkEntrySchema).min(1).optional(),
    announcements: z.array(announcementEntrySchema).min(1).optional(),
    axeRules: z.array(axeRuleId).min(1).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.keyboardWalk !== undefined ||
      v.announcements !== undefined ||
      v.axeRules !== undefined,
    {
      message:
        'a11yAcceptance must declare at least one of keyboardWalk, announcements, axeRules',
    },
  );

const canonicalRefPath = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*|\[[a-zA-Z0-9-]+\])+$/,
    'canonical reference must be a dotted path with optional [index] suffix, e.g. anatomy[eyebrow], axes.properties[size], events[openChange]',
  );

const omittedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('omitted'),
    rationale: z.string().min(1),
  })
  .strict();

const renamedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('renamed'),
    to: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const extendedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('extended'),
    addition: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

const reshapedDivergenceSchema = z
  .object({
    from: canonicalRefPath,
    type: z.literal('reshaped'),
    to: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const divergenceSchema = z.discriminatedUnion('type', [
  omittedDivergenceSchema,
  renamedDivergenceSchema,
  extendedDivergenceSchema,
  reshapedDivergenceSchema,
]);

export const implementationSchema = z
  .object({
    componentId: slug,
    libraryId: slug,
    componentName: z.string().min(1),
    exampleCode: z.string().min(1).optional(),
    divergence: z.array(divergenceSchema).min(1).optional(),
    rationale: z.string().min(1).optional(),
    lastReviewed: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'lastReviewed must be ISO YYYY-MM-DD'),
  })
  .strict();

export const componentSchema = z.object({
  id: slug,
  name: z.string().min(1),
  description: z.string().min(1),
  whenToUse: whenToUseSchema.optional(),
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
  motion: motionSchema.optional(),
  responsive: responsiveSchema.optional(),
  events: z.array(eventSchema).min(1).optional(),
  a11yAcceptance: a11yAcceptanceSchema.optional(),
  propertyMap: propertyMapSchema.optional(),
  formIntegration: formIntegrationSchema.optional(),
});

export type LayoutHint = z.infer<typeof layoutHintSchema>;
export type FloatingHint = z.infer<typeof floatingHintSchema>;
export type AnatomySlot = z.infer<typeof anatomySlotSchema>;
export type SlotTokens = z.infer<typeof slotTokensSchema>;
export type Property = z.infer<typeof propertySchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type States = z.infer<typeof statesSchema>;
export type Axes = z.infer<typeof axesSchema>;
export type Mismatch = z.infer<typeof mismatchSchema>;
export type Mistake = z.infer<typeof mistakeSchema>;
export type FrameworkMap = z.infer<typeof frameworkMapSchema>;
export type Motion = z.infer<typeof motionSchema>;
export type ReducedMotionFallback = z.infer<typeof reducedMotionFallbackSchema>;
export type BreakpointEntry = z.infer<typeof breakpointEntrySchema>;
export type Responsive = z.infer<typeof responsiveSchema>;
export type EventFrameworkNotes = z.infer<typeof eventFrameworkNotesSchema>;
export type ComponentEvent = z.infer<typeof eventSchema>;
export type VsRelatedEntry = z.infer<typeof vsRelatedEntrySchema>;
export type WhenToUse = z.infer<typeof whenToUseSchema>;
export type KeyboardWalkEntry = z.infer<typeof keyboardWalkEntrySchema>;
export type AnnouncementEntry = z.infer<typeof announcementEntrySchema>;
export type A11yAcceptance = z.infer<typeof a11yAcceptanceSchema>;
export type FigmaPropertyType = z.infer<typeof figmaPropertyTypeSchema>;
export type PropertyMapEntry = z.infer<typeof propertyMapEntrySchema>;
export type PropertyMap = z.infer<typeof propertyMapSchema>;
export type FormIntegration = z.infer<typeof formIntegrationSchema>;
export type Divergence = z.infer<typeof divergenceSchema>;
export type Implementation = z.infer<typeof implementationSchema>;
export type Component = z.infer<typeof componentSchema>;
