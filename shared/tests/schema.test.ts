import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadComponent, loadComponents, loadImplementation, loadImplementations } from '../src/loader.js';
import {
  anatomySlotSchema,
  axesSchema,
  changelogSchema,
  componentSchema,
  deprecationSchema,
  implementationSchema,
  patternSchema,
  propertySchema,
} from '../src/schema.js';
import { loadPatterns } from '../src/loader.js';
import { renderAnatomySVG, renderCompositionSVG, validateOverride } from '../src/svg.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');
const implementationsDir = join(here, '..', '..', 'implementations');
const patternsDir = join(here, '..', '..', 'content', 'patterns');

describe('component schema', () => {
  it('parses card.yaml', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    expect(card.id).toBe('card');
    expect(card.name).toBe('Card');
    expect(card.anatomy.length).toBeGreaterThan(0);
    expect(card.axes.variants.map((v) => v.name)).toContain('elevated');
  });

  it('loadComponents returns a map keyed by id', async () => {
    const map = await loadComponents({ contentDir });
    expect(map.has('card')).toBe(true);
  });

  it('rejects malformed components with Zod error', () => {
    const bad = {
      id: 'Bad ID',
      name: '',
      description: 'x',
      anatomy: [],
      axes: { variants: [], properties: [], states: { interactive: [], data: [] } },
      mismatches: [],
      mistakes: [],
      frameworkMap: {},
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('property type discriminated union', () => {
  it('parses primitive arm', () => {
    const result = propertySchema.safeParse({
      name: 'iconOnly',
      kind: 'primitive',
      of: 'boolean',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('primitive');
    }
  });

  it('parses enum arm with multiple values', () => {
    const result = propertySchema.safeParse({
      name: 'size',
      kind: 'enum',
      values: ['sm', 'md', 'lg'],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === 'enum') {
      expect(result.data.values).toEqual(['sm', 'md', 'lg']);
    }
  });

  it('rejects entry missing the kind discriminator', () => {
    const result = propertySchema.safeParse({
      name: 'orientation',
      values: ['horizontal', 'vertical'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects enum with fewer than two values', () => {
    const result = propertySchema.safeParse({
      name: 'mode',
      kind: 'enum',
      values: ['only'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects enum with an empty-string value', () => {
    const result = propertySchema.safeParse({
      name: 'mode',
      kind: 'enum',
      values: ['valid', ''],
    });
    expect(result.success).toBe(false);
  });

  it('rejects enum with duplicate values', () => {
    const result = propertySchema.safeParse({
      name: 'mode',
      kind: 'enum',
      values: ['a', 'a', 'b'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown kind discriminator', () => {
    const result = propertySchema.safeParse({
      name: 'mode',
      kind: 'union',
      values: ['a', 'b'],
    });
    expect(result.success).toBe(false);
  });
});

describe('motion field', () => {
  it('parses modal.yaml motion block', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    expect(modal.motion?.durations.open).toBe('motion.duration.base');
    expect(modal.motion?.durations.close).toBe('motion.duration.fast');
    expect(modal.motion?.durations.backdrop).toBe('motion.duration.fast');
    expect(modal.motion?.easing).toBe('motion.easing.standard');
    expect(modal.motion?.reducedMotionFallback).toBe('instant');
  });

  it('parses tabs.yaml indicator-only motion', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    expect(tabs.motion?.durations.indicator).toBe('motion.duration.fast');
    expect(tabs.motion?.reducedMotionFallback).toBe('instant');
  });

  it('omits motion on components without transition vocabulary', async () => {
    const link = await loadComponent(join(contentDir, 'link.yaml'));
    expect(link.motion).toBeUndefined();
  });

  it('rejects raw millisecond strings as duration values', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      motion: {
        durations: { open: '200ms' },
        easing: 'motion.easing.standard',
        reducedMotionFallback: 'instant',
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty durations map', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      motion: {
        durations: {},
        easing: 'motion.easing.standard',
        reducedMotionFallback: 'instant',
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown reducedMotionFallback values', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      motion: {
        durations: { open: 'motion.duration.base' },
        easing: 'motion.easing.standard',
        reducedMotionFallback: 'off',
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('responsive field', () => {
  it('parses modal.yaml responsive block', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    expect(modal.responsive?.breakpoints.length).toBeGreaterThanOrEqual(1);
    expect(modal.responsive?.breakpoints[0].at).toBe('breakpoint.sm');
    expect(modal.responsive?.breakpoints[0].change.length).toBeGreaterThan(0);
  });

  it('parses tabs.yaml responsive block', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const ats = tabs.responsive?.breakpoints.map((b) => b.at) ?? [];
    expect(ats).toContain('breakpoint.sm');
    expect(ats).toContain('breakpoint.lg');
  });

  it('omits responsive on Button', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(button.responsive).toBeUndefined();
  });

  it('rejects raw px strings as breakpoint values', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      responsive: {
        breakpoints: [{ at: '640px', change: 'goes fullscreen' }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty breakpoints array', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      responsive: { breakpoints: [] },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects breakpoint entries with empty change prose', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      responsive: {
        breakpoints: [{ at: 'breakpoint.sm', change: '' }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('performance field', () => {
  it('parses combobox performance with two thresholds', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    expect(combobox.performance?.length).toBe(2);
    const names = combobox.performance?.map((p) => p.name) ?? [];
    expect(names).toEqual(['virtualisedListbox', 'asyncFilterDebounce']);
  });

  it('parses tabs performance', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    expect(tabs.performance?.find((p) => p.name === 'tablistOverflow')?.threshold).toBe(7);
  });

  it('modal performance covers focus-trap + inert + backdrop costs (P6-88); stackDepth still lives in whenToUse.avoid as a hard rule', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    expect(modal.performance).toBeDefined();
    const names = modal.performance!.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['focusTrapAttachLatency', 'inertSubtreeSize', 'backdropOverdraw']),
    );
    expect(modal.whenToUse?.avoid).toMatch(/Stacking modals is non-canonical/);
  });

  it('omits performance on Button (primitive)', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(button.performance).toBeUndefined();
  });

  it('rejects performance with non-camelCase name', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const bad = {
      ...combobox,
      performance: [
        { name: 'Bad-Name', metric: 'x', threshold: 1, unit: 'x', rationale: 'x' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects performance with non-positive threshold', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const bad = {
      ...combobox,
      performance: [
        { name: 'foo', metric: 'x', threshold: 0, unit: 'x', rationale: 'x' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty performance array', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const bad = { ...combobox, performance: [] };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra field on threshold (strict)', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const bad = {
      ...combobox,
      performance: [
        {
          name: 'foo',
          metric: 'x',
          threshold: 1,
          unit: 'x',
          rationale: 'x',
          somethingElse: 'extra',
        },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('i18n field', () => {
  it('parses i18n on all five components', async () => {
    const ids = ['button', 'card', 'modal', 'tabs', 'combobox'];
    for (const id of ids) {
      const c = await loadComponent(join(contentDir, `${id}.yaml`));
      expect(c.i18n?.rtl?.mirroring?.length ?? 0).toBeGreaterThan(0);
      expect(c.i18n?.textExpansion?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('rejects i18n missing rtl', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, i18n: { textExpansion: 'real prose' } };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects i18n missing textExpansion', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, i18n: { rtl: { mirroring: 'real prose' } } };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty rtl.mirroring', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, i18n: { rtl: { mirroring: '' }, textExpansion: 'x' } };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty textExpansion', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, i18n: { rtl: { mirroring: 'x' }, textExpansion: '' } };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra field on rtl (strict)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      i18n: { rtl: { mirroring: 'x', numerals: 'extra' }, textExpansion: 'x' },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('formIntegration field', () => {
  it('parses button formIntegration with all four prose fields', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(button.formIntegration?.name?.length ?? 0).toBeGreaterThan(0);
    expect(button.formIntegration?.formData?.length ?? 0).toBeGreaterThan(0);
    expect(button.formIntegration?.reset?.length ?? 0).toBeGreaterThan(0);
    expect(button.formIntegration?.validation?.length ?? 0).toBeGreaterThan(0);
  });

  it('parses modal formIntegration as a container surface', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    expect(modal.formIntegration?.name).toMatch(/container/i);
    expect(modal.formIntegration?.validation).toMatch(/focus trap/i);
  });

  it('parses combobox formIntegration with strict-mode validation prose', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    expect(combobox.formIntegration?.validation).toMatch(/setCustomValidity/);
  });

  it('omits formIntegration on Card and Tabs', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    expect(card.formIntegration).toBeUndefined();
    expect(tabs.formIntegration).toBeUndefined();
  });

  it('rejects formIntegration with no fields declared', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const bad = { ...button, formIntegration: {} };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty validation prose when present', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const bad = { ...button, formIntegration: { validation: '' } };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra field on formIntegration (strict)', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const bad = {
      ...button,
      formIntegration: { name: 'x', somethingElse: 'extra' },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('propertyMap field', () => {
  it('parses button propertyMap with mixed kinds', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const kinds = new Set(button.propertyMap?.map((p) => p.kind));
    expect(kinds.has('enum')).toBe(true);
    expect(kinds.has('boolean')).toBe(true);
    expect(kinds.has('text')).toBe(true);
    expect(kinds.has('slot')).toBe(true);
  });

  it('all five components declare propertyMap', async () => {
    const ids = ['button', 'card', 'modal', 'tabs', 'combobox'];
    for (const id of ids) {
      const c = await loadComponent(join(contentDir, `${id}.yaml`));
      expect((c.propertyMap?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it('rejects entry with unknown kind', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      propertyMap: [
        { figma: 'Variant', code: 'variant', kind: 'instance-swap' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects entry with legacy Figma vocabulary', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      propertyMap: [
        { figma: 'Variant', code: 'variant', kind: 'Variant' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty figma name', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      propertyMap: [
        { figma: '', code: 'variant', kind: 'enum' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty code name', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      propertyMap: [
        { figma: 'Variant', code: '', kind: 'enum' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty propertyMap array', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, propertyMap: [] };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra field on entry (strict)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      propertyMap: [
        { figma: 'Variant', code: 'variant', kind: 'enum', somethingElse: 'x' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts the new "number" kind (forward-coverage from ADR-025)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      propertyMap: [
        { figma: 'Step Count', code: 'count', kind: 'number' },
      ],
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });
});

describe('a11yAcceptance field', () => {
  it('parses modal a11yAcceptance with all three sub-arrays', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    expect(modal.a11yAcceptance?.keyboardWalk?.length).toBeGreaterThan(0);
    expect(modal.a11yAcceptance?.announcements?.length).toBeGreaterThan(0);
    expect(modal.a11yAcceptance?.axeRules).toContain('aria-dialog-name');
  });

  it('parses combobox a11yAcceptance with five keyboard walk entries', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    expect(combobox.a11yAcceptance?.keyboardWalk?.length).toBe(5);
  });

  it('all five components declare at least axeRules', async () => {
    const ids = ['button', 'card', 'modal', 'tabs', 'combobox'];
    for (const id of ids) {
      const c = await loadComponent(join(contentDir, `${id}.yaml`));
      expect(c.a11yAcceptance?.axeRules?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('rejects axe rule id that is not kebab-case', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      a11yAcceptance: {
        axeRules: ['Color_Contrast'],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a11yAcceptance with no sub-arrays declared', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      a11yAcceptance: {},
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects keyboardWalk entry with empty expected', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      a11yAcceptance: {
        keyboardWalk: [{ keys: 'Tab', expected: '' }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty axeRules array', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      a11yAcceptance: { axeRules: [] },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('implementation schema', () => {
  it('parses radix/modal.yaml', async () => {
    const impl = await loadImplementation(join(implementationsDir, 'radix', 'modal.yaml'));
    expect(impl.componentId).toBe('modal');
    expect(impl.libraryId).toBe('radix');
    expect(impl.componentName).toBe('Dialog');
    expect((impl.divergence ?? []).length).toBeGreaterThan(0);
  });

  it('radix/modal covers all four divergence types', async () => {
    const impl = await loadImplementation(join(implementationsDir, 'radix', 'modal.yaml'));
    const types = new Set((impl.divergence ?? []).map((d) => d.type));
    expect(types.has('omitted')).toBe(true);
    expect(types.has('renamed')).toBe(true);
    expect(types.has('extended') || types.has('reshaped')).toBe(true);
    expect(types.has('reshaped')).toBe(true);
  });

  it('loadImplementations groups by libraryId', async () => {
    const byLibrary = await loadImplementations({ implementationsDir });
    expect(byLibrary.has('radix')).toBe(true);
    const radix = byLibrary.get('radix')!;
    expect(radix.has('modal')).toBe(true);
  });

  it('rejects implementation missing lastReviewed', () => {
    const bad = {
      componentId: 'modal',
      libraryId: 'radix',
      componentName: 'Dialog',
    };
    const result = implementationSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects divergence with unknown type', () => {
    const bad = {
      componentId: 'modal',
      libraryId: 'radix',
      componentName: 'Dialog',
      lastReviewed: '2026-04-29',
      divergence: [
        { from: 'anatomy[backdrop]', type: 'mutated', rationale: 'whatever' },
      ],
    };
    const result = implementationSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects renamed divergence missing the `to` payload', () => {
    const bad = {
      componentId: 'modal',
      libraryId: 'radix',
      componentName: 'Dialog',
      lastReviewed: '2026-04-29',
      divergence: [
        { from: 'anatomy[backdrop]', type: 'renamed', rationale: 'no target named' },
      ],
    };
    const result = implementationSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects from path that does not match the canonical-ref regex', () => {
    const bad = {
      componentId: 'modal',
      libraryId: 'radix',
      componentName: 'Dialog',
      lastReviewed: '2026-04-29',
      divergence: [
        { from: 'NOT A PATH', type: 'omitted', rationale: 'whatever' },
      ],
    };
    const result = implementationSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level field (strict)', () => {
    const bad = {
      componentId: 'modal',
      libraryId: 'radix',
      componentName: 'Dialog',
      lastReviewed: '2026-04-29',
      somethingElse: 'extra',
    };
    const result = implementationSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('whenToUse field', () => {
  it('parses card whenToUse with use/avoid/vsRelated', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    expect(card.whenToUse?.use.length).toBeGreaterThan(0);
    expect(card.whenToUse?.avoid.length).toBeGreaterThan(0);
    const ids = card.whenToUse?.vsRelated?.map((v) => v.id) ?? [];
    expect(ids).toEqual(['tile', 'list-item', 'table']);
  });

  it('parses combobox whenToUse vsRelated entries (post P6-86 backfill)', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const ids = combobox.whenToUse?.vsRelated?.map((v) => v.id) ?? [];
    expect(ids).toEqual(['select', 'search-input', 'tag-input', 'text-input', 'checkbox', 'textarea', 'grid-pattern']);
    for (const v of combobox.whenToUse?.vsRelated ?? []) {
      expect(v.difference.length).toBeGreaterThan(0);
    }
  });

  it('rejects whenToUse with empty use prose', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      whenToUse: {
        use: '',
        avoid: 'real prose',
        vsRelated: [{ id: 'tile', difference: 'real prose' }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects whenToUse with empty avoid prose', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      whenToUse: {
        use: 'real prose',
        avoid: '',
        vsRelated: [{ id: 'tile', difference: 'real prose' }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects vsRelated entry with non-slug id', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      whenToUse: {
        use: 'x',
        avoid: 'y',
        vsRelated: [{ id: 'Tile_Bad', difference: 'real prose' }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty vsRelated array when present', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      whenToUse: { use: 'x', avoid: 'y', vsRelated: [] },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('parses whenToUse without vsRelated (optional)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      whenToUse: { use: 'x', avoid: 'y' },
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('accepts vsRelated entry with `pending: true` for forward-references (P6-133)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      whenToUse: {
        use: 'x',
        avoid: 'y',
        vsRelated: [{ id: 'future-component', difference: 'placeholder prose', pending: true }],
      },
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('rejects vsRelated entry with non-boolean `pending`', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      whenToUse: {
        use: 'x',
        avoid: 'y',
        vsRelated: [{ id: 'tile', difference: 'real prose', pending: 'true' as unknown as boolean }],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('staleAfter field (P6-125)', () => {
  it('accepts a positive integer staleAfter', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = { ...card, staleAfter: 180 };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('rejects zero or negative staleAfter', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    for (const v of [0, -1, -90]) {
      const bad = { ...card, staleAfter: v };
      const result = componentSchema.safeParse(bad);
      expect(result.success).toBe(false);
    }
  });

  it('rejects non-integer staleAfter', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, staleAfter: 90.5 };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('parses components without staleAfter (optional, default policy 90 applies at MCP layer)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    expect(card.staleAfter).toBeUndefined();
  });
});

describe('events field', () => {
  it('parses modal.yaml events block', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const names = modal.events?.map((e) => e.name) ?? [];
    expect(names).toContain('openChange');
    expect(names).toContain('dismiss');
    const openChange = modal.events?.find((e) => e.name === 'openChange');
    expect(openChange?.frameworkNotes.react.length).toBeGreaterThan(0);
    expect(openChange?.frameworkNotes.webComponents.length).toBeGreaterThan(0);
  });

  it('parses tabs.yaml events block', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const names = tabs.events?.map((e) => e.name) ?? [];
    expect(names).toEqual(['selectedChange', 'tabActivate']);
  });

  it('parses combobox.yaml events block with three entries', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    expect(combobox.events?.length).toBe(3);
    const names = combobox.events?.map((e) => e.name) ?? [];
    expect(names).toContain('inputChange');
    expect(names).toContain('selectionChange');
    expect(names).toContain('openChange');
  });

  it('omits events on Link (primitive)', async () => {
    const link = await loadComponent(join(contentDir, 'link.yaml'));
    expect(link.events).toBeUndefined();
  });

  it('rejects empty events array', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = { ...modal, events: [] };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects event whose name is not camelCase', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      events: [
        {
          name: 'open-change',
          payload: 'whatever',
          frameworkNotes: {
            webComponents: 'x',
            react: 'x',
            angularSignals: 'x',
            vue: 'x',
          },
        },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects event missing a frameworkNotes key', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      events: [
        {
          name: 'openChange',
          payload: 'whatever',
          frameworkNotes: {
            webComponents: 'x',
            react: 'x',
            angularSignals: 'x',
          },
        },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('state transitions', () => {
  it('parses modal transitions and references valid states', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const transitions = modal.axes.states.transitions ?? [];
    expect(transitions.length).toBe(4);
    expect(transitions[0]).toMatchObject({ from: 'closed', to: 'opening' });
    const declared = new Set([
      ...modal.axes.states.interactive,
      ...modal.axes.states.data,
    ]);
    for (const t of transitions) {
      expect(declared.has(t.from)).toBe(true);
      expect(declared.has(t.to)).toBe(true);
    }
  });

  it('parses combobox transitions including async branches', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const transitions = combobox.axes.states.transitions ?? [];
    const edges = transitions.map((t) => `${t.from}→${t.to}`);
    expect(edges).toContain('closed→open');
    expect(edges).toContain('open→busy');
    expect(edges).toContain('busy→open');
    expect(edges).toContain('open→invalid');
  });

  it('omits transitions on Card/Button/Link (trivial graphs)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const link = await loadComponent(join(contentDir, 'link.yaml'));
    expect(card.axes.states.transitions).toBeUndefined();
    expect(button.axes.states.transitions).toBeUndefined();
    expect(link.axes.states.transitions).toBeUndefined();
  });

  it('parses tabs transitions for the panel-load lifecycle', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const transitions = tabs.axes.states.transitions ?? [];
    const edges = transitions.map((t) => `${t.from}→${t.to}`);
    expect(edges).toContain('lazy→busy');
    expect(edges).toContain('busy→selected');
    expect(edges).toContain('busy→error');
  });

  it('rejects transitions whose from references an unknown state', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      axes: {
        ...modal.axes,
        states: {
          ...modal.axes.states,
          transitions: [{ from: 'openning', to: 'open', trigger: 'typo' }],
        },
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects transitions whose to references an unknown state', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      axes: {
        ...modal.axes,
        states: {
          ...modal.axes.states,
          transitions: [{ from: 'closed', to: 'phantom', trigger: 'whatever' }],
        },
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects transitions with empty trigger prose', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const bad = {
      ...modal,
      axes: {
        ...modal.axes,
        states: {
          ...modal.axes.states,
          transitions: [{ from: 'closed', to: 'opening', trigger: '' }],
        },
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

function extractSlotRect(svg: string, slotId: string): { x: number; y: number; w: number; h: number } | null {
  const groupRegex = new RegExp(`<g id="slot-${slotId}"[^>]*>([\\s\\S]*?)<\\/g>`);
  const match = groupRegex.exec(svg);
  if (!match) return null;
  const rectMatch = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(match[1]!);
  if (!rectMatch) return null;
  return {
    x: parseFloat(rectMatch[1]!),
    y: parseFloat(rectMatch[2]!),
    w: parseFloat(rectMatch[3]!),
    h: parseFloat(rectMatch[4]!),
  };
}

function extractFirstLabelY(svg: string, slotId: string): number | null {
  const groupRegex = new RegExp(`<g id="slot-${slotId}"[^>]*>([\\s\\S]*?)<\\/g>`);
  const match = groupRegex.exec(svg);
  if (!match) return null;
  const labelMatch = /<text class="anatomy-label label-figma"[^>]*\sy="([\d.]+)"/.exec(match[1]!);
  return labelMatch ? parseFloat(labelMatch[1]!) : null;
}

describe('anatomy SVG layout invariants', () => {
  // P6-144 — guard against negative-width rect emit (browser console-error,
  // failed Lighthouse Best Practices). Triggered originally by indicator
  // slots parented inside already-1-col-wide input slots (Checkbox /
  // RadioGroup / Switch); the layoutGrid colWidth went negative.
  it('emits no negative-width rects across all canonical components', async () => {
    const map = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const [id, component] of map) {
      const svg = renderAnatomySVG(component);
      for (const m of svg.matchAll(/<rect[^>]*\bwidth="(-?\d+(?:\.\d+)?)"/g)) {
        const w = parseFloat(m[1]!);
        if (w < 0) failures.push(`${id}: width="${m[1]}"`);
      }
      for (const m of svg.matchAll(/<rect[^>]*\bheight="(-?\d+(?:\.\d+)?)"/g)) {
        const h = parseFloat(m[1]!);
        if (h < 0) failures.push(`${id}: height="${m[1]}"`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('Tabs indicator does not vertically overlap tabpanel', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const svg = renderAnatomySVG(tabs);
    const indicator = extractSlotRect(svg, 'indicator');
    const tabpanel = extractSlotRect(svg, 'tabpanel');
    expect(indicator).not.toBeNull();
    expect(tabpanel).not.toBeNull();
    expect(indicator!.y + indicator!.h).toBeLessThanOrEqual(tabpanel!.y);
  });

  it('Modal container label sits above its child body slot', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const svg = renderAnatomySVG(modal);
    const labelY = extractFirstLabelY(svg, 'container');
    const body = extractSlotRect(svg, 'body');
    expect(labelY).not.toBeNull();
    expect(body).not.toBeNull();
    expect(labelY!).toBeLessThan(body!.y);
  });

  it('Modal header label sits above its child title slot', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const svg = renderAnatomySVG(modal);
    const labelY = extractFirstLabelY(svg, 'header');
    const title = extractSlotRect(svg, 'title');
    expect(labelY).not.toBeNull();
    expect(title).not.toBeNull();
    expect(labelY!).toBeLessThan(title!.y);
  });

  it('Combobox listbox label sits above its option children', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const svg = renderAnatomySVG(combobox);
    const labelY = extractFirstLabelY(svg, 'listbox');
    const option = extractSlotRect(svg, 'option');
    expect(labelY).not.toBeNull();
    expect(option).not.toBeNull();
    expect(labelY!).toBeLessThan(option!.y);
  });
});

describe('anatomy SVG generator', () => {
  it('emits a slot group per anatomy entry', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const svg = renderAnatomySVG(card);
    for (const slot of card.anatomy) {
      expect(svg).toContain(`id="slot-${slot.id}"`);
    }
    expect(svg).toContain('<svg');
  });

  it('uses dashed stroke for optional slots', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const svg = renderAnatomySVG(card);
    const optional = card.anatomy.filter((s) => !s.required);
    expect(optional.length).toBeGreaterThan(0);
    expect(svg).toMatch(/stroke-dasharray="6 4"/);
  });

  it('emits all three view labels per slot', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const svg = renderAnatomySVG(card);
    const figmaCount = (svg.match(/class="anatomy-label label-figma"/g) ?? []).length;
    const codeCount = (svg.match(/class="anatomy-label label-code"/g) ?? []).length;
    const bridgeCount = (svg.match(/class="anatomy-label label-bridge"/g) ?? []).length;
    expect(figmaCount).toBeGreaterThanOrEqual(card.anatomy.length);
    expect(codeCount).toBeGreaterThanOrEqual(card.anatomy.length);
    expect(bridgeCount).toBeGreaterThanOrEqual(card.anatomy.length);
  });

  it('renders Modal overlay slot at canvas dimensions', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const svg = renderAnatomySVG(modal);
    expect(svg).toMatch(/class="[^"]*\banatomy-overlay\b[^"]*"/);
    expect(svg).toContain('id="slot-backdrop"');
  });

  it('renders Tabs tab repeats and indicator floating connector', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const svg = renderAnatomySVG(tabs);
    expect(svg).toContain('id="slot-tab"');
    const ghosts = (svg.match(/anatomy-repeat-ghost/g) ?? []).length;
    expect(ghosts).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('anatomy-floating-connector');
  });

  it('renders Combobox listbox floating below input with options nested', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const svg = renderAnatomySVG(combobox);
    expect(svg).toContain('id="slot-listbox"');
    expect(svg).toContain('id="slot-option"');
    expect(svg).toContain('anatomy-floating-connector');
    const optionGhosts = (svg.match(/anatomy-repeat-ghost/g) ?? []).length;
    expect(optionGhosts).toBeGreaterThanOrEqual(2);
  });

  it('marks floating slots with the floating class and a "z" badge', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const svg = renderAnatomySVG(combobox);
    expect(svg).toMatch(/class="[^"]*\banatomy-floating\b[^"]*"/);
    expect(svg).toContain('anatomy-z-badge');
    expect(svg).toMatch(/<text [^>]*>z<\/text>/);
  });

  it('annotates repeated slots with an "n×" count badge', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const svg = renderAnatomySVG(combobox);
    expect(svg).toContain('anatomy-repeat-count');
    expect(svg).toMatch(/>3×</);
  });

  it('validates override slot ids against YAML anatomy', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const goodOverride = card.anatomy.map((s) => `<g id="slot-${s.id}"></g>`).join('');
    const badOverride = `<g id="slot-not-real"></g>`;
    expect(validateOverride(goodOverride, card).ok).toBe(true);
    expect(validateOverride(badOverride, card).ok).toBe(false);
  });

  it('emits anatomy-depth-N classes per slot nesting level', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const svg = renderAnatomySVG(modal);
    expect(svg).toMatch(/data-slot="container"[^>]*class="[^"]*anatomy-depth-0/);
    expect(svg).toMatch(/data-slot="header"[^>]*class="[^"]*anatomy-depth-1/);
    expect(svg).toMatch(/data-slot="title"[^>]*class="[^"]*anatomy-depth-2/);
  });

  it('emits anatomy-kind-X class for slots with slotKind', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const svg = renderAnatomySVG(modal);
    expect(svg).toMatch(/data-slot="title"[^>]*class="[^"]*anatomy-kind-content/);
    expect(svg).toMatch(/data-slot="close-button"[^>]*class="[^"]*anatomy-kind-interactive/);
    expect(svg).toMatch(/data-slot="container"[^>]*class="[^"]*anatomy-kind-structural/);
    expect(svg).toMatch(/data-slot="backdrop"[^>]*class="[^"]*anatomy-kind-decorative/);
  });

  it('emits <title> with slot purpose for primary slot groups', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const svg = renderAnatomySVG(modal);
    const titleSlot = modal.anatomy.find((s) => s.id === 'title')!;
    const expected = titleSlot.purpose.replace(/\s+/g, ' ').trim();
    const titleRegex = new RegExp(
      `data-slot="title"[\\s\\S]*?<title>([^<]*)</title>`,
    );
    const match = titleRegex.exec(svg);
    expect(match).not.toBeNull();
    expect(match![1]!.replace(/\s+/g, ' ').trim()).toBe(expected);
  });

  it('emits anatomy-indicator-tokens only for slots with non-empty tokens', async () => {
    const popover = await loadComponent(join(contentDir, 'popover.yaml'));
    const svg = renderAnatomySVG(popover);
    // container has tokens → indicator
    const containerSection = /<g[^>]*data-slot="container"[\s\S]*?(?=<g[^>]*data-slot=)/.exec(svg);
    expect(containerSection).not.toBeNull();
    expect(containerSection![0]).toContain('anatomy-indicator-tokens');
    // trigger has no tokens → no indicator
    const triggerSection = /<g[^>]*data-slot="trigger"[\s\S]*?(?=<g[^>]*data-slot=|<\/svg>)/.exec(svg);
    expect(triggerSection).not.toBeNull();
    expect(triggerSection![0]).not.toContain('anatomy-indicator-tokens');
  });
});

describe('slotKind schema', () => {
  it('accepts a slot with each legal slotKind value', () => {
    const slotBase = {
      id: 'x',
      required: true,
      purpose: 'p',
      layout: { row: 1 },
      figma: { type: 'frame', hint: 'h' },
      code: { slot: 'x', semantic: 'div' },
      a11y: { hint: 'h' },
    };
    for (const kind of ['structural', 'interactive', 'content', 'decorative']) {
      const result = componentSchema.shape.anatomy.element.safeParse({
        ...slotBase,
        slotKind: kind,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts a slot without slotKind (optional)', () => {
    const result = componentSchema.shape.anatomy.element.safeParse({
      id: 'x',
      required: true,
      purpose: 'p',
      layout: { row: 1 },
      figma: { type: 'frame', hint: 'h' },
      code: { slot: 'x', semantic: 'div' },
      a11y: { hint: 'h' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid slotKind value', () => {
    const result = componentSchema.shape.anatomy.element.safeParse({
      id: 'x',
      required: true,
      purpose: 'p',
      slotKind: 'wibble',
      layout: { row: 1 },
      figma: { type: 'frame', hint: 'h' },
      code: { slot: 'x', semantic: 'div' },
      a11y: { hint: 'h' },
    });
    expect(result.success).toBe(false);
  });
});

describe('versioning', () => {
  const slotBase = {
    id: 'body',
    required: true,
    purpose: 'Main content area',
    layout: { row: 1 },
    figma: { type: 'frame', hint: 'h' },
    code: { slot: 'body', semantic: 'div' },
    a11y: { hint: 'h' },
  };

  it('parses a slot with since + deprecated', () => {
    const result = anatomySlotSchema.safeParse({
      ...slotBase,
      since: '1.0.0',
      deprecated: {
        since: '2.0.0',
        reason: 'Use header instead',
        replacement: 'header',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-semver since on slot', () => {
    const result = anatomySlotSchema.safeParse({ ...slotBase, since: 'v1' });
    expect(result.success).toBe(false);
  });

  it('rejects deprecation missing reason', () => {
    const result = deprecationSchema.safeParse({ since: '1.0.0' });
    expect(result.success).toBe(false);
  });

  it('rejects deprecation with unknown extra field', () => {
    const result = deprecationSchema.safeParse({
      since: '1.0.0',
      reason: 'old',
      extra: 'no',
    });
    expect(result.success).toBe(false);
  });

  it('parses a property with deprecated', () => {
    const result = propertySchema.safeParse({
      name: 'colour',
      kind: 'enum',
      values: ['red', 'green'],
      since: '1.1.0',
      deprecated: { since: '2.0.0', reason: 'Use tone' },
    });
    expect(result.success).toBe(true);
  });

  it('parses axes with variantDeprecations referencing existing variant', () => {
    const result = axesSchema.safeParse({
      variants: [{ name: 'primary' }, { name: 'secondary' }, { name: 'tertiary' }],
      properties: [],
      states: { interactive: [], data: [] },
      variantDeprecations: [
        {
          name: 'tertiary',
          since: '2.0.0',
          reason: 'Folded into secondary',
          replacement: 'secondary',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects variantDeprecations referencing unknown variant', () => {
    const result = axesSchema.safeParse({
      variants: [{ name: 'primary' }],
      properties: [],
      states: { interactive: [], data: [] },
      variantDeprecations: [
        { name: 'ghost', since: '2.0.0', reason: 'gone' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate variantDeprecations entries', () => {
    const result = axesSchema.safeParse({
      variants: [{ name: 'primary' }],
      properties: [],
      states: { interactive: [], data: [] },
      variantDeprecations: [
        { name: 'primary', since: '2.0.0', reason: 'a' },
        { name: 'primary', since: '3.0.0', reason: 'b' },
      ],
    });
    expect(result.success).toBe(false);
  });

  // P6-127 / ADR-031 — variants reshape to object form with optional alternativeNames
  it('parses variants as object array without alternativeNames', () => {
    const result = axesSchema.safeParse({
      variants: [{ name: 'default' }, { name: 'dot' }],
      properties: [],
      states: { interactive: [], data: [] },
    });
    expect(result.success).toBe(true);
  });

  it('parses variants with alternativeNames populated', () => {
    const result = axesSchema.safeParse({
      variants: [
        { name: 'default' },
        { name: 'error', alternativeNames: ['danger', 'destructive'] },
      ],
      properties: [],
      states: { interactive: [], data: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects bare-string variants (clean break, no string|object union)', () => {
    const result = axesSchema.safeParse({
      variants: ['default', 'dot'],
      properties: [],
      states: { interactive: [], data: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate variant names', () => {
    const result = axesSchema.safeParse({
      variants: [{ name: 'primary' }, { name: 'primary' }],
      properties: [],
      states: { interactive: [], data: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects alternativeNames colliding with another variant name', () => {
    const result = axesSchema.safeParse({
      variants: [
        { name: 'primary' },
        { name: 'destructive' },
        { name: 'error', alternativeNames: ['destructive'] },
      ],
      properties: [],
      states: { interactive: [], data: [] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects alternativeNames duplicating the variant own name', () => {
    const result = axesSchema.safeParse({
      variants: [{ name: 'error', alternativeNames: ['error', 'danger'] }],
      properties: [],
      states: { interactive: [], data: [] },
    });
    expect(result.success).toBe(false);
  });

  it('parses changelog with unique versions', () => {
    const result = changelogSchema.safeParse([
      { version: '2.0.0', date: '2026-05-01', summary: 'Drop tertiary' },
      { version: '1.0.0', date: '2026-01-01', summary: 'Initial release' },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects changelog with duplicate versions', () => {
    const result = changelogSchema.safeParse([
      { version: '1.0.0', date: '2026-01-01', summary: 'a' },
      { version: '1.0.0', date: '2026-02-01', summary: 'b' },
    ]);
    expect(result.success).toBe(false);
  });

  it('rejects changelog entry with non-ISO date', () => {
    const result = changelogSchema.safeParse([
      { version: '1.0.0', date: '01-01-2026', summary: 'a' },
    ]);
    expect(result.success).toBe(false);
  });

  it('parses a component-level since + changelog', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const augmented = {
      ...card,
      since: '1.0.0',
      changelog: [
        { version: '1.0.0', date: '2026-01-01', summary: 'Initial release' },
      ],
    };
    const result = componentSchema.safeParse(augmented);
    expect(result.success).toBe(true);
  });
});

describe('mistake severity', () => {
  it('parses severity on every mistake of every component', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const allowed = new Set(['blocker', 'major', 'minor']);
    for (const m of card.mistakes) expect(allowed.has(m.severity)).toBe(true);
    for (const m of modal.mistakes) expect(allowed.has(m.severity)).toBe(true);
  });

  it('rejects mistake with missing severity', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      mistakes: card.mistakes.map(({ severity, ...rest }) => rest),
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects mistake with unknown severity value', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      mistakes: card.mistakes.map((m, i) => (i === 0 ? { ...m, severity: 'critical' } : m)),
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('modal critical mistakes are blockers (focus-trap, focus-restore, escape, aria-hidden-leak)', async () => {
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    const blockers = modal.mistakes.filter((m) => m.severity === 'blocker').map((m) => m.id);
    expect(blockers).toEqual(
      expect.arrayContaining([
        'modal-no-focus-trap',
        'modal-no-focus-restore',
        'modal-aria-hidden-leak',
        'modal-escape-not-bound',
      ]),
    );
  });
});

describe('contracts field (P6-73)', () => {
  it('parses accordion contracts (nonNegotiable + vocabularyDrift)', async () => {
    const accordion = await loadComponent(join(contentDir, 'accordion.yaml'));
    expect(accordion.contracts?.nonNegotiable?.length).toBeGreaterThanOrEqual(2);
    const rules = accordion.contracts?.nonNegotiable?.map((c) => c.source) ?? [];
    for (const s of rules) expect(s).toBe('apg');
    // P6-171 — vocabularyDrift backfilled
    expect(accordion.contracts?.vocabularyDrift?.length).toBeGreaterThanOrEqual(3);
    const accSystems = accordion.contracts?.vocabularyDrift?.map((v) => v.system) ?? [];
    expect(accSystems).toEqual(expect.arrayContaining(['APG', 'Polaris', 'Material 3']));
  });

  it('parses drawer contracts (nonNegotiable + vocabularyDrift)', async () => {
    const drawer = await loadComponent(join(contentDir, 'drawer.yaml'));
    expect(drawer.contracts?.vocabularyDrift?.length).toBeGreaterThanOrEqual(4);
    const systems = drawer.contracts?.vocabularyDrift?.map((v) => v.system) ?? [];
    expect(systems).toEqual(expect.arrayContaining(['Polaris', 'Carbon', 'Material 3', 'vaul']));
    // P6-170 — nonNegotiable backfilled (focus management / inert-when-modal)
    expect(drawer.contracts?.nonNegotiable?.length).toBeGreaterThanOrEqual(4);
  });

  it('parses toast contracts (vocabularyDrift only)', async () => {
    const toast = await loadComponent(join(contentDir, 'toast.yaml'));
    expect(toast.contracts?.vocabularyDrift?.length).toBeGreaterThanOrEqual(4);
    const systems = toast.contracts?.vocabularyDrift?.map((v) => v.system) ?? [];
    expect(systems).toEqual(expect.arrayContaining(['Material 3', 'Atlassian', 'Polaris', 'Sonner']));
  });

  it('rejects empty contracts (refine: at least one of nonNegotiable / vocabularyDrift)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, contracts: {} };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects unknown source enum', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      contracts: {
        nonNegotiable: [
          { rule: 'r', source: 'best-practice', consequence: 'c' },
        ],
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('accepts all five canonical source values', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    for (const source of ['apg', 'wcag', 'html-spec', 'platform', 'canon']) {
      const ok = {
        ...card,
        contracts: {
          nonNegotiable: [{ rule: 'r', source, consequence: 'c' }],
        },
      };
      const result = componentSchema.safeParse(ok);
      expect(result.success, `source=${source}`).toBe(true);
    }
  });

  it('rejects empty rule / consequence / system / theirTerm', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const cases = [
      { contracts: { nonNegotiable: [{ rule: '', source: 'apg', consequence: 'c' }] } },
      { contracts: { nonNegotiable: [{ rule: 'r', source: 'apg', consequence: '' }] } },
      { contracts: { vocabularyDrift: [{ system: '', theirTerm: 't' }] } },
      { contracts: { vocabularyDrift: [{ system: 's', theirTerm: '' }] } },
    ];
    for (const c of cases) {
      const result = componentSchema.safeParse({ ...card, ...c });
      expect(result.success).toBe(false);
    }
  });

  it('accepts canonical sourceRef shapes per source enum', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const cases = [
      { source: 'apg', sourceRef: 'APG: Dialog (Modal) pattern — Keyboard interaction' },
      { source: 'apg', sourceRef: 'WAI-ARIA aria-current property' },
      { source: 'wcag', sourceRef: 'WCAG 2.4.4 — Link Purpose (In Context)' },
      { source: 'html-spec', sourceRef: 'HTML inert attribute + ARIA dialog-modal pattern' },
      { source: 'html-spec', sourceRef: 'HTML autocomplete attribute (WHATWG) + WCAG 1.3.5' },
      { source: 'platform', sourceRef: 'macOS HIG — Window placement' },
      { source: 'canon', sourceRef: 'GDPR Art. 7 / EDPB Guidelines 05/2020' },
    ];
    for (const c of cases) {
      const ok = {
        ...card,
        contracts: {
          nonNegotiable: [{ rule: 'r', consequence: 'c', ...c }],
        },
      };
      const result = componentSchema.safeParse(ok);
      expect(result.success, `source=${c.source} sourceRef=${c.sourceRef}`).toBe(true);
    }
  });

  it('rejects sourceRef shape that does not match source enum', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const cases = [
      { source: 'apg', sourceRef: 'Just a free-form string' }, // missing APG: / WAI-ARIA prefix
      { source: 'wcag', sourceRef: 'WCAG without numeric section' }, // missing N.N.N
      { source: 'wcag', sourceRef: '2.4.4 — link purpose' }, // missing leading WCAG
      { source: 'html-spec', sourceRef: 'Some prose with no spec word' }, // missing HTML/WHATWG/DOM
    ];
    for (const c of cases) {
      const bad = {
        ...card,
        contracts: {
          nonNegotiable: [{ rule: 'r', consequence: 'c', ...c }],
        },
      };
      const result = componentSchema.safeParse(bad);
      expect(result.success, `source=${c.source} sourceRef=${c.sourceRef}`).toBe(false);
    }
  });
});

describe('sources[] entry shape (P5-34 / ADR-028 phase-2)', () => {
  it('accepts back-compat bare URL strings', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      sources: ['https://www.w3.org/WAI/ARIA/apg/patterns/'],
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('accepts structured source with library + verifiedAt', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      sources: [
        {
          url: 'https://www.radix-ui.com/primitives/docs/components/dialog',
          library: 'radix',
          verifiedAt: '2026-05-03',
        },
      ],
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('accepts structured source without library/verifiedAt (URL-only object)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      sources: [{ url: 'https://www.w3.org/WAI/ARIA/apg/patterns/' }],
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('accepts mixed array: bare URL + structured', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const ok = {
      ...card,
      sources: [
        'https://www.w3.org/WAI/ARIA/apg/patterns/',
        {
          url: 'https://www.radix-ui.com/primitives/docs/components/dialog',
          library: 'radix',
          verifiedAt: '2026-05-03',
        },
      ],
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('rejects unknown library key', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      sources: [
        {
          url: 'https://example.com/',
          library: 'not-in-table',
          verifiedAt: '2026-05-03',
        },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects library set without verifiedAt (or vice versa)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const cases = [
      { url: 'https://www.radix-ui.com/', library: 'radix' }, // missing verifiedAt
      { url: 'https://www.radix-ui.com/', verifiedAt: '2026-05-03' }, // missing library
    ];
    for (const c of cases) {
      const bad = { ...card, sources: [c] };
      const result = componentSchema.safeParse(bad);
      expect(result.success, JSON.stringify(c)).toBe(false);
    }
  });

  it('rejects verifiedAt that is not YYYY-MM-DD', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      sources: [
        {
          url: 'https://www.radix-ui.com/',
          library: 'radix',
          verifiedAt: 'May 3, 2026',
        },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('pattern schema', () => {
  it('parses confirmation-flow.yaml', async () => {
    const map = await loadPatterns({ patternsDir });
    const conf = map.get('confirmation-flow');
    expect(conf).toBeTruthy();
    expect(conf?.composition.length).toBeGreaterThanOrEqual(2);
    expect(conf?.composition.map((c) => c.componentId)).toEqual(
      expect.arrayContaining(['modal', 'button']),
    );
    expect(conf?.frameworkSkeletons.react).toContain('Modal');
    expect(conf?.mistakes.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects pattern with single-entry composition', () => {
    const result = patternSchema.safeParse({
      id: 'tiny',
      name: 'Tiny',
      description: 'A pattern.',
      composition: [{ componentId: 'modal', role: 'container' }],
      whenToUse: { use: 'a', avoid: 'b' },
      decisions: [{ question: 'q', answer: 'a', rationale: 'r' }],
      mistakes: [
        { id: 'a', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'b', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'c', severity: 'major', title: 't', description: 'd', fix: 'f' },
      ],
      frameworkSkeletons: { webComponents: 'x', react: 'x', vue: 'x', angularSignals: 'x' },
      lastReviewed: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects pattern with fewer than 3 mistakes', () => {
    const result = patternSchema.safeParse({
      id: 'tiny',
      name: 'Tiny',
      description: 'A pattern.',
      composition: [
        { componentId: 'modal', role: 'a' },
        { componentId: 'button', role: 'b' },
      ],
      whenToUse: { use: 'a', avoid: 'b' },
      decisions: [{ question: 'q', answer: 'a', rationale: 'r' }],
      mistakes: [
        { id: 'a', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'b', severity: 'major', title: 't', description: 'd', fix: 'f' },
      ],
      frameworkSkeletons: { webComponents: 'x', react: 'x', vue: 'x', angularSignals: 'x' },
      lastReviewed: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects pattern missing one framework skeleton', () => {
    const result = patternSchema.safeParse({
      id: 'tiny',
      name: 'Tiny',
      description: 'A pattern.',
      composition: [
        { componentId: 'modal', role: 'a' },
        { componentId: 'button', role: 'b' },
      ],
      whenToUse: { use: 'a', avoid: 'b' },
      decisions: [{ question: 'q', answer: 'a', rationale: 'r' }],
      mistakes: [
        { id: 'a', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'b', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'c', severity: 'major', title: 't', description: 'd', fix: 'f' },
      ],
      frameworkSkeletons: { webComponents: 'x', react: 'x', vue: 'x' },
      lastReviewed: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects pattern with non-slug componentId in composition', () => {
    const result = patternSchema.safeParse({
      id: 'tiny',
      name: 'Tiny',
      description: 'A pattern.',
      composition: [
        { componentId: 'NotSlug', role: 'a' },
        { componentId: 'button', role: 'b' },
      ],
      whenToUse: { use: 'a', avoid: 'b' },
      decisions: [{ question: 'q', answer: 'a', rationale: 'r' }],
      mistakes: [
        { id: 'a', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'b', severity: 'major', title: 't', description: 'd', fix: 'f' },
        { id: 'c', severity: 'major', title: 't', description: 'd', fix: 'f' },
      ],
      frameworkSkeletons: { webComponents: 'x', react: 'x', vue: 'x', angularSignals: 'x' },
      lastReviewed: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('formIntegration structured fields (P6-121)', () => {
  it('accepts existing prose-only formIntegration entries (back-compat)', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(button.formIntegration).toBeDefined();
    expect(button.formIntegration?.name).toBeTypeOf('string');
  });

  it('accepts formIntegration with structured fields (nativeElement / submittedValue / requiredAttr / bridges)', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const ok = {
      ...button,
      formIntegration: {
        ...button.formIntegration,
        nativeElement: 'button',
        submittedValue: 'value attribute when type=submit',
        requiredAttr: false,
        bridges: {
          react: 'controlled (value, onChange) | uncontrolled (defaultValue, onChange)',
          vue: 'v-model:modelValue / update:modelValue',
          angularSignals: 'ControlValueAccessor',
          webComponents: 'native form-associated custom element via formAssociated=true',
        },
      },
    };
    const result = componentSchema.safeParse(ok);
    expect(result.success).toBe(true);
  });

  it('rejects unknown nativeElement enum value', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const bad = {
      ...button,
      formIntegration: {
        ...button.formIntegration,
        nativeElement: 'not-a-real-element',
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects bridges entry missing one framework', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const bad = {
      ...button,
      formIntegration: {
        ...button.formIntegration,
        bridges: {
          react: 'controlled',
          vue: 'v-model',
          angularSignals: 'CVA',
          // webComponents missing
        },
      },
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('eventsRationale field (P6-122)', () => {
  it('accepts eventsRationale 50-400 chars on icon and link (no-events-by-design)', async () => {
    const icon = await loadComponent(join(contentDir, 'icon.yaml'));
    const link = await loadComponent(join(contentDir, 'link.yaml'));
    expect(icon.eventsRationale).toBeDefined();
    expect(icon.eventsRationale!.length).toBeGreaterThanOrEqual(50);
    expect(icon.eventsRationale!.length).toBeLessThanOrEqual(400);
    expect(link.eventsRationale).toBeDefined();
    expect(link.eventsRationale!.length).toBeGreaterThanOrEqual(50);
    expect(link.eventsRationale!.length).toBeLessThanOrEqual(400);
  });

  it('rejects eventsRationale shorter than 50 chars', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, eventsRationale: 'too short' };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects eventsRationale longer than 400 chars', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, eventsRationale: 'x'.repeat(401) };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('eventsRationale is optional on components that declare events', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(button.events).toBeDefined();
    // Button has events; eventsRationale is allowed but not required
    expect(button.eventsRationale).toBeUndefined();
  });
});

describe('intro field (P6-42)', () => {
  it('every canonical component declares an intro 200–800 chars', async () => {
    const components = await loadComponents({ contentDir });
    const failures: string[] = [];
    for (const c of components.values()) {
      if (!c.intro) {
        failures.push(`${c.id}: intro is missing.`);
        continue;
      }
      if (c.intro.length < 200 || c.intro.length > 800) {
        failures.push(`${c.id}: intro length ${c.intro.length} outside 200–800.`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('rejects intro shorter than 200 chars', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, intro: 'too short' };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects intro longer than 800 chars', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = { ...card, intro: 'x'.repeat(801) };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });
});

describe('composition SVG renderer (P6-49 stage-4)', () => {
  it('renders confirmation-flow with one frame per composition entry', async () => {
    const patterns = await loadPatterns({ patternsDir });
    const pattern = patterns.get('confirmation-flow');
    expect(pattern).toBeDefined();
    const components = await loadComponents({ contentDir });
    const svg = renderCompositionSVG(pattern!, components);
    expect(svg).toContain('<svg');
    expect(svg).toContain('class="composition-diagram"');
    expect(svg).toContain('class="composition-outer"');
    const entryRects = svg.match(/class="composition-entry"/g) ?? [];
    expect(entryRects.length).toBe(pattern!.composition.length);
  });

  it('renders the pattern name as outer label', async () => {
    const patterns = await loadPatterns({ patternsDir });
    const pattern = patterns.get('login-form');
    const components = await loadComponents({ contentDir });
    const svg = renderCompositionSVG(pattern!, components);
    expect(svg).toContain(pattern!.name);
    expect(svg).toContain('class="composition-outer-label"');
  });

  it('renders each composition entry name and role', async () => {
    const patterns = await loadPatterns({ patternsDir });
    const pattern = patterns.get('confirmation-flow');
    const components = await loadComponents({ contentDir });
    const svg = renderCompositionSVG(pattern!, components);
    for (const entry of pattern!.composition) {
      const comp = components.get(entry.componentId);
      expect(svg).toContain(comp?.name ?? entry.componentId);
      expect(svg).toContain(entry.role);
    }
  });

  it('declares slot count per entry from canonical anatomy', async () => {
    const patterns = await loadPatterns({ patternsDir });
    const pattern = patterns.get('confirmation-flow');
    const components = await loadComponents({ contentDir });
    const svg = renderCompositionSVG(pattern!, components);
    const modal = components.get('modal');
    expect(svg).toContain(`${modal!.anatomy.length} slots`);
  });
});
