import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getComponents, getImplementations, getPatterns, getSubAnatomies } from './state.js';
import type { Component } from '@uianatomy/shared/schema';
import { validateImplementation } from '@uianatomy/shared/validate';
import { getCanonicalVocabularies, SEVERITY_SYNONYMS } from '@uianatomy/shared/vocabulary';

// P6-118b: reverse-index for severity-synonym query expansion.
// "danger" → "error", "destructive" → "error", "caution" → "warning", etc.
// Built once at module-load; never mutated.
const SEVERITY_SYNONYM_REVERSE: Readonly<Record<string, string>> = (() => {
  const r: Record<string, string> = {};
  for (const [canonical, synonyms] of Object.entries(SEVERITY_SYNONYMS)) {
    for (const s of synonyms) r[s.toLowerCase()] = canonical;
  }
  return r;
})();

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

export function createServer(): McpServer {
  const server = new McpServer({ name: 'uianatomy', version: '0.0.0' });

  server.tool(
    'list_components',
    'List all canonical components by id, name, description, lastReviewed date, and derived stalenessDays (days since lastReviewed; null when lastReviewed is omitted). Agents should treat stalenessDays > component.staleAfter (default 90 days) as a signal to verify the canonical claims against current upstream sources before relying on them.',
    {},
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

  server.tool(
    'get_component',
    'Return the full canonical definition for a component, augmented with derived `stalenessDays` (days since lastReviewed; null when lastReviewed is omitted) and `staleAfter` (canonical staleness threshold in days; default 90 when omitted). Agents compare stalenessDays vs staleAfter to decide whether to verify claims against upstream sources before relying on them.',
    { id: z.string() },
    async ({ id }) => {
      const map = await getComponents();
      const c = map.get(id);
      if (!c) return notFound(id);
      return jsonResult({
        ...c,
        stalenessDays: computeStalenessDays(c.lastReviewed),
        staleAfter: c.staleAfter ?? 90,
      });
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
    'Return only the anatomy section (slot/region definitions) for a component. Slice tool — use for narrow round-trip needs (e.g. anatomy-only review). For full-record audits prefer `get_component`.',
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
    'Return only variants/properties/states for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return only the Figma↔Code mismatches for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return only the documented common implementation mistakes for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the cross-framework expression map for a component. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the per-slot token bindings (spacing/radius/color/elevation/typography) for a component. Slots without tokens are omitted from the result. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the motion block (durations/easing/reducedMotionFallback) for a component. Returns null when the component declares no motion. Slice tool — use for narrow round-trip needs (e.g. motion-only review across multiple components). For full-record audits prefer `get_component`.',
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
    'Return the responsive block (breakpoints) for a component. Returns null when the component declares no responsive behaviour. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the state-machine transitions (from/to/trigger) for a component. Returns null when the component declares no transitions. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the events array (name/payload/per-framework notes) for a component. Returns null when the component declares no events. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the versioning block (since + changelog entries) for a component. Returns null when the component declares no version metadata (today no canonical component declares either; this surface activates when a component lands its first published rename / mistake-correction / canonical-name-change and the editor bumps `since` + appends a changelog entry per docs/methodology.md). Each changelog entry is { version (semver), date (ISO YYYY-MM-DD), summary }. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Return the whenToUse block (use/avoid prose plus per-related differentiators) for a component. Returns null when the component declares no whenToUse. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
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
    'Case-insensitive substring search across component id, name, description, anatomy slot ids, variant names, and referenced sub-anatomy ids (P6-126). Severity synonyms expand transparently — `search_components({ query: "danger" })` resolves via SEVERITY_SYNONYMS to also match the canonical `error` variant on Alert / Toast / Badge. Synonym map covers `error: [danger, destructive, critical]` and `warning: [caution, attention]`. Sub-anatomy ids are matched too — `search_components({ query: "action-group" })` returns Card / Alert / Modal / Drawer. Plain queries that are not synonyms behave unchanged.',
    { query: z.string().min(1) },
    async ({ query }) => {
      const map = await getComponents();
      const q = query.toLowerCase();
      const expanded = [q];
      const canonical = SEVERITY_SYNONYM_REVERSE[q];
      if (canonical && !expanded.includes(canonical)) expanded.push(canonical);
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
            c.axes.variants.join(' ') +
            ' ' +
            [...subAnatomyIds].join(' ')
          ).toLowerCase();
          return expanded.some((term) => haystack.includes(term));
        })
        .map((c) => ({ id: c.id, name: c.name, description: c.description }));
      return jsonResult(matches);
    },
  );

  server.tool(
    'list_implementations',
    'List every Phase-2 library audit (one entry per library/component pair) with library id, component id, library-specific component name, divergence count, and last-reviewed date. Sorted by libraryId then componentId. Optional `componentId` filter narrows the roster to a single canonical component (returns an empty array when no audits exist for that component); optional `libraryId` filter narrows to a single library. Use this tool for the lightweight summary-row shape; use `get_implementations({ componentId })` to get full Implementation records (exampleCode + divergence list + rationale). Today the roster covers Modal × {radix, headlessui, cdk}; other components have no audits yet.',
    {
      componentId: z.string().optional(),
      libraryId: z.string().optional(),
    },
    async ({ componentId, libraryId }) => {
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
    'get_contracts',
    'Return the contracts block for a component or pattern: `{ id, kind: "component" | "pattern", contracts: { nonNegotiable[], vocabularyDrift[] } | null }`. `nonNegotiable` is hard-binding rules with `source` (apg | wcag | html-spec | platform | canon), optional `sourceRef`, and a `consequence` describing what breaks on violation. `vocabularyDrift` is per-system attributed naming (Material 3 → Snackbar, Atlassian → Flag, …) with optional notes. Returns `{ contracts: null }` when the entity exists but declares no contracts. Errors when the id resolves to neither a component nor a pattern. Slice tool — use for narrow round-trip needs. For full-record audits prefer `get_component`.',
    { id: z.string() },
    async ({ id }) => {
      const components = await getComponents();
      const patterns = await getPatterns();
      const c = components.get(id);
      if (c) return jsonResult({ id, kind: 'component' as const, contracts: c.contracts ?? null });
      const p = patterns.get(id);
      if (p) return jsonResult({ id, kind: 'pattern' as const, contracts: p.contracts ?? null });
      return notFound(id);
    },
  );

  server.tool(
    'get_canonical_vocabularies',
    'Return the canonical token / motion / breakpoint / property / interactive-state vocabularies that YAML values must draw from, plus the registered sub-anatomy ids (P6-126). Same source the consistency-test enforces. Useful for resolving values like `responsive.breakpoints[].at: "breakpoint.sm"` against the master list, surfacing the allowed enum to a downstream UI, or discovering canonical sub-anatomies an agent can $ref. Returns `{ spacing, radius, color, elevation, typography, motion: { durations, easing }, breakpoint, propertyVocab, propertyBounded, interactiveStates, libraryVersions, severity, severitySynonyms, subAnatomies }`.',
    {},
    async () => {
      const subAnatomies = await getSubAnatomies();
      const ids = [...subAnatomies.keys()].sort();
      return jsonResult(getCanonicalVocabularies(ids));
    },
  );

  server.tool(
    'list_sub_anatomies',
    'List every canonical sub-anatomy (recurring slot pattern referenced by component anatomy `$ref` entries — P6-126 / ADR-030). Today: action-group (button cluster shared by Card, Alert, Modal/Drawer footer). Each row reports id, name, description, slotCount, lastReviewed. Use this tool to discover canonical patterns an agent can reference instead of inlining anatomy.',
    {},
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

  server.tool(
    'get_sub_anatomy',
    'Return the full canonical body of one sub-anatomy: id, name, description, slots[] (full anatomy slot definitions), a11y rules (groupRule, focusRule), lastReviewed. P6-126 / ADR-030. Returns an error result for unknown ids. Use this tool when an agent needs the canonical slot pattern (e.g., to render `action-group` slots inside a host component or to validate that an inline anatomy matches the canonical shape).',
    { id: z.string() },
    async ({ id }) => {
      const map = await getSubAnatomies();
      const sub = map.get(id);
      if (!sub) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `No sub-anatomy found with id "${id}".` }],
        };
      }
      return jsonResult(sub);
    },
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
