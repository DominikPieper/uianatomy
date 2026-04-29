import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from '../src/server.js';
import { setContentDir, resetCache } from '../src/data.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '..', '..', 'content', 'components');

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
  });

  afterEach(() => {
    resetCache();
    setContentDir(contentDir);
  });

  it('lists the registered tools', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'get_anatomy',
        'get_axes',
        'get_common_mistakes',
        'get_component',
        'get_component_view',
        'get_events',
        'get_framework_map',
        'get_mismatches',
        'get_motion',
        'get_responsive',
        'get_tokens',
        'get_transitions',
        'get_when_to_use',
        'list_components',
        'search_components',
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

  it('returns an error result for unknown component id', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'nope' } });
    expect((result as any).isError).toBe(true);
  });
});
