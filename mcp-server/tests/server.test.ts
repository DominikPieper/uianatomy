import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer } from '../src/server.js';
import { setAboutPath, setContentDir, setImplementationsDir, setPatternsDir, resetCache } from '../src/data.js';

const here = dirname(fileURLToPath(import.meta.url));
const contentDir = resolve(here, '..', '..', 'content', 'components');
const implementationsDir = resolve(here, '..', '..', 'implementations');
const patternsDir = resolve(here, '..', '..', 'content', 'patterns');
const aboutPath = resolve(here, '..', '..', 'docs', 'about.md');

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
    setAboutPath(aboutPath);
  });

  afterEach(() => {
    resetCache();
    setContentDir(contentDir);
    setImplementationsDir(implementationsDir);
    setPatternsDir(patternsDir);
    setAboutPath(aboutPath);
  });

  it('lists the registered tools', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'get_about',
        'get_anatomy',
        'get_canonical_vocabularies',
        'get_contracts',
        'get_component',
        'get_component_section',
        'get_component_view',
        'get_components',
        'get_implementations',
        'get_mismatches',
        'get_pattern',
        'get_pattern_a11y_aggregate',
        'get_patterns_for_component',
        'get_sub_anatomy',
        'list_components',
        'list_implementations',
        'list_patterns',
        'list_sub_anatomies',
        'search_components',
        'validate_implementation',
      ].sort(),
    );
  });

  it('get_about returns the project framing prose with markdown + summary', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_about', arguments: {} });
    const parsed = parseJson(result as any);
    expect(typeof parsed.markdown).toBe('string');
    expect(parsed.markdown.length).toBeGreaterThan(500);
    expect(parsed.markdown).toContain('# About UI Anatomy');
    expect(parsed.markdown).toContain('best practice');
    expect(typeof parsed.summary).toBe('string');
    expect(parsed.summary).toContain('best-practice convergence');
    expect(parsed.summary).toContain('not as a fixed rule book');
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

  it('search_components surfaces severity-synonym queries via variant alternativeNames (P6-143)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'search_components', arguments: { query: 'danger' } });
    const parsed = parseJson(result as any);
    // Badge / Alert / Toast / Banner each carry an `error` variant whose alternativeNames
    // include `danger`; the haystack scan picks them up directly (no query-side reverse-index).
    const ids = parsed.map((c: any) => c.id);
    expect(ids).toContain('badge');
    expect(ids).toContain('alert');
    expect(ids).toContain('toast');
  });

  it('search_components surfaces warning-alias queries via variant alternativeNames (P6-143)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'search_components', arguments: { query: 'caution' } });
    const parsed = parseJson(result as any);
    const ids = parsed.map((c: any) => c.id);
    // Toast/Alert/Banner/Badge `warning` variants carry `caution` as an alternativeName.
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('badge');
  });

  it('search_components matches per-variant alternativeNames (P6-127 / ADR-031)', async () => {
    const { client } = await connect();
    // `confirm` lives only on Modal.alertdialog.alternativeNames — distinct from the
    // severity-cluster aliases, exercises the variant-alternativeNames haystack path.
    const result = await client.callTool({ name: 'search_components', arguments: { query: 'confirm' } });
    const parsed = parseJson(result as any);
    const ids = parsed.map((c: any) => c.id);
    expect(ids).toContain('modal');
  });

  it('list_components surfaces lastReviewed and stalenessDays (P6-125)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_components', arguments: {} });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    const card = parsed.find((c: any) => c.id === 'card');
    expect(card).toBeDefined();
    expect(card.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof card.stalenessDays === 'number' || card.stalenessDays === null).toBe(true);
    if (typeof card.stalenessDays === 'number') {
      expect(card.stalenessDays).toBeGreaterThanOrEqual(0);
    }
  });

  it('get_component augments with stalenessDays and staleAfter default 90 (P6-125)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'card' } });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('card');
    expect(typeof parsed.stalenessDays === 'number' || parsed.stalenessDays === null).toBe(true);
    expect(parsed.staleAfter).toBe(90);
  });

  it('get_component_section returns slot-keyed token entries for Button', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'button', sections: ['tokens'] },
    });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed.tokens)).toBe(true);
    const root = parsed.tokens.find((s: any) => s.slotId === 'root');
    expect(root?.tokens?.color?.background).toBe('color.accent.bg');
  });

  it('get_component_section returns the modal motion block', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'modal', sections: ['motion'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.motion.easing).toBe('motion.easing.standard');
    expect(parsed.motion.reducedMotionFallback).toBe('instant');
  });

  it('get_component_section returns null motion for components without motion', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'link', sections: ['motion'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.motion).toBeNull();
  });

  it('get_component_section returns the modal breakpoints', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'modal', sections: ['responsive'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.responsive.breakpoints[0].at).toBe('breakpoint.sm');
  });

  it('get_component_section returns null responsive for Button', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'button', sections: ['responsive'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.responsive).toBeNull();
  });

  it('get_component_section returns Modal transitions', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'modal', sections: ['transitions'] },
    });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed.transitions)).toBe(true);
    expect(parsed.transitions.length).toBe(4);
    expect(parsed.transitions[0].from).toBe('closed');
  });

  it('get_component_section returns null transitions for Card', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'card', sections: ['transitions'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.transitions).toBeNull();
  });

  it('get_component_section returns Combobox events with three entries', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'combobox', sections: ['events'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.events.length).toBe(3);
    expect(parsed.events.map((e: any) => e.name)).toContain('selectionChange');
  });

  it('get_component_section returns null events for Link', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'link', sections: ['events'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.events).toBeNull();
  });

  it('get_component_section returns Card whenToUse with vsRelated ids', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'card', sections: ['whenToUse'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.whenToUse.use.length).toBeGreaterThan(0);
    expect(parsed.whenToUse.avoid.length).toBeGreaterThan(0);
    expect(parsed.whenToUse.vsRelated.map((v: any) => v.id)).toEqual(['tile', 'list-item', 'table']);
  });

  it('get_component_section returns multiple sections in one call', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'modal', sections: ['axes', 'frameworkMap', 'mistakes'] },
    });
    const parsed = parseJson(result as any);
    expect(parsed.axes.variants.length).toBeGreaterThan(0);
    expect(parsed.frameworkMap).toBeTruthy();
    expect(Array.isArray(parsed.mistakes)).toBe(true);
    expect(parsed.motion).toBeUndefined();
  });

  it('get_component_section errors on unknown component id', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component_section',
      arguments: { id: 'nope', sections: ['axes'] },
    });
    expect((result as any).isError).toBe(true);
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

  it('list_sub_anatomies returns action-group (P6-126)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_sub_anatomies', arguments: {} });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    const ag = parsed.find((s: any) => s.id === 'action-group');
    expect(ag).toBeTruthy();
    expect(ag.slotCount).toBe(3);
    expect(ag.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('list_sub_anatomies returns close-button (P6-147 / ADR-032)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_sub_anatomies', arguments: {} });
    const parsed = parseJson(result as any);
    const cb = parsed.find((s: any) => s.id === 'close-button');
    expect(cb).toBeTruthy();
    expect(cb.slotCount).toBe(3);
    expect(cb.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // P6-148: enforce that the listing now contains all three canonical
    // sub-anatomies so a regression that loses one is caught here.
    expect(parsed.length).toBeGreaterThanOrEqual(3);
  });

  it('list_sub_anatomies returns header-bar (P6-148 / ADR-033)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_sub_anatomies', arguments: {} });
    const parsed = parseJson(result as any);
    const hb = parsed.find((s: any) => s.id === 'header-bar');
    expect(hb).toBeTruthy();
    expect(hb.slotCount).toBe(2);
    expect(hb.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('get_sub_anatomy returns full action-group body (P6-126)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_sub_anatomy',
      arguments: { id: 'action-group' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('action-group');
    expect(parsed.slots.map((s: any) => s.id)).toEqual([
      'primary-action',
      'secondary-action',
      'tertiary-action',
    ]);
    expect(parsed.a11y.groupRule).toContain('primary');
  });

  it('get_sub_anatomy returns full close-button body (P6-147 / ADR-032)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_sub_anatomy',
      arguments: { id: 'close-button' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('close-button');
    expect(parsed.slots.map((s: any) => s.id)).toEqual([
      'close-button',
      'close-icon',
      'close-label',
    ]);
    // close-icon is decorative; close-label is the accessible-name carrier
    const icon = parsed.slots.find((s: any) => s.id === 'close-icon');
    const label = parsed.slots.find((s: any) => s.id === 'close-label');
    expect(icon.slotKind).toBe('decorative');
    expect(label.slotKind).toBe('content');
    // a11y rules surface the WCAG 4.1.2 / icon-button-name canon structurally
    expect(parsed.a11y.groupRule).toContain('accessible-name');
    expect(parsed.a11y.focusRule).toContain('Escape');
  });

  it('get_sub_anatomy returns full header-bar body (P6-148 / ADR-033)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_sub_anatomy',
      arguments: { id: 'header-bar' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('header-bar');
    expect(parsed.slots.map((s: any) => s.id)).toEqual(['header', 'title']);
    // header is a wrapper region, NOT a heading; title carries the heading
    const header = parsed.slots.find((s: any) => s.id === 'header');
    const title = parsed.slots.find((s: any) => s.id === 'title');
    expect(header.slotKind).toBe('structural');
    expect(header.code.semantic).toBe('heading-region');
    expect(title.slotKind).toBe('content');
    expect(title.code.semantic).toBe('heading');
    // a11y rules surface the APG region-vs-heading canon structurally
    expect(parsed.a11y.groupRule).toContain('aria-labelledby');
  });

  it('list_sub_anatomies returns icon-leading-text (P6-149 / ADR-034)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'list_sub_anatomies', arguments: {} });
    const parsed = parseJson(result as any);
    const ilt = parsed.find((s: any) => s.id === 'icon-leading-text');
    expect(ilt).toBeTruthy();
    expect(ilt.slotCount).toBe(3);
    expect(ilt.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('get_sub_anatomy returns full icon-leading-text body (P6-149 / ADR-034)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_sub_anatomy',
      arguments: { id: 'icon-leading-text' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('icon-leading-text');
    expect(parsed.slots.map((s: any) => s.id)).toEqual([
      'icon-leading',
      'label',
      'icon-trailing',
    ]);
    // icons are decorative; label is the accessible-name carrier
    const iconLeading = parsed.slots.find((s: any) => s.id === 'icon-leading');
    const label = parsed.slots.find((s: any) => s.id === 'label');
    const iconTrailing = parsed.slots.find((s: any) => s.id === 'icon-trailing');
    expect(iconLeading.slotKind).toBe('decorative');
    expect(iconLeading.required).toBe(false);
    expect(label.slotKind).toBe('content');
    expect(label.required).toBe(true);
    expect(iconTrailing.slotKind).toBe('decorative');
    expect(iconTrailing.required).toBe(false);
    // a11y groupRule names the icon-text accessible-name contract
    expect(parsed.a11y.groupRule).toContain('accessible name');
  });

  // P6-150 resolution tests use slot-id fingerprinting because the bundle
  // strips the non-enumerable `__subAnatomy` provenance (P6-126b: only the
  // site's content.config.ts lifts it), and resolveAnatomyRefs applies the
  // $ref-level `parent` only to the first sub-anatomy slot (subsequent
  // slots live in the sub-anatomy's local row grid). Slot ids
  // `icon-leading` / `label` / `icon-trailing` are themselves unambiguous
  // evidence of icon-leading-text resolution.
  it('Tab resolves icon-leading-text $ref under the tab slot (P6-150)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'tabs' } });
    const parsed = parseJson(result as any);
    const ids = parsed.anatomy.map((s: any) => s.id);
    // Full 3-slot resolution — Tab uses no `omitted`-overrides
    expect(ids).toContain('icon-leading');
    expect(ids).toContain('label');
    expect(ids).toContain('icon-trailing');
    // First sub-anatomy slot is parented to the host (tab); rest live in
    // the sub-anatomy's local grid.
    const iconLeading = parsed.anatomy.find((s: any) => s.id === 'icon-leading');
    expect(iconLeading.layout?.parent).toBe('tab');
  });

  it('Breadcrumb-item resolves icon-leading-text $ref with omitted icon-trailing (P6-150)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_component',
      arguments: { id: 'breadcrumbs' },
    });
    const parsed = parseJson(result as any);
    const ids = parsed.anatomy.map((s: any) => s.id);
    // First variable-arity exercise: icon-trailing omitted, icon-leading + label resolved
    expect(ids).toContain('icon-leading');
    expect(ids).toContain('label');
    // The omitted slot must be skipped entirely (not just hidden) — but
    // breadcrumbs already has its own `icon-trailing`-bearing peers
    // (separator, overflow-collapse) so we filter to the resolved-from-ref
    // ones via the inline-only set.
    const iconLeading = parsed.anatomy.find((s: any) => s.id === 'icon-leading');
    expect(iconLeading.layout?.parent).toBe('link');
  });

  it('Badge resolves icon-leading-text $ref with content→label rename + omitted icon-trailing (P6-150)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'badge' } });
    const parsed = parseJson(result as any);
    const ids = parsed.anatomy.map((s: any) => s.id);
    // Sub-anatomy resolution: icon-leading + label present, icon-trailing omitted
    expect(ids).toContain('icon-leading');
    expect(ids).toContain('label');
    expect(ids).not.toContain('icon-trailing');
    // Old `content` slot id must not exist anymore — sub-anatomy carries `label`
    expect(ids).not.toContain('content');
  });

  it('Link resolves icon-leading-text $ref with omitted icon-leading + keeps visited-marker inline (P6-150)', async () => {
    const { client } = await connect();
    const result = await client.callTool({ name: 'get_component', arguments: { id: 'link' } });
    const parsed = parseJson(result as any);
    const ids = parsed.anatomy.map((s: any) => s.id);
    // Trailing-only resolution: icon-leading omitted, label + icon-trailing resolved
    expect(ids).toContain('label');
    expect(ids).toContain('icon-trailing');
    expect(ids).not.toContain('icon-leading');
    // visited-marker stays inline (decorative root-level slot, not part of icon-leading-text)
    expect(ids).toContain('visited-marker');
  });

  it('get_sub_anatomy errors on unknown id', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_sub_anatomy',
      arguments: { id: 'nope' },
    });
    expect((result as any).isError).toBe(true);
  });

  it('get_canonical_vocabularies includes subAnatomies id list (P6-126)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_canonical_vocabularies',
      arguments: {},
    });
    const parsed = parseJson(result as any);
    expect(parsed.subAnatomies).toContain('action-group');
    expect(parsed.subAnatomies).toContain('close-button');
    expect(parsed.subAnatomies).toContain('header-bar');
    expect(parsed.subAnatomies).toContain('icon-leading-text');
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

  it('list_implementations({ componentId }) filters to that component only', async () => {
    const { client } = await connect();
    const modalRes = await client.callTool({
      name: 'list_implementations',
      arguments: { componentId: 'modal' },
    });
    const modalRows = parseJson(modalRes as any);
    expect(modalRows.length).toBe(3);
    for (const row of modalRows) expect(row.componentId).toBe('modal');

    const buttonRes = await client.callTool({
      name: 'list_implementations',
      arguments: { componentId: 'button' },
    });
    const buttonRows = parseJson(buttonRes as any);
    expect(buttonRows.length).toBe(3);
    for (const row of buttonRows) expect(row.componentId).toBe('button');
    const buttonLibs = buttonRows.map((r: any) => r.libraryId).sort();
    expect(buttonLibs).toEqual(['headlessui', 'radix', 'react-aria']);
  });

  it('list_implementations({ libraryId }) filters to that library only', async () => {
    const { client } = await connect();
    const radixRes = await client.callTool({
      name: 'list_implementations',
      arguments: { libraryId: 'radix' },
    });
    const radixRows = parseJson(radixRes as any);
    expect(radixRows.length).toBe(12);
    expect(radixRows.every((r: any) => r.libraryId === 'radix')).toBe(true);
    const componentIds = radixRows.map((r: any) => r.componentId).sort();
    expect(componentIds).toEqual([
      'accordion',
      'alert',
      'avatar',
      'badge',
      'button',
      'card',
      'checkbox',
      'combobox',
      'disclosure',
      'modal',
      'select',
      'tabs',
    ]);
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

  it('get_implementations(button) returns all three library audits', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_implementations',
      arguments: { componentId: 'button' },
    });
    const parsed = parseJson(result as any);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(3);
    for (const impl of parsed) {
      expect(impl.componentId).toBe('button');
      expect(['radix', 'headlessui', 'react-aria']).toContain(impl.libraryId);
      expect(impl.componentName).toBeTypeOf('string');
      expect(impl.lastReviewed).toBeTypeOf('string');
    }
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

  it('get_contracts returns accordion nonNegotiable entries (component path)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_contracts',
      arguments: { id: 'accordion' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('accordion');
    expect(parsed.kind).toBe('component');
    expect(parsed.contracts.nonNegotiable.length).toBeGreaterThanOrEqual(2);
    for (const c of parsed.contracts.nonNegotiable) expect(c.source).toBe('apg');
  });

  it('get_contracts returns confirmation-flow contracts (pattern path)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_contracts',
      arguments: { id: 'confirmation-flow' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('confirmation-flow');
    expect(parsed.kind).toBe('pattern');
    const rules = parsed.contracts.nonNegotiable.map((c: any) => c.rule);
    expect(rules.some((r: string) => r.includes('alertdialog'))).toBe(true);
  });

  it('get_contracts returns null contracts for components without a block', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_contracts',
      arguments: { id: 'button' },
    });
    const parsed = parseJson(result as any);
    expect(parsed.id).toBe('button');
    expect(parsed.kind).toBe('component');
    expect(parsed.contracts).toBeNull();
  });

  it('get_contracts errors on unknown id (neither component nor pattern)', async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'get_contracts',
      arguments: { id: 'definitely-not-anything' },
    });
    expect((result as any).isError).toBe(true);
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
      name: 'get_component_section',
      arguments: { id: 'modal', sections: ['motion'] },
    });
    const motion = parseJson(motionResult as any).motion;
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

  it('get_pattern_a11y_aggregate axeRules = sorted union of composition components (roundtrip)', async () => {
    const { client } = await connect();
    const patternIds = ['confirmation-flow', 'login-form'];
    for (const patternId of patternIds) {
      const aggregateRes = await client.callTool({
        name: 'get_pattern_a11y_aggregate',
        arguments: { patternId },
      });
      const aggregate = parseJson(aggregateRes as any);

      const patternRes = await client.callTool({
        name: 'get_pattern',
        arguments: { id: patternId },
      });
      const pattern = parseJson(patternRes as any);

      const expected = new Set<string>();
      const seen = new Set<string>();
      for (const composition of pattern.composition) {
        if (seen.has(composition.componentId)) continue;
        seen.add(composition.componentId);
        const compRes = await client.callTool({
          name: 'get_component',
          arguments: { id: composition.componentId },
        });
        const comp = parseJson(compRes as any);
        for (const rule of comp.a11yAcceptance?.axeRules ?? []) {
          expected.add(rule);
        }
      }
      const expectedSorted = [...expected].sort();
      expect(aggregate.axeRules, `pattern=${patternId}`).toEqual(expectedSorted);
    }
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

// mcp-builder best-practice conformance (skill reference/mcp_best_practices.md
// + node_mcp_server.md quality checklist).
describe('mcp best-practices', () => {
  beforeAll(() => {
    setContentDir(contentDir);
    setImplementationsDir(implementationsDir);
    setPatternsDir(patternsDir);
    setAboutPath(aboutPath);
  });

  afterEach(() => {
    resetCache();
    setContentDir(contentDir);
    setImplementationsDir(implementationsDir);
    setPatternsDir(patternsDir);
    setAboutPath(aboutPath);
  });

  // Tools that return a stable non-null object carry an outputSchema and must
  // return structuredContent. The rest are content-only by design.
  const OBJECT_TOOLS = new Set([
    'get_about',
    'get_component',
    'get_components',
    'get_component_view',
    'get_contracts',
    'get_canonical_vocabularies',
    'get_pattern',
    'get_sub_anatomy',
    'get_pattern_a11y_aggregate',
    'validate_implementation',
  ]);

  it('every tool has a title, a description, and read-only annotations', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    expect(tools.length).toBe(20);
    for (const t of tools) {
      expect(t.title, `${t.name} title`).toBeTypeOf('string');
      expect((t.title as string).length, `${t.name} title non-empty`).toBeGreaterThan(0);
      expect((t.description ?? '').length, `${t.name} description`).toBeGreaterThan(20);
      expect(t.annotations, `${t.name} annotations`).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it('object-returning tools declare an outputSchema; the rest do not', async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    for (const t of tools) {
      if (OBJECT_TOOLS.has(t.name)) {
        expect(t.outputSchema, `${t.name} should have outputSchema`).toBeDefined();
      } else {
        expect(t.outputSchema, `${t.name} should be content-only`).toBeUndefined();
      }
    }
  });

  it('object-returning tools return structuredContent matching the text content', async () => {
    const { client } = await connect();
    const result = (await client.callTool({
      name: 'get_component',
      arguments: { id: 'modal' },
    })) as any;
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent.id).toBe('modal');
    // structuredContent and the text block must agree.
    expect(result.structuredContent).toEqual(parseJson(result));
  });

  it('strict input schemas reject unknown arguments', async () => {
    const { client } = await connect();
    const result = (await client
      .callTool({ name: 'get_component', arguments: { id: 'modal', bogus: 1 } })
      .catch((err: unknown) => ({ isError: true, _threw: String(err) }))) as any;
    expect(result.isError).toBe(true);
  });

  it('not-found errors name a recovery tool', async () => {
    const { client } = await connect();
    const result = (await client.callTool({
      name: 'get_component',
      arguments: { id: 'does-not-exist' },
    })) as any;
    expect(result.isError).toBe(true);
    const text = result.content.find((c: any) => c.type === 'text')?.text ?? '';
    expect(text).toContain('list_components');

    const patternMiss = (await client.callTool({
      name: 'get_pattern',
      arguments: { id: 'nope' },
    })) as any;
    expect(patternMiss.isError).toBe(true);
    expect(patternMiss.content.find((c: any) => c.type === 'text')?.text).toContain('list_patterns');
  });

  it('search_components honours the limit parameter', async () => {
    const { client } = await connect();
    const all = parseJson(
      (await client.callTool({ name: 'search_components', arguments: { query: 'e' } })) as any,
    );
    expect(all.length).toBeGreaterThan(2);
    const limited = parseJson(
      (await client.callTool({
        name: 'search_components',
        arguments: { query: 'e', limit: 2 },
      })) as any,
    );
    expect(limited.length).toBe(2);
    expect(limited).toEqual(all.slice(0, 2));
  });
});
