import { z } from 'zod';
import { LIBRARY_VERSIONS } from './vocabulary.js';

const LIBRARY_KEYS = Object.keys(LIBRARY_VERSIONS) as [string, ...string[]];

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

export const slotKindSchema = z.enum([
  'structural',
  'interactive',
  'content',
  'decorative',
]);

const semver = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'must be SemVer MAJOR.MINOR.PATCH (e.g. 1.2.0)');

export const deprecationSchema = z
  .object({
    since: semver,
    reason: z.string().min(1),
    replacement: z.string().min(1).optional(),
  })
  .strict();

export const anatomySlotSchema = z.object({
  id: slug,
  required: z.boolean(),
  purpose: z.string().min(1),
  slotKind: slotKindSchema.optional(),
  layout: layoutHintSchema,
  figma: figmaHintSchema,
  code: codeHintSchema,
  a11y: a11yHintSchema,
  tokens: slotTokensSchema.optional(),
  since: semver.optional(),
  deprecated: deprecationSchema.optional(),
});

const propertyPrimitiveSchema = z
  .object({
    name: z.string().min(1),
    kind: z.literal('primitive'),
    of: z.enum(['boolean']),
    since: semver.optional(),
    deprecated: deprecationSchema.optional(),
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
    since: semver.optional(),
    deprecated: deprecationSchema.optional(),
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
          code: 'custom',
          path: ['transitions', i, 'from'],
          message: `from "${t.from}" must reference a declared interactive or data state`,
        });
      }
      if (!declared.has(t.to)) {
        ctx.addIssue({
          code: 'custom',
          path: ['transitions', i, 'to'],
          message: `to "${t.to}" must reference a declared interactive or data state`,
        });
      }
    });
  });

export const variantDeprecationSchema = z
  .object({
    name: z.string().min(1),
    since: semver,
    reason: z.string().min(1),
    replacement: z.string().min(1).optional(),
  })
  .strict();

export const axesSchema = z
  .object({
    variants: z.array(z.string().min(1)),
    properties: z.array(propertySchema),
    states: statesSchema,
    variantDeprecations: z.array(variantDeprecationSchema).min(1).optional(),
  })
  .superRefine((axes, ctx) => {
    if (!axes.variantDeprecations) return;
    const known = new Set(axes.variants);
    const seen = new Set<string>();
    axes.variantDeprecations.forEach((d, i) => {
      if (!known.has(d.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variantDeprecations', i, 'name'],
          message: `variantDeprecations[${i}].name "${d.name}" must reference a declared variant`,
        });
      }
      if (seen.has(d.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['variantDeprecations', i, 'name'],
          message: `variantDeprecations[${i}].name "${d.name}" is declared twice`,
        });
      }
      seen.add(d.name);
    });
  });

export const mismatchSchema = z.object({
  figma: z.string().min(1),
  code: z.string().min(1),
  consequence: z.string().min(1),
  correct: z.string().min(1),
});

export const mistakeSeveritySchema = z.enum(['blocker', 'major', 'minor']);

export const mistakeSchema = z.object({
  id: slug,
  severity: mistakeSeveritySchema,
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
    optional: z.boolean().optional(),
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

const perfMetricName = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    'performance threshold name must be camelCase (e.g. virtualisedListbox)',
  );

export const performanceThresholdSchema = z
  .object({
    name: perfMetricName,
    metric: z.string().min(1),
    threshold: z.number().positive(),
    unit: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const performanceSchema = z.array(performanceThresholdSchema).min(1);

export const i18nRtlSchema = z
  .object({
    mirroring: z.string().min(1),
  })
  .strict();

export const i18nSchema = z
  .object({
    rtl: i18nRtlSchema,
    textExpansion: z.string().min(1),
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

export const propertyKindSchema = z.enum([
  'enum',
  'boolean',
  'text',
  'slot',
  'number',
]);

export const propertyMapEntrySchema = z
  .object({
    figma: z.string().min(1),
    code: z.string().min(1),
    kind: propertyKindSchema,
    notes: z.string().min(1).optional(),
  })
  .strict();

export const propertyMapSchema = z.array(propertyMapEntrySchema).min(1);

const axeCoreVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, {
    message: 'axeCoreVersion must be a semver string (e.g. "4.10.2")',
  });

export const a11yAcceptanceSchema = z
  .object({
    keyboardWalk: z.array(keyboardWalkEntrySchema).min(1).optional(),
    announcements: z.array(announcementEntrySchema).min(1).optional(),
    axeRules: z.array(axeRuleId).min(1).optional(),
    axeCoreVersion: axeCoreVersion.optional(),
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
  )
  .refine(
    (v) => v.axeCoreVersion === undefined || v.axeRules !== undefined,
    {
      message: 'axeCoreVersion is only meaningful when axeRules is declared',
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

export const changelogEntrySchema = z
  .object({
    version: semver,
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'changelog date must be ISO YYYY-MM-DD'),
    summary: z.string().min(1),
  })
  .strict();

export const changelogSchema = z
  .array(changelogEntrySchema)
  .min(1)
  .refine(
    (entries) => new Set(entries.map((e) => e.version)).size === entries.length,
    { message: 'changelog versions must be unique' },
  );

export const compositionEntrySchema = z
  .object({
    componentId: slug,
    role: z.string().min(1),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const patternDecisionSchema = z
  .object({
    question: z.string().min(1),
    answer: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const frameworkSkeletonsSchema = z
  .object({
    webComponents: z.string().min(1),
    react: z.string().min(1),
    vue: z.string().min(1),
    angularSignals: z.string().min(1),
  })
  .strict();

export const contractSourceSchema = z.enum([
  'apg',
  'wcag',
  'html-spec',
  'platform',
  'canon',
]);

const SOURCE_REF_PATTERNS: Record<string, RegExp> = {
  apg: /^(APG: |WAI-ARIA)/,
  wcag: /^WCAG \d\.\d\.\d/,
  'html-spec': /\b(HTML|WHATWG|DOM)\b/,
};

// P5-34 / ADR-028 phase-2: sources[] entries can be either bare URL strings
// (back-compat with phase-1; suitable for spec/MDN/WCAG/APG references) or
// structured objects pinning a library key to a verifiedAt date.
export const sourceEntrySchema = z.union([
  z.string().min(1),
  z
    .object({
      url: z.string().url('source.url must be an http(s) URL'),
      library: z.enum(LIBRARY_KEYS).optional(),
      verifiedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'source.verifiedAt must be ISO YYYY-MM-DD')
        .optional(),
    })
    .strict()
    .refine(
      (v) =>
        (v.library === undefined && v.verifiedAt === undefined) ||
        (v.library !== undefined && v.verifiedAt !== undefined),
      {
        message:
          'source.library and source.verifiedAt are paired — declare both or neither.',
      },
    ),
]);

export const nonNegotiableContractSchema = z
  .object({
    rule: z.string().min(1),
    source: contractSourceSchema,
    sourceRef: z.string().min(1).optional(),
    consequence: z.string().min(1),
  })
  .strict()
  .refine(
    (v) => {
      if (v.sourceRef === undefined) return true;
      const pattern = SOURCE_REF_PATTERNS[v.source];
      if (!pattern) return true; // platform | canon: free-form
      return pattern.test(v.sourceRef);
    },
    {
      path: ['sourceRef'],
      message:
        'sourceRef shape must match source: apg → "APG: …", wcag → "WCAG N.N.N …", html-spec → contains "HTML"/"WHATWG"/"DOM" (platform / canon free-form).',
    },
  );

export const vocabularyDriftEntrySchema = z
  .object({
    system: z.string().min(1),
    theirTerm: z.string().min(1),
    note: z.string().min(1).optional(),
  })
  .strict();

export const contractsSchema = z
  .object({
    nonNegotiable: z.array(nonNegotiableContractSchema).min(1).optional(),
    vocabularyDrift: z.array(vocabularyDriftEntrySchema).min(1).optional(),
  })
  .strict()
  .refine(
    (v) => v.nonNegotiable !== undefined || v.vocabularyDrift !== undefined,
    {
      message:
        'contracts must declare at least one of nonNegotiable, vocabularyDrift',
    },
  );

export const patternSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    description: z.string().min(1),
    composition: z.array(compositionEntrySchema).min(2),
    whenToUse: z
      .object({
        use: z.string().min(1),
        avoid: z.string().min(1),
      })
      .strict(),
    decisions: z.array(patternDecisionSchema).min(1),
    mistakes: z.array(mistakeSchema).min(3),
    frameworkSkeletons: frameworkSkeletonsSchema,
    contracts: contractsSchema.optional(),
    notes: z.string().min(1).optional(),
    lastReviewed: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'lastReviewed must be ISO YYYY-MM-DD'),
  })
  .strict();

export const componentSchema = z.object({
  id: slug,
  name: z.string().min(1),
  description: z.string().min(1),
  intro: z
    .string()
    .min(200, 'intro must be at least 200 chars when present')
    .max(800, 'intro must be at most 800 chars')
    .optional(),
  alternateNames: z.array(z.string().min(1)).min(1).optional(),
  whenToUse: whenToUseSchema.optional(),
  notes: z.string().optional(),
  lastReviewed: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'lastReviewed must be ISO YYYY-MM-DD')
    .optional(),
  sources: z.array(sourceEntrySchema).optional(),
  since: semver.optional(),
  changelog: changelogSchema.optional(),
  anatomy: z.array(anatomySlotSchema).min(1),
  axes: axesSchema,
  mismatches: z.array(mismatchSchema).min(1),
  mistakes: z.array(mistakeSchema).min(1),
  frameworkMap: frameworkMapSchema,
  motion: motionSchema.optional(),
  responsive: responsiveSchema.optional(),
  events: z.array(eventSchema).min(1).optional(),
  eventsRationale: z
    .string()
    .min(50, 'eventsRationale must be at least 50 chars when present')
    .max(400, 'eventsRationale must be at most 400 chars')
    .optional(),
  a11yAcceptance: a11yAcceptanceSchema.optional(),
  propertyMap: propertyMapSchema.optional(),
  formIntegration: formIntegrationSchema.optional(),
  i18n: i18nSchema.optional(),
  performance: performanceSchema.optional(),
  contracts: contractsSchema.optional(),
});

export type LayoutHint = z.infer<typeof layoutHintSchema>;
export type FloatingHint = z.infer<typeof floatingHintSchema>;
export type AnatomySlot = z.infer<typeof anatomySlotSchema>;
export type SlotKind = z.infer<typeof slotKindSchema>;
export type SlotTokens = z.infer<typeof slotTokensSchema>;
export type Property = z.infer<typeof propertySchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type States = z.infer<typeof statesSchema>;
export type Axes = z.infer<typeof axesSchema>;
export type Mismatch = z.infer<typeof mismatchSchema>;
export type Mistake = z.infer<typeof mistakeSchema>;
export type MistakeSeverity = z.infer<typeof mistakeSeveritySchema>;
export type Contracts = z.infer<typeof contractsSchema>;
export type NonNegotiableContract = z.infer<typeof nonNegotiableContractSchema>;
export type VocabularyDriftEntry = z.infer<typeof vocabularyDriftEntrySchema>;
export type ContractSource = z.infer<typeof contractSourceSchema>;
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
export type PropertyKind = z.infer<typeof propertyKindSchema>;
export type PropertyMapEntry = z.infer<typeof propertyMapEntrySchema>;
export type PropertyMap = z.infer<typeof propertyMapSchema>;
export type FormIntegration = z.infer<typeof formIntegrationSchema>;
export type I18nRtl = z.infer<typeof i18nRtlSchema>;
export type I18n = z.infer<typeof i18nSchema>;
export type PerformanceThreshold = z.infer<typeof performanceThresholdSchema>;
export type Performance = z.infer<typeof performanceSchema>;
export type Divergence = z.infer<typeof divergenceSchema>;
export type Implementation = z.infer<typeof implementationSchema>;
export type Deprecation = z.infer<typeof deprecationSchema>;
export type VariantDeprecation = z.infer<typeof variantDeprecationSchema>;
export type ChangelogEntry = z.infer<typeof changelogEntrySchema>;
export type Changelog = z.infer<typeof changelogSchema>;
export type Component = z.infer<typeof componentSchema>;
export type CompositionEntry = z.infer<typeof compositionEntrySchema>;
export type PatternDecision = z.infer<typeof patternDecisionSchema>;
export type FrameworkSkeletons = z.infer<typeof frameworkSkeletonsSchema>;
export type Pattern = z.infer<typeof patternSchema>;
