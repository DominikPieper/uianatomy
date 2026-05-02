import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getComponents, getImplementations, getPatterns } from './state.js';
import type { Component } from '@uianatomy/shared/schema';
import { validateImplementation } from '@uianatomy/shared/validate';
import { getCanonicalVocabularies } from '@uianatomy/shared/vocabulary';

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
    'get_components',
    'Bulk-fetch the full canonical definitions for a list of component ids. Returns `{ components, missing }` — `components` is the array of resolved records (in the order requested, deduplicated), `missing` is the array of ids that did not resolve to a canonical component (sorted). Use this when the agent already knows which components it needs (e.g. comparing 3 components, or hydrating a pattern\'s composition[].componentId list); avoids N round-trips of `get_component`.',
    { ids: z.array(z.string()).min(1) },
    async ({ ids }) => {
      const map = await getComponents();
      const seen = new Set<string>();
      const components: Component[] = [];
      const missing: string[] = [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        const c = map.get(id);
        if (c) components.push(c);
        else missing.push(id);
      }
      missing.sort();
      return jsonResult({ components, missing });
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
    'get_changelog',
    'Return the versioning block (since + changelog entries) for a component. Returns null when the component declares no version metadata. Each changelog entry is { version (semver), date (ISO YYYY-MM-DD), summary }.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      if (!c.since && !c.changelog) return jsonResult(null);
      return jsonResult({ since: c.since ?? null, changelog: c.changelog ?? [] });
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

  server.tool(
    'list_implementations',
    'List every Phase-2 library audit (one entry per library/component pair) with library id, component id, library-specific component name, divergence count, and last-reviewed date. Sorted by libraryId then componentId. **Takes no arguments — returns the full audit roster.** To see audits for a single canonical component, call `get_implementations({ componentId })` instead. Today the roster covers Modal × {radix, headlessui, cdk}; other components have no audits yet.',
    {},
    async () => {
      const byLibrary = await getImplementations();
      const rows: Array<{
        libraryId: string;
        componentId: string;
        componentName: string;
        divergenceCount: number;
        lastReviewed: string;
      }> = [];
      for (const [libraryId, byComponent] of byLibrary) {
        for (const [componentId, impl] of byComponent) {
          rows.push({
            libraryId,
            componentId,
            componentName: impl.componentName,
            divergenceCount: impl.divergence?.length ?? 0,
            lastReviewed: impl.lastReviewed,
          });
        }
      }
      rows.sort(
        (a, b) =>
          a.libraryId.localeCompare(b.libraryId) ||
          a.componentId.localeCompare(b.componentId),
      );
      return jsonResult(rows);
    },
  );

  server.tool(
    'get_implementations',
    'Return every library audit for a canonical component as an array of Implementation records (componentId, libraryId, componentName, exampleCode, divergence list, rationale, lastReviewed). Returns an empty array when no library has audited this component yet.',
    { componentId: z.string() },
    async ({ componentId }) => {
      const byLibrary = await getImplementations();
      const matches = [];
      for (const byComponent of byLibrary.values()) {
        const impl = byComponent.get(componentId);
        if (impl) matches.push(impl);
      }
      matches.sort((a, b) => a.libraryId.localeCompare(b.libraryId));
      return jsonResult(matches);
    },
  );

  server.tool(
    'list_patterns',
    'List every canonical pattern with id, name, description, lastReviewed, and the canonical componentIds it composes. Patterns are compositions on top of canonical atomic components — login forms, confirmation flows, empty states, settings pages.',
    {},
    async () => {
      const map = await getPatterns();
      const rows = [...map.values()]
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          components: [...new Set(p.composition.map((c) => c.componentId))],
          lastReviewed: p.lastReviewed,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return jsonResult(rows);
    },
  );

  server.tool(
    'get_pattern',
    'Return the full canonical definition for one pattern (composition, whenToUse, decisions, mistakes, frameworkSkeletons, lastReviewed). Returns an error result for unknown ids.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getPatterns();
      const p = map.get(id);
      if (!p) return notFound(id);
      return jsonResult(p);
    },
  );

  server.tool(
    'get_patterns_for_component',
    'Return every pattern that composes the given canonical component, sorted by pattern name. Each entry reports the pattern id, name, description, the role this component plays in the composition, and any composition-specific notes. Returns an empty array when no pattern uses the component.',
    { componentId: z.string() },
    async ({ componentId }) => {
      const map = await getPatterns();
      const rows: Array<{
        patternId: string;
        patternName: string;
        description: string;
        role: string;
        notes?: string;
      }> = [];
      for (const p of map.values()) {
        for (const c of p.composition) {
          if (c.componentId === componentId) {
            rows.push({
              patternId: p.id,
              patternName: p.name,
              description: p.description,
              role: c.role,
              notes: c.notes,
            });
          }
        }
      }
      rows.sort((a, b) => a.patternName.localeCompare(b.patternName));
      return jsonResult(rows);
    },
  );

  server.tool(
    'get_canonical_vocabularies',
    'Return the canonical token / motion / breakpoint / property / interactive-state vocabularies that YAML values must draw from. Same source the consistency-test enforces. Useful for resolving values like `responsive.breakpoints[].at: "breakpoint.sm"` against the master list, or for surfacing the allowed enum to a downstream UI. Returns `{ spacing, radius, color, elevation, typography, motion: { durations, easing }, breakpoint, propertyVocab, propertyBounded, interactiveStates }`.',
    {},
    async () => jsonResult(getCanonicalVocabularies()),
  );

  server.tool(
    'get_pattern_a11y_aggregate',
    'Aggregate the a11yAcceptance contract for a pattern by unioning the a11yAcceptance of every canonical component it composes. Returns `{ patternId, componentIds, axeRules (sorted union, deduplicated), keyboardWalk (concat, each entry tagged with sourceComponentId), announcements (concat, each entry tagged with sourceComponentId), axeCoreVersion (single semver if all contributors agree, null if components disagree or none declare a version) }`. Useful for "test this whole pattern with axe-core + Playwright" flows where the agent needs the union of every a11y contract the pattern inherits from its composed components. Pattern-level overrides are not yet a schema feature; this tool is a pure aggregation. Errors if patternId is unknown.',
    { patternId: z.string() },
    async ({ patternId }) => {
      const patterns = await getPatterns();
      const pattern = patterns.get(patternId);
      if (!pattern) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `No pattern found with id "${patternId}".` }],
        };
      }
      const components = await getComponents();
      const componentIds = [...new Set(pattern.composition.map((c) => c.componentId))];
      const axeRulesSet = new Set<string>();
      const keyboardWalk: Array<Record<string, unknown>> = [];
      const announcements: Array<Record<string, unknown>> = [];
      const axeCoreVersions = new Set<string>();
      for (const id of componentIds) {
        const c = components.get(id);
        if (!c?.a11yAcceptance) continue;
        const a = c.a11yAcceptance;
        for (const r of a.axeRules ?? []) axeRulesSet.add(r);
        for (const k of a.keyboardWalk ?? []) keyboardWalk.push({ sourceComponentId: id, ...k });
        for (const an of a.announcements ?? []) announcements.push({ sourceComponentId: id, ...an });
        if (a.axeCoreVersion) axeCoreVersions.add(a.axeCoreVersion);
      }
      const axeRules = [...axeRulesSet].sort();
      const axeCoreVersion = axeCoreVersions.size === 1 ? [...axeCoreVersions][0] : null;
      return jsonResult({
        patternId,
        componentIds,
        axeRules,
        keyboardWalk,
        announcements,
        axeCoreVersion,
      });
    },
  );

  server.tool(
    'validate_implementation',
    'Heuristic structural conformance check: given component code and a target framework, reports which canonical required slots, variants, properties, and events appear (or are missing) in the code. Framework-aware event-name detection: react = on<PascalCase>, vue = @event / v-on:event / emit("event"), angular = (event), webComponents = bare event-name strings. Substring search only, no parser — false negatives possible on aliased or minified identifiers. NOT a substitute for behavioural assertions: pair with the per-component a11y-fixture endpoint plus a real Playwright + axe-core run.',
    {
      componentId: z.string(),
      code: z.string().min(1),
      framework: z.enum(['react', 'vue', 'angular', 'webComponents']),
    },
    async ({ componentId, code, framework }) => {
      const map = await getComponents();
      const c = map.get(componentId);
      if (!c) return notFound(componentId);
      return jsonResult(validateImplementation({ component: c, code, framework }));
    },
  );

  return server;
}
