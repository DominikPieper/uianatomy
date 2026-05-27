import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAbout, getComponents, getImplementations, getPatterns, getSubAnatomies } from './state.js';
import type { Component } from '@uianatomy/shared/schema';
import { validateImplementation } from '@uianatomy/shared/validate';
import { getCanonicalVocabularies } from '@uianatomy/shared/vocabulary';
import { READ_ONLY } from './annotations.js';
import { CHARACTER_LIMIT } from './constants.js';
import {
  aboutOutput,
  axesOutput,
  canonicalVocabulariesOutput,
  componentOutput,
  componentsBulkOutput,
  componentViewOutput,
  contractsOutput,
  frameworkMapOutput,
  patternA11yAggregateOutput,
  patternOutput,
  subAnatomyOutput,
  validateImplementationOutput,
} from './output-schemas.js';

// P6-143 — SEVERITY_SYNONYM_REVERSE was previously built here from
// SEVERITY_SYNONYMS to expand severity-aware queries (`danger` → `error`).
// Decommissioned because per-variant `alternativeNames` (P6-127 / ADR-031)
// now feeds those same synonyms directly into the search haystack at the
// component-yaml level. `SEVERITY_SYNONYMS` itself remains in vocabulary.ts
// as canonical synonym documentation, exposed via `get_canonical_vocabularies`.

const VIEW_VALUES = ['designer', 'dev', 'bridge'] as const;
type View = (typeof VIEW_VALUES)[number];

// ---------------------------------------------------------------------------
// Response helpers
//
// Two shapes per the mcp-builder skill + MCP spec:
//   - jsonResult(value)    → content-only. Used by array- and nullable-
//                            returning tools (structuredContent must be a
//                            non-null object, which those aren't).
//   - objectResult(value)  → content + structuredContent. Used by tools that
//                            return a stable object, paired with an
//                            outputSchema on the registration.
//
// When the serialized payload exceeds CHARACTER_LIMIT, a soft-limit warning
// block is appended — but the data is NEVER silently dropped. Silently
// slicing a correctness-critical read (e.g. get_implementations, whose
// exampleCode blocks legitimately push a single-component answer past the
// limit) would corrupt the answer. Instead the warning nudges the agent to
// use the explicit `limit` parameter / filters that the list-style tools
// expose, keeping truncation opt-in and lossless.
// ---------------------------------------------------------------------------
function serialize(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function contentFor(value: unknown): Array<{ type: 'text'; text: string }> {
  const text = serialize(value);
  if (text.length <= CHARACTER_LIMIT) {
    return [{ type: 'text', text }];
  }
  const hint = Array.isArray(value)
    ? `Pass a 'limit' (where supported), add a filter, or fetch specific ids to shrink it.`
    : `Request fewer ids or use a narrower slice tool to shrink it.`;
  return [
    { type: 'text', text },
    {
      type: 'text',
      text: `⚠ Response is ${text.length} chars, over the ${CHARACTER_LIMIT}-char soft limit and may strain a downstream LLM's context. ${hint}`,
    },
  ];
}

function jsonResult(value: unknown) {
  return { content: contentFor(value) };
}

function objectResult(value: Record<string, unknown>) {
  return { content: contentFor(value), structuredContent: value };
}

function notFoundResult(kind: string, id: string, recovery: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: `No ${kind} found with id "${id}". ${recovery}` }],
  };
}

const notFound = (id: string) =>
  notFoundResult('component', id, 'Call list_components to see valid component ids.');

// P6-125 — compute days since lastReviewed for staleness surfacing.
// Returns null when lastReviewed is undefined (component never had a
// review timestamp written). Floor to integer days. Negative values
// (lastReviewed in the future, e.g. authoring-day fixtures dated
// tomorrow) clamp to 0 — never negative.
function computeStalenessDays(lastReviewed: string | undefined): number | null {
  if (!lastReviewed) return null;
  const reviewed = Date.parse(lastReviewed);
  if (Number.isNaN(reviewed)) return null;
  const days = Math.floor((Date.now() - reviewed) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
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

// Shared input-field descriptors (DRY — most tools key off a component id).
const componentIdField = z
  .string()
  .min(1)
  .describe("Canonical component id, e.g. 'modal' or 'tabs'. Call list_components for valid ids.");

export function createServer(): McpServer {
  const server = new McpServer({ name: 'uianatomy', version: '0.0.0' });

  server.registerTool(
    'get_about',
    {
      title: 'About UI Anatomy',
      description:
        'Return the project framing prose — what UI Anatomy is, what it is *for*, what it is *not*, and what "canon" means here. Returns `{ markdown, summary }`. `markdown` is the full `docs/about.md` body; `summary` is a one-paragraph distillation suitable for tool-call traces. **Call this before relaying canonical claims to a downstream user**: every canonical record on this server is synthesised by triangulating multiple sources (W3C ARIA APG, MDN, WCAG, mature headless libraries, production design systems) and is best-practice convergence with rationale, not regulation. Agents that surface canon claims as "this is the rule" mis-frame the data; surface the framing in the summary instead so the downstream user inherits the correct epistemic posture (best-practice reference, context-driven divergence expected, per-library `implementations/` audits capture real divergences).',
      outputSchema: aboutOutput,
      annotations: READ_ONLY,
    },
    async () => {
      const about = await getAbout();
      return objectResult(about as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'list_components',
    {
      title: 'List Components',
      description:
        'List all canonical components by id, name, description, lastReviewed date, and derived stalenessDays (days since lastReviewed; null when lastReviewed is omitted). Agents should treat stalenessDays > component.staleAfter (default 90 days) as a signal to verify the canonical claims against current upstream sources before relying on them.',
      annotations: READ_ONLY,
    },
    async () => {
      const map = await getComponents();
      const list = [...map.values()]
        .map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          lastReviewed: c.lastReviewed ?? null,
          stalenessDays: computeStalenessDays(c.lastReviewed),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return jsonResult(list);
    },
  );

  server.registerTool(
    'get_component',
    {
      title: 'Get Component',
      description:
        'Return the full canonical definition for a component, augmented with derived `stalenessDays` (days since lastReviewed; null when lastReviewed is omitted) and `staleAfter` (canonical staleness threshold in days; default 90 when omitted). Agents compare stalenessDays vs staleAfter to decide whether to verify claims against upstream sources before relying on them.',
      inputSchema: z.strictObject({ id: componentIdField }),
      outputSchema: componentOutput,
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return objectResult({
        ...c,
        stalenessDays: computeStalenessDays(c.lastReviewed),
        staleAfter: c.staleAfter ?? 90,
      });
    },
  );

  server.registerTool(
    'get_components',
    {
      title: 'Get Components (bulk)',
      description:
        "Bulk-fetch the full canonical definitions for a list of component ids. Returns `{ components, missing }` — `components` is the array of resolved records (in the order requested, deduplicated), `missing` is the array of ids that did not resolve to a canonical component (sorted). Use this when the agent already knows which components it needs (e.g. comparing 3 components, or hydrating a pattern's composition[].componentId list); avoids N round-trips of `get_component`.",
      inputSchema: z.strictObject({
        ids: z
          .array(z.string().min(1))
          .min(1)
          .describe('Canonical component ids to fetch. Order is preserved; duplicates are de-duplicated.'),
      }),
      outputSchema: componentsBulkOutput,
      annotations: READ_ONLY,
    },
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
      return objectResult({ components, missing });
    },
  );

  server.registerTool(
    'get_component_view',
    {
      title: 'Get Component (role view)',
      description: 'Return a role-specific projection of a component (designer/dev/bridge).',
      inputSchema: z.strictObject({
        id: componentIdField,
        view: z
          .enum(VIEW_VALUES)
          .describe(
            "Projection: 'designer' (figma slots + axes + mismatches + mistakes), 'dev' (code slots + a11y hints + frameworkMap + mistakes), 'bridge' (the full record).",
          ),
      }),
      outputSchema: componentViewOutput,
      annotations: READ_ONLY,
    },
    async ({ id, view }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return objectResult(viewProjection(c, view) as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_anatomy',
    {
      title: 'Get Anatomy',
      description:
        'Return only the anatomy section (slot/region definitions) for a component. Slice tool — use for narrow round-trip needs (e.g. anatomy-only review). For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.anatomy);
    },
  );

  server.registerTool(
    'get_axes',
    {
      title: 'Get Axes',
      description:
        'Return only variants/properties/states for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      outputSchema: axesOutput,
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return objectResult(c.axes as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_mismatches',
    {
      title: 'Get Figma↔Code Mismatches',
      description:
        'Return only the Figma↔Code mismatches for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.mismatches);
    },
  );

  server.registerTool(
    'get_common_mistakes',
    {
      title: 'Get Common Mistakes',
      description:
        'Return only the documented common implementation mistakes for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.mistakes);
    },
  );

  server.registerTool(
    'get_framework_map',
    {
      title: 'Get Framework Map',
      description:
        'Return the cross-framework expression map for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      outputSchema: frameworkMapOutput,
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return objectResult(c.frameworkMap as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_tokens',
    {
      title: 'Get Token Bindings',
      description:
        'Return the per-slot token bindings (spacing/radius/color/elevation/typography) for a component. Slots without tokens are omitted from the result. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
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

  server.registerTool(
    'get_motion',
    {
      title: 'Get Motion',
      description:
        'Return the motion block (durations/easing/reducedMotionFallback) for a component. Returns null when the component declares no motion. Slice tool — use for narrow round-trip needs (e.g. motion-only review across multiple components). For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.motion ?? null);
    },
  );

  server.registerTool(
    'get_responsive',
    {
      title: 'Get Responsive',
      description:
        'Return the responsive block (breakpoints) for a component. Returns null when the component declares no responsive behaviour. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.responsive ?? null);
    },
  );

  server.registerTool(
    'get_transitions',
    {
      title: 'Get State Transitions',
      description:
        'Return the state-machine transitions (from/to/trigger) for a component. Returns null when the component declares no transitions. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.axes.states.transitions ?? null);
    },
  );

  server.registerTool(
    'get_events',
    {
      title: 'Get Events',
      description:
        'Return the events array (name/payload/per-framework notes) for a component. Returns null when the component declares no events. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.events ?? null);
    },
  );

  server.registerTool(
    'get_changelog',
    {
      title: 'Get Changelog',
      description:
        'Return the versioning block (since + changelog entries) for a component. Returns null when the component declares no version metadata (today no canonical component declares either; this surface activates when a component lands its first published rename / mistake-correction / canonical-name-change and the editor bumps `since` + appends a changelog entry per docs/methodology.md). Each changelog entry is { version (semver), date (ISO YYYY-MM-DD), summary }. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      if (!c.since && !c.changelog) return jsonResult(null);
      return jsonResult({ since: c.since ?? null, changelog: c.changelog ?? [] });
    },
  );

  server.registerTool(
    'get_when_to_use',
    {
      title: 'Get When-To-Use',
      description:
        'Return the whenToUse block (use/avoid prose plus per-related differentiators) for a component. Returns null when the component declares no whenToUse. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({ id: componentIdField }),
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult(c.whenToUse ?? null);
    },
  );

  server.registerTool(
    'search_components',
    {
      title: 'Search Components',
      description:
        'Case-insensitive substring search across component id, name, description, anatomy slot ids, variant names + per-variant `alternativeNames` (ADR-031, P6-127), and referenced sub-anatomy ids (P6-126). Per-variant `alternativeNames` are the canonical surface for cross-system synonyms — e.g. Toast/Alert/Banner/Badge `error` carries `[danger, destructive, critical]` and `warning` carries `[caution, attention]`, so `search_components({ query: "danger" })` resolves via the haystack rather than via a query-side synonym map. Sub-anatomy ids are matched too — `search_components({ query: "action-group" })` returns Card / Alert / Modal / Drawer.',
      inputSchema: z.strictObject({
        query: z
          .string()
          .min(1)
          .describe('Case-insensitive substring matched against the component search haystack.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum matches to return (results sorted by name). Omit for all matches.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ query, limit }) => {
      const map = await getComponents();
      const q = query.toLowerCase();
      const matches = [...map.values()]
        .filter((c) => {
          // P6-126 — read non-enumerable __subAnatomy provenance from each
          // resolved slot and add referenced sub-anatomy ids to haystack.
          const subAnatomyIds = new Set<string>();
          for (const s of c.anatomy) {
            const provenance = (s as { __subAnatomy?: { id: string } }).__subAnatomy;
            if (provenance) subAnatomyIds.add(provenance.id);
          }
          const haystack = (
            c.id +
            ' ' +
            c.name +
            ' ' +
            c.description +
            ' ' +
            c.anatomy.map((s) => s.id).join(' ') +
            ' ' +
            c.axes.variants
              .flatMap((v) => [v.name, ...(v.alternativeNames ?? [])])
              .join(' ') +
            ' ' +
            [...subAnatomyIds].join(' ')
          ).toLowerCase();
          return haystack.includes(q);
        })
        .map((c) => ({ id: c.id, name: c.name, description: c.description }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return jsonResult(limit !== undefined ? matches.slice(0, limit) : matches);
    },
  );

  server.registerTool(
    'list_implementations',
    {
      title: 'List Implementations',
      description:
        'List every Phase-2 library audit (one entry per library/component pair) with library id, component id, library-specific component name, divergence count, and last-reviewed date. Sorted by libraryId then componentId. Optional `componentId` filter narrows the roster to a single canonical component (returns an empty array when no audits exist for that component); optional `libraryId` filter narrows to a single library. Use this tool for the lightweight summary-row shape; use `get_implementations({ componentId })` to get full Implementation records (exampleCode + divergence list + rationale). Today the roster covers Modal × {radix, headlessui, cdk}; other components have no audits yet.',
      inputSchema: z.strictObject({
        componentId: z
          .string()
          .min(1)
          .optional()
          .describe('Optional canonical component id filter. Omit to list all components.'),
        libraryId: z
          .string()
          .min(1)
          .optional()
          .describe("Optional library id filter, e.g. 'radix' or 'headlessui'. Omit to list all libraries."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum rows to return (sorted by libraryId then componentId). Omit for all rows.'),
      }),
      annotations: READ_ONLY,
    },
    async ({ componentId, libraryId, limit }) => {
      const byLibrary = await getImplementations();
      const rows: Array<{
        libraryId: string;
        componentId: string;
        componentName: string;
        divergenceCount: number;
        lastReviewed: string;
      }> = [];
      for (const [lib, byComponent] of byLibrary) {
        if (libraryId !== undefined && lib !== libraryId) continue;
        for (const [comp, impl] of byComponent) {
          if (componentId !== undefined && comp !== componentId) continue;
          rows.push({
            libraryId: lib,
            componentId: comp,
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
      return jsonResult(limit !== undefined ? rows.slice(0, limit) : rows);
    },
  );

  server.registerTool(
    'get_implementations',
    {
      title: 'Get Implementations',
      description:
        'Return every library audit for a canonical component as an array of Implementation records (componentId, libraryId, componentName, exampleCode, divergence list, rationale, lastReviewed). Returns an empty array when no library has audited this component yet.',
      inputSchema: z.strictObject({ componentId: componentIdField }),
      annotations: READ_ONLY,
    },
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

  server.registerTool(
    'list_patterns',
    {
      title: 'List Patterns',
      description:
        'List every canonical pattern with id, name, description, lastReviewed, and the canonical componentIds it composes. Patterns are compositions on top of canonical atomic components — login forms, confirmation flows, empty states, settings pages.',
      annotations: READ_ONLY,
    },
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

  server.registerTool(
    'get_pattern',
    {
      title: 'Get Pattern',
      description:
        'Return the full canonical definition for one pattern (composition, whenToUse, decisions, mistakes, frameworkSkeletons, lastReviewed). Returns an error result for unknown ids.',
      inputSchema: z.strictObject({
        id: z
          .string()
          .min(1)
          .describe("Canonical pattern id, e.g. 'login-form'. Call list_patterns for valid ids."),
      }),
      outputSchema: patternOutput,
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getPatterns();
      const p = map.get(id);
      if (!p) return notFoundResult('pattern', id, 'Call list_patterns to see valid pattern ids.');
      return objectResult(p as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_patterns_for_component',
    {
      title: 'Get Patterns For Component',
      description:
        'Return every pattern that composes the given canonical component, sorted by pattern name. Each entry reports the pattern id, name, description, the role this component plays in the composition, and any composition-specific notes. Returns an empty array when no pattern uses the component.',
      inputSchema: z.strictObject({ componentId: componentIdField }),
      annotations: READ_ONLY,
    },
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

  server.registerTool(
    'get_contracts',
    {
      title: 'Get Contracts',
      description:
        'Return the contracts block for a component or pattern: `{ id, kind: "component" | "pattern", contracts: { nonNegotiable[], vocabularyDrift[] } | null }`. `nonNegotiable` is hard-binding rules with `source` (apg | wcag | html-spec | platform | canon), optional `sourceRef`, and a `consequence` describing what breaks on violation. `vocabularyDrift` is per-system attributed naming (Material 3 → Snackbar, Atlassian → Flag, …) with optional notes. Returns `{ contracts: null }` when the entity exists but declares no contracts. Errors when the id resolves to neither a component nor a pattern. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
      inputSchema: z.strictObject({
        id: z
          .string()
          .min(1)
          .describe('A canonical component OR pattern id. Call list_components / list_patterns for valid ids.'),
      }),
      outputSchema: contractsOutput,
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const components = await getComponents();
      const patterns = await getPatterns();
      const c = components.get(id);
      if (c) return objectResult({ id, kind: 'component', contracts: c.contracts ?? null });
      const p = patterns.get(id);
      if (p) return objectResult({ id, kind: 'pattern', contracts: p.contracts ?? null });
      return notFoundResult(
        'component or pattern',
        id,
        'Call list_components or list_patterns to see valid ids.',
      );
    },
  );

  server.registerTool(
    'get_canonical_vocabularies',
    {
      title: 'Get Canonical Vocabularies',
      description:
        'Return the canonical token / motion / breakpoint / property / interactive-state vocabularies that YAML values must draw from, plus the registered sub-anatomy ids (P6-126). Same source the consistency-test enforces. Useful for resolving values like `responsive.breakpoints[].at: "breakpoint.sm"` against the master list, surfacing the allowed enum to a downstream UI, or discovering canonical sub-anatomies an agent can $ref. Returns `{ spacing, radius, color, elevation, typography, motion: { durations, easing }, breakpoint, propertyVocab, propertyBounded, interactiveStates, libraryVersions, severity, severitySynonyms, subAnatomies }`.',
      outputSchema: canonicalVocabulariesOutput,
      annotations: READ_ONLY,
    },
    async () => {
      const subAnatomies = await getSubAnatomies();
      const ids = [...subAnatomies.keys()].sort();
      return objectResult(getCanonicalVocabularies(ids) as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'list_sub_anatomies',
    {
      title: 'List Sub-Anatomies',
      description:
        'List every canonical sub-anatomy (recurring slot pattern referenced by component anatomy `$ref` entries — P6-126 / ADR-030). Today: action-group (button cluster shared by Card, Alert, Modal/Drawer footer). Each row reports id, name, description, slotCount, lastReviewed. Use this tool to discover canonical patterns an agent can reference instead of inlining anatomy.',
      annotations: READ_ONLY,
    },
    async () => {
      const map = await getSubAnatomies();
      const rows = [...map.values()]
        .map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          slotCount: s.slots.length,
          lastReviewed: s.lastReviewed,
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
      return jsonResult(rows);
    },
  );

  server.registerTool(
    'get_sub_anatomy',
    {
      title: 'Get Sub-Anatomy',
      description:
        'Return the full canonical body of one sub-anatomy: id, name, description, slots[] (full anatomy slot definitions), a11y rules (groupRule, focusRule), lastReviewed. P6-126 / ADR-030. Returns an error result for unknown ids. Use this tool when an agent needs the canonical slot pattern (e.g., to render `action-group` slots inside a host component or to validate that an inline anatomy matches the canonical shape).',
      inputSchema: z.strictObject({
        id: z
          .string()
          .min(1)
          .describe("Canonical sub-anatomy id, e.g. 'action-group'. Call list_sub_anatomies for valid ids."),
      }),
      outputSchema: subAnatomyOutput,
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const map = await getSubAnatomies();
      const sub = map.get(id);
      if (!sub)
        return notFoundResult('sub-anatomy', id, 'Call list_sub_anatomies to see valid sub-anatomy ids.');
      return objectResult(sub as unknown as Record<string, unknown>);
    },
  );

  server.registerTool(
    'get_pattern_a11y_aggregate',
    {
      title: 'Get Pattern A11y Aggregate',
      description:
        'Aggregate the a11yAcceptance contract for a pattern by unioning the a11yAcceptance of every canonical component it composes. Returns `{ patternId, componentIds, axeRules (sorted union, deduplicated), keyboardWalk (concat, each entry tagged with sourceComponentId), announcements (concat, each entry tagged with sourceComponentId), axeCoreVersion (single semver if all contributors agree, null if components disagree or none declare a version) }`. Useful for "test this whole pattern with axe-core + Playwright" flows where the agent needs the union of every a11y contract the pattern inherits from its composed components. Pattern-level overrides are not yet a schema feature; this tool is a pure aggregation. Errors if patternId is unknown.',
      inputSchema: z.strictObject({
        patternId: z
          .string()
          .min(1)
          .describe("Canonical pattern id, e.g. 'login-form'. Call list_patterns for valid ids."),
      }),
      outputSchema: patternA11yAggregateOutput,
      annotations: READ_ONLY,
    },
    async ({ patternId }) => {
      const patterns = await getPatterns();
      const pattern = patterns.get(patternId);
      if (!pattern)
        return notFoundResult('pattern', patternId, 'Call list_patterns to see valid pattern ids.');
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
      return objectResult({
        patternId,
        componentIds,
        axeRules,
        keyboardWalk,
        announcements,
        axeCoreVersion,
      });
    },
  );

  server.registerTool(
    'validate_implementation',
    {
      title: 'Validate Implementation',
      description:
        'Heuristic structural conformance check: given component code and a target framework, reports which canonical required slots, variants, properties, and events appear (or are missing) in the code. Framework-aware event-name detection: react = on<PascalCase>, vue = @event / v-on:event / emit("event"), angular = (event), webComponents = bare event-name strings. Substring search only, no parser — false negatives possible on aliased or minified identifiers. NOT a substitute for behavioural assertions: pair with the per-component a11y-fixture endpoint plus a real Playwright + axe-core run.',
      inputSchema: z.strictObject({
        componentId: componentIdField,
        code: z
          .string()
          .min(1)
          .describe('The component source code to check (any of the supported frameworks).'),
        framework: z
          .enum(['react', 'vue', 'angular', 'webComponents'])
          .describe('Target framework — selects the event-name detection heuristic.'),
      }),
      outputSchema: validateImplementationOutput,
      annotations: READ_ONLY,
    },
    async ({ componentId, code, framework }) => {
      const map = await getComponents();
      const c = map.get(componentId);
      if (!c) return notFound(componentId);
      return objectResult(
        validateImplementation({ component: c, code, framework }) as unknown as Record<string, unknown>,
      );
    },
  );

  return server;
}
