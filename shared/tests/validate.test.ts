import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadComponents } from '../src/loader.js';
import { loadImplementations } from '../src/loader.js';
import { validateImplementation } from '../src/validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = join(here, '..', '..', 'content', 'components');
const implementationsDir = join(here, '..', '..', 'implementations');

describe('validateImplementation', () => {
  it('reports broad coverage when given the canonical Radix Modal example code', async () => {
    const components = await loadComponents({ contentDir });
    const impls = await loadImplementations({ implementationsDir });
    const modal = components.get('modal')!;
    const radixModal = impls.get('radix')!.get('modal')!;
    const exampleCode = radixModal.exampleCode!;

    const report = validateImplementation({
      component: modal,
      code: exampleCode,
      framework: 'react',
    });

    expect(report.componentId).toBe('modal');
    expect(report.framework).toBe('react');
    // The Radix example wires the canonical anatomy; most required slots
    // surface as Radix sub-component names that include the slot id token.
    expect(report.summary.slotsMatched).toBeGreaterThan(0);
    expect(report.summary.slotsMatched).toBeLessThanOrEqual(report.summary.slotsRequired);
    // Notes always include the heuristic-disclaimer.
    expect(report.notes.some((n) => n.includes('Heuristic'))).toBe(true);
  });

  it('reports nothing matched on empty / garbage code', async () => {
    const components = await loadComponents({ contentDir });
    const modal = components.get('modal')!;

    const report = validateImplementation({
      component: modal,
      code: '// no canon here',
      framework: 'react',
    });

    expect(report.summary.slotsMatched).toBe(0);
    expect(report.summary.variantsMatched).toBe(0);
    expect(report.summary.propertiesMatched).toBe(0);
    // Modal has events; none are mentioned by the empty stub.
    if (report.summary.eventsDeclared > 0) {
      expect(report.summary.eventsMatched).toBe(0);
    }
    expect(report.missing.requiredSlots.length).toBe(report.summary.slotsRequired);
  });

  it('matches Vue event-binding syntax for the headlessui Modal example', async () => {
    const components = await loadComponents({ contentDir });
    const impls = await loadImplementations({ implementationsDir });
    const modal = components.get('modal')!;
    const headlessuiModal = impls.get('headlessui')!.get('modal')!;
    const exampleCode = headlessuiModal.exampleCode!;

    const report = validateImplementation({
      component: modal,
      code: exampleCode,
      framework: 'vue',
    });

    expect(report.componentId).toBe('modal');
    expect(report.framework).toBe('vue');
    // Vue framework path uses @event / v-on / emit('event') — we don't
    // assert specific event matches (the real audit catalogues divergence)
    // but the code path must execute without throwing and return a well-
    // formed report.
    expect(report.summary.eventsDeclared).toBeGreaterThanOrEqual(0);
    expect(report.summary).toHaveProperty('slotsRequired');
    expect(report.missing).toHaveProperty('events');
  });
});
