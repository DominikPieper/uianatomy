import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from '../src/server.js';
import { setContentDir, setImplementationsDir, setPatternsDir, resetCache } from '../src/data.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '..', '..', 'content', 'components');
const implementationsDir = resolve(here, '..', '..', 'implementations');
const patternsDir = resolve(here, '..', '..', 'content', 'patterns');

async function connect() {
  const server = createServer();
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

function parseJson(result: { content: Array<{ type: string; text?: string }> }) {
  const text = result.content.find((c) => c.type === 'text')?.text;
  if (!text) throw new Error('no text content');
  return JSON.parse(text);
}

describe('mcp server', () => {
  beforeAll(() => {
    setContentDir(contentDir);
    setImplementationsDir(implementationsDir);
    setPatternsDir(patternsDir);
  });

  afterEach(() => {
    resetCache();
    setContentDir(contentDir);
    setImplementationsDir(implementationsDir);
    setPatternsDir(patternsDir);
  });

  it('lists the registered tools', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'get_anatomy',
        'get_axes',
        'get_canonical_vocabularies',
        'get_changelog',
        'get_common_mistakes',
        'get_component',
        'get_component_view',
        'get_components',
        'get_events',
        'get_framework_map',
        'get_implementations',
        'get_mismatches',
        'get_motion',
        'get_pattern',
        'get_pattern_a11y_aggregate',
        'get_patterns_for_component',
        'get_responsive',
        'get_tokens',
        'get_transitions',
        'get_when_to_use',
        'list_components',
        'list_implementations',
        'list_patterns',
        'search_components',
        'validate_implementation',
      ].sort(),
    );
  });

  it('list_components returns Card', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_components', arguments: {} });
    const parsed = parseJson(result as any);
    expect(parsed.find((c: any) => c.id === 'card')).toBeTruthy();
  });

  it('get_component returns the full Card definition', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('card');
    expect(parsed.anatomy.length).toBeGreaterThan(0);
    expect(parsed.frameworkMap.react.structureMechanism).toBeDefined();
  });

  it('get_anatomy returns only the anatomy', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_anatomy', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBeDefined();
  });

  it('get_component_view designer returns figmaSlots', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_view',
      arguments: { id: 'card', view: 'designer' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.figmaSlots).toBeDefined();
    expect(parsed.codeSlots).toBeUndefined();
  });

  it('get_component_view dev returns codeSlots and frameworkMap', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_view',
      arguments: { id: 'card', view: 'dev' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.codeSlots).toBeDefined();
    expect(parsed.frameworkMap).toBeDefined();
  });

  it('search_components finds Card by variant token', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'search_components', arguments: { query: 'elevated' } });
    const parsed = parseJson(result as any);
    expect(parsed.some((c: any) => c.id === 'card')).toBe(true);
  });

  it('get_tokens returns slot-keyed token entries for Button', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_tokens', arguments: { id: 'button' } });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    const root = parsed.find((s: any) => s.slotId === 'root');
    expect(root?.tokens?.color?.background).toBe('color.accent.bg');
  });

  it('get_motion returns the modal motion block', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_motion', arguments: { id: 'modal' } });
    const parsed = parseJson(result as any);
    expect(parsed.easing).toBe('motion.easing.standard');
    expect(parsed.reducedMotionFallback).toBe('instant');
  });

  it('get_motion returns null for components without motion', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_motion', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(parsed).toBeNull();
  });

  it('get_responsive returns the modal breakpoints', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_responsive', arguments: { id: 'modal' } });
    const parsed = parseJson(result as any);
    expect(parsed.breakpoints[0].at).toBe('breakpoint.sm');
  });

  it('get_responsive returns null for Button', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_responsive', arguments: { id: 'button' } });
    const parsed = parseJson(result as any);
    expect(parsed).toBeNull();
  });

  it('get_transitions returns Modal transitions', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_transitions', arguments: { id: 'modal' } });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(4);
    expect(parsed[0].from).toBe('closed');
  });

  it('get_transitions returns null for Card', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_transitions', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(parsed).toBeNull();
  });

  it('get_events returns Combobox events with three entries', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_events', arguments: { id: 'combobox' } });
    const parsed = parseJson(result as any);
    expect(parsed.length).toBe(3);
    expect(parsed.map((e: any) => e.name)).toContain('selectionChange');
  });

  it('get_events returns null for Button', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_events', arguments: { id: 'button' } });
    const parsed = parseJson(result as any);
    expect(parsed).toBeNull();
  });

  it('get_when_to_use returns Card whenToUse with vsRelated ids', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_when_to_use', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(parsed.use.length).toBeGreaterThan(0);
    expect(parsed.avoid.length).toBeGreaterThan(0);
    expect(parsed.vsRelated.map((v: any) => v.id)).toEqual(['tile', 'list-item']);
  });

  it('get_changelog returns null for components without versioning metadata', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_changelog', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(parsed).toBeNull();
  });

  it('list_patterns returns confirmation-flow row', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_patterns', arguments: {} });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    const conf = parsed.find((p: any) => p.id === 'confirmation-flow');
    expect(conf).toBeTruthy();
    expect(conf.components).toEqual(expect.arrayContaining(['modal', 'button']));
  });

  it('get_pattern returns full confirmation-flow record', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_pattern',
      arguments: { id: 'confirmation-flow' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('confirmation-flow');
    expect(parsed.composition.length).toBeGreaterThanOrEqual(2);
    expect(parsed.frameworkSkeletons.react).toContain('Modal');
  });

  it('get_pattern errors on unknown id', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_pattern', arguments: { id: 'nope' } });
    expect((result as any).isError).toBe(true);
  });

  it('get_patterns_for_component(modal) returns confirmation-flow', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_patterns_for_component',
      arguments: { componentId: 'modal' },
    });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.some((p: any) => p.patternId === 'confirmation-flow')).toBe(true);
  });

  it('get_patterns_for_component returns empty for unused component', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_patterns_for_component',
      arguments: { componentId: 'tooltip' },
    });
    const parsed = parseJson(result as any);
    expect(parsed).toEqual([]);
  });

  it('get_changelog errors on unknown component id', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_changelog', arguments: { id: 'nope' } });
    expect((result as any).isError).toBe(true);
  });

  it('returns an error result for unknown component id', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'nope' } });
    expect((result as any).isError).toBe(true);
  });

  it('list_implementations returns one entry per library/component pair, sorted', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_implementations', arguments: {} });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(3);
    const sorted = [...parsed].sort(
      (a: any, b: any) =>
        a.libraryId.localeCompare(b.libraryId) ||
        a.componentId.localeCompare(b.componentId),
    );
    expect(parsed).toEqual(sorted);
    for (const row of parsed) {
      expect(row.libraryId).toBeTypeOf('string');
      expect(row.componentId).toBeTypeOf('string');
      expect(row.componentName).toBeTypeOf('string');
      expect(row.divergenceCount).toBeTypeOf('number');
      expect(row.lastReviewed).toBeTypeOf('string');
    }
  });

  it('list_implementations covers all three Modal audits today', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_implementations', arguments: {} });
    const parsed = parseJson(result as any);
    const modalAudits = parsed.filter((r: any) => r.componentId === 'modal');
    const libs = modalAudits.map((r: any) => r.libraryId).sort();
    expect(libs).toEqual(['cdk', 'headlessui', 'radix']);
  });

  it('get_implementations(modal) returns all three library audits', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_implementations',
      arguments: { componentId: 'modal' },
    });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    for (const impl of parsed) {
      expect(impl.componentId).toBe('modal');
      expect(['radix', 'headlessui', 'cdk']).toContain(impl.libraryId);
      expect(impl.componentName).toBeTypeOf('string');
      expect(impl.lastReviewed).toBeTypeOf('string');
    }
  });

  it('get_implementations(button) returns empty array (no audits yet)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_implementations',
      arguments: { componentId: 'button' },
    });
    const parsed = parseJson(result as any);
    expect(parsed).toEqual([]);
  });

  it('get_implementations(unknown) also returns empty array (not an error)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_implementations',
      arguments: { componentId: 'definitely-not-a-component' },
    });
    const parsed = parseJson(result as any);
    expect(parsed).toEqual([]);
  });

  it('get_canonical_vocabularies returns the master vocabulary set', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_canonical_vocabularies',
      arguments: {},
    });
    const parsed = parseJson(result as any);
    expect(parsed.spacing).toContain('spacing.cozy');
    expect(parsed.radius).toContain('radius.md');
    expect(parsed.color).toContain('color.text.danger');
    expect(parsed.elevation).toContain('elevation.overlay');
    expect(parsed.typography).toContain('text.md');
    expect(parsed.motion.durations).toContain('motion.duration.base');
    expect(parsed.motion.easing).toContain('motion.easing.standard');
    expect(parsed.breakpoint).toContain('breakpoint.sm');
    expect(parsed.propertyVocab.density).toEqual(['comfortable', 'compact']);
    expect(parsed.propertyBounded.size).toContain('full');
    expect(parsed.interactiveStates).toContain('focus-visible');
  });

  it('get_canonical_vocabularies vocab matches what consistency-test accepts', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_canonical_vocabularies',
      arguments: {},
    });
    const parsed = parseJson(result as any);
    const motionResult = await client.callTool({
      name: 'get_motion',
      arguments: { id: 'modal' },
    });
    const motion = parseJson(motionResult as any);
    expect(parsed.motion.easing).toContain(motion.easing);
    for (const v of Object.values(motion.durations as Record<string, string>)) {
      expect(parsed.motion.durations).toContain(v);
    }
  });

  it('get_components returns full records for a multi-id request', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_components',
      arguments: { ids: ['card', 'button', 'modal'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.components.map((c: any) => c.id)).toEqual(['card', 'button', 'modal']);
    expect(parsed.missing).toEqual([]);
    expect(parsed.components[0].anatomy.length).toBeGreaterThan(0);
    expect(parsed.components[2].axes).toBeDefined();
  });

  it('get_components reports unknown ids in `missing` and de-duplicates', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_components',
      arguments: { ids: ['card', 'definitely-not-a-component', 'card', 'also-fake'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.components.map((c: any) => c.id)).toEqual(['card']);
    expect(parsed.missing).toEqual(['also-fake', 'definitely-not-a-component']);
  });

  it('get_pattern_a11y_aggregate returns union of axeRules from composed components', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_pattern_a11y_aggregate',
      arguments: { patternId: 'confirmation-flow' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.patternId).toBe('confirmation-flow');
    expect(parsed.componentIds).toEqual(expect.arrayContaining(['modal', 'button']));
    expect(parsed.axeRules).toEqual([...parsed.axeRules].sort());
    expect(new Set(parsed.axeRules).size).toBe(parsed.axeRules.length);
    expect(parsed.axeRules).toContain('aria-dialog-name');
    for (const k of parsed.keyboardWalk) {
      expect(parsed.componentIds).toContain(k.sourceComponentId);
    }
    for (const a of parsed.announcements) {
      expect(parsed.componentIds).toContain(a.sourceComponentId);
    }
  });

  it('get_pattern_a11y_aggregate returns single axeCoreVersion when all components agree', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_pattern_a11y_aggregate',
      arguments: { patternId: 'confirmation-flow' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.axeCoreVersion).toBe('4.10.2');
  });

  it('get_pattern_a11y_aggregate errors on unknown patternId', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_pattern_a11y_aggregate',
      arguments: { patternId: 'nope-not-a-pattern' },
    });
    expect((result as any).isError).toBe(true);
  });

  it('validate_implementation reports zero matches on garbage code', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'validate_implementation',
      arguments: { componentId: 'modal', code: '// nothing canonical here', framework: 'react' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.componentId).toBe('modal');
    expect(parsed.framework).toBe('react');
    expect(parsed.summary.slotsMatched).toBe(0);
    expect(parsed.missing.requiredSlots.length).toBe(parsed.summary.slotsRequired);
  });

  it('validate_implementation flags an unknown componentId as an error', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'validate_implementation',
      arguments: { componentId: 'definitely-not-a-component', code: 'x', framework: 'react' },
    });
    expect((result as any).isError).toBe(true);
  });

  it('validate_implementation produces a well-formed report shape on a real example', async () => {
    const { client } = await connect();
    // Pull the example from get_implementations so the test stays in sync
    // with the canon without duplicating the YAML payload.
    const implResult = await client.callTool({
      name: 'get_implementations',
      arguments: { componentId: 'modal' },
    });
    const impls = parseJson(implResult as any);
    const radixModal = impls.find((i: any) => i.libraryId === 'radix');
    expect(radixModal?.exampleCode).toBeTypeOf('string');

    const result = await client.callTool({
      name: 'validate_implementation',
      arguments: {
        componentId: 'modal',
        code: radixModal.exampleCode,
        framework: 'react',
      },
    });
    const report = parseJson(result as any);
    expect(report).toHaveProperty('summary');
    expect(report.summary).toHaveProperty('slotsRequired');
    expect(report.summary).toHaveProperty('slotsMatched');
    expect(report.summary.slotsMatched).toBeLessThanOrEqual(report.summary.slotsRequired);
    expect(report.notes.some((n: string) => n.includes('Heuristic'))).toBe(true);
  });
});
