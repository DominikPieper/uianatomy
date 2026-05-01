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
import { renderAnatomySVG, validateOverride } from '../src/svg.js';

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
    expect(card.axes.variants).toContain('elevated');
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
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(card.motion).toBeUndefined();
    expect(button.motion).toBeUndefined();
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

  it('parses tabs and modal performance', async () => {
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const modal = await loadComponent(join(contentDir, 'modal.yaml'));
    expect(tabs.performance?.find((p) => p.name === 'tablistOverflow')?.threshold).toBe(7);
    expect(modal.performance?.find((p) => p.name === 'stackDepth')?.threshold).toBe(1);
  });

  it('omits performance on Card and Button', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(card.performance).toBeUndefined();
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
  it('parses button propertyMap with mixed Figma types', async () => {
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    const types = new Set(button.propertyMap?.map((p) => p.type));
    expect(types.has('Variant')).toBe(true);
    expect(types.has('Boolean')).toBe(true);
    expect(types.has('Text')).toBe(true);
    expect(types.has('Instance Swap')).toBe(true);
  });

  it('all five components declare propertyMap', async () => {
    const ids = ['button', 'card', 'modal', 'tabs', 'combobox'];
    for (const id of ids) {
      const c = await loadComponent(join(contentDir, `${id}.yaml`));
      expect((c.propertyMap?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it('rejects entry with unknown Figma type', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const bad = {
      ...card,
      propertyMap: [
        { figma: 'Variant', code: 'variant', type: 'Number' },
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
        { figma: '', code: 'variant', type: 'Variant' },
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
        { figma: 'Variant', code: '', type: 'Variant' },
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
        { figma: 'Variant', code: 'variant', type: 'Variant', somethingElse: 'x' },
      ],
    };
    const result = componentSchema.safeParse(bad);
    expect(result.success).toBe(false);
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
    expect(ids).toEqual(['tile', 'list-item']);
  });

  it('parses combobox whenToUse with three vsRelated entries', async () => {
    const combobox = await loadComponent(join(contentDir, 'combobox.yaml'));
    const ids = combobox.whenToUse?.vsRelated?.map((v) => v.id) ?? [];
    expect(ids).toEqual(['select', 'search-input', 'tag-input']);
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

  it('omits events on Card and Button', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(card.events).toBeUndefined();
    expect(button.events).toBeUndefined();
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

  it('omits transitions on Card/Tabs/Button (trivial graphs)', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const tabs = await loadComponent(join(contentDir, 'tabs.yaml'));
    const button = await loadComponent(join(contentDir, 'button.yaml'));
    expect(card.axes.states.transitions).toBeUndefined();
    expect(tabs.axes.states.transitions).toBeUndefined();
    expect(button.axes.states.transitions).toBeUndefined();
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
      variants: ['primary', 'secondary', 'tertiary'],
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
      variants: ['primary'],
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
      variants: ['primary'],
      properties: [],
      states: { interactive: [], data: [] },
      variantDeprecations: [
        { name: 'primary', since: '2.0.0', reason: 'a' },
        { name: 'primary', since: '3.0.0', reason: 'b' },
      ],
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
        { id: 'a', title: 't', description: 'd', fix: 'f' },
        { id: 'b', title: 't', description: 'd', fix: 'f' },
        { id: 'c', title: 't', description: 'd', fix: 'f' },
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
        { id: 'a', title: 't', description: 'd', fix: 'f' },
        { id: 'b', title: 't', description: 'd', fix: 'f' },
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
        { id: 'a', title: 't', description: 'd', fix: 'f' },
        { id: 'b', title: 't', description: 'd', fix: 'f' },
        { id: 'c', title: 't', description: 'd', fix: 'f' },
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
        { id: 'a', title: 't', description: 'd', fix: 'f' },
        { id: 'b', title: 't', description: 'd', fix: 'f' },
        { id: 'c', title: 't', description: 'd', fix: 'f' },
      ],
      frameworkSkeletons: { webComponents: 'x', react: 'x', vue: 'x', angularSignals: 'x' },
      lastReviewed: '2026-05-01',
    });
    expect(result.success).toBe(false);
  });
});
