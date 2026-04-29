import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getComponents } from './data.js';
import type { Component } from '@uianatomy/shared';

const VIEW_VALUES = ['designer', 'dev', 'bridge'] as const;
type View = (typeof VIEW_VALUES)[number];

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function notFound(id: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `No component found with id "${id}".` }],
  };
}

function viewProjection(component: Component, view: View) {
  const base = {
    id: component.id,
    name: component.name,
    description: component.description,
    anatomy: component.anatomy,
  };
  if (view === 'designer') {
    return {
      ...base,
      figmaSlots: component.anatomy.map((s) => ({ id: s.id, figma: s.figma, required: s.required, purpose: s.purpose })),
      axes: component.axes,
      mismatches: component.mismatches,
      mistakes: component.mistakes,
    };
  }
  if (view === 'dev') {
    return {
      ...base,
      codeSlots: component.anatomy.map((s) => ({ id: s.id, code: s.code, required: s.required, purpose: s.purpose })),
      a11y: component.anatomy.map((s) => ({ id: s.id, hint: s.a11y.hint })),
      axes: component.axes,
      frameworkMap: component.frameworkMap,
      mistakes: component.mistakes,
    };
  }
  return component;
}

export function createServer(): McpServer {
  const server = new McpServer({ name: 'uianatomy', version: '0.0.0' });

  server.tool(
    'list_components',
    'List all canonical components by id and name.',
    {},
    async () => {
      const map = await getComponents();
      const list = [...map.values()]
        .map((c) => ({ id: c.id, name: c.name, description: c.description }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return jsonResult(list);
    },
  );

  server.tool(
    'get_component',
    'Return the full canonical definition for a component.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c);
    },
  );

  server.tool(
    'get_component_view',
    'Return a role-specific projection of a component (designer/dev/bridge).',
    { id: z.string(), view: z.enum(VIEW_VALUES) },
    async ({ id, view }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(viewProjection(c, view));
    },
  );

  server.tool(
    'get_anatomy',
    'Return only the anatomy section (slot/region definitions) for a component.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.anatomy);
    },
  );

  server.tool(
    'get_axes',
    'Return only variants/properties/states for a component.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.axes);
    },
  );

  server.tool(
    'get_mismatches',
    'Return only the Figma↔Code mismatches for a component.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.mismatches);
    },
  );

  server.tool(
    'get_common_mistakes',
    'Return only the documented common implementation mistakes for a component.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.mistakes);
    },
  );

  server.tool(
    'get_framework_map',
    'Return the cross-framework expression map for a component.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.frameworkMap);
    },
  );

  server.tool(
    'get_tokens',
    'Return the per-slot token bindings (spacing/radius/color/elevation/typography) for a component. Slots without tokens are omitted from the result.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      const slotsWithTokens = c.anatomy
        .filter((s) => s.tokens !== undefined)
        .map((s) => ({ slotId: s.id, tokens: s.tokens }));
      return jsonResult(slotsWithTokens);
    },
  );

  server.tool(
    'get_motion',
    'Return the motion block (durations/easing/reducedMotionFallback) for a component. Returns null when the component declares no motion.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.motion ?? null);
    },
  );

  server.tool(
    'get_responsive',
    'Return the responsive block (breakpoints) for a component. Returns null when the component declares no responsive behaviour.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.responsive ?? null);
    },
  );

  server.tool(
    'get_transitions',
    'Return the state-machine transitions (from/to/trigger) for a component. Returns null when the component declares no transitions.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.axes.states.transitions ?? null);
    },
  );

  server.tool(
    'get_events',
    'Return the events array (name/payload/per-framework notes) for a component. Returns null when the component declares no events.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.events ?? null);
    },
  );

  server.tool(
    'get_when_to_use',
    'Return the whenToUse block (use/avoid prose plus per-related differentiators) for a component. Returns null when the component declares no whenToUse.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.whenToUse ?? null);
    },
  );

  server.tool(
    'search_components',
    'Case-insensitive substring search across component id, name, description, and anatomy slot ids.',
    { query: z.string().min(1) },
    async ({ query }) => {
      const map = await getComponents();
      const q = query.toLowerCase();
      const matches = [...map.values()]
        .filter((c) => {
          const haystack =
            c.id + ' ' + c.name + ' ' + c.description + ' ' + c.anatomy.map((s) => s.id).join(' ') + ' ' + c.axes.variants.join(' ');
          return haystack.toLowerCase().includes(q);
        })
        .map((c) => ({ id: c.id, name: c.name, description: c.description }));
      return jsonResult(matches);
    },
  );

  return server;
}
