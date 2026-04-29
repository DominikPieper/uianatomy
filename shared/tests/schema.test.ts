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

  it('validates override slot ids against YAML anatomy', async () => {
    const card = await loadComponent(join(contentDir, 'card.yaml'));
    const goodOverride = card.anatomy.map((s) => `<g id="slot-${s.id}"></g>`).join('');
    const badOverride = `<g id="slot-not-real"></g>`;
    expect(validateOverride(goodOverride, card).ok).toBe(true);
    expect(validateOverride(badOverride, card).ok).toBe(false);
  });
});
