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
        'get_framework_map',
        'get_mismatches',
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

  it('returns an error result for unknown component id', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'nope' } });
    expect((result as any).isError).toBe(true);
  });
});
