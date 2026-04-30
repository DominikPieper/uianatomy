// Registers UI Anatomy read tools with an in-browser WebMCP client.
// https://webmachinelearning.github.io/webmcp/
//
// Tools are backed by the existing static JSON APIs — no new endpoints, no
// MCP SDK shipped to the browser. Silently no-ops when WebMCP is absent.

interface ComponentSummary {
  id: string;
  name: string;
  description: string;
}

type WebMcpToolHandle = unknown;

interface WebMcpRegisterToolInit {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

interface WebMcpModelContext {
  registerTool?: (tool: WebMcpRegisterToolInit, options?: { signal?: AbortSignal }) => WebMcpToolHandle;
  provideContext?: (context: { tools: WebMcpRegisterToolInit[] }) => WebMcpToolHandle;
}

declare global {
  interface Navigator {
    modelContext?: WebMcpModelContext;
  }
}

const ctx = typeof navigator !== 'undefined' ? navigator.modelContext : undefined;
if (ctx) {
  let cache: Promise<ComponentSummary[]> | null = null;
  const loadIndex = (): Promise<ComponentSummary[]> => {
    if (!cache) {
      cache = fetch('/api/components.json')
        .then((r) => r.json())
        .then((body: { components: ComponentSummary[] }) => body.components);
    }
    return cache;
  };

  const tools: WebMcpRegisterToolInit[] = [
    {
      name: 'list_components',
      description: 'List all canonical UI Anatomy components by id, name, and description.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: async () => ({ components: await loadIndex() }),
    },
    {
      name: 'get_component',
      description: 'Return the full canonical schema for one UI Anatomy component (anatomy, axes, mismatches, common mistakes, framework map, tokens, motion, responsive, transitions, events, when-to-use).',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Component id, e.g. "modal".' } },
        required: ['id'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const id = String((input as { id?: unknown }).id ?? '').trim();
        if (!id) throw new Error('id is required');
        const res = await fetch(`/api/components/${encodeURIComponent(id)}.json`);
        if (!res.ok) throw new Error(`Component "${id}" not found`);
        return res.json();
      },
    },
    {
      name: 'search_components',
      description: 'Case-insensitive substring search across component id, name, and description. Returns matching summaries.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Substring to match.' } },
        required: ['query'],
        additionalProperties: false,
      },
      execute: async (input) => {
        const query = String((input as { query?: unknown }).query ?? '').trim().toLowerCase();
        if (!query) return { results: [] };
        const components = await loadIndex();
        return {
          results: components.filter((c) =>
            (c.id + ' ' + c.name + ' ' + c.description).toLowerCase().includes(query),
          ),
        };
      },
    },
  ];

  if (typeof ctx.registerTool === 'function') {
    for (const tool of tools) ctx.registerTool(tool);
  } else if (typeof ctx.provideContext === 'function') {
    ctx.provideContext({ tools });
  }
}

export {};
