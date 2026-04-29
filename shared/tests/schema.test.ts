import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadComponent, loadComponents } from '../src/loader.js';
import { componentSchema } from '../src/schema.js';
import { renderAnatomySVG, validateOverride } from '../src/svg.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');

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
    expect(svg).toContain('class="anatomy-slot anatomy-overlay"');
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

  it('validates override slot ids against YAML anatomy', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const goodOverride = card.anatomy.map((s) => `<g id="slot-${s.id}"></g>`).join('');
    const badOverride = `<g id="slot-not-real"></g>`;
    expect(validateOverride(goodOverride, card).ok).toBe(true);
    expect(validateOverride(badOverride, card).ok).toBe(false);
  });
});
