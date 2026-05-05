import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  anatomySlotRefSchema,
  subAnatomyOverrideSchema,
  subAnatomySchema,
  type AnatomySlot,
  type AnatomySlotRef,
  type SubAnatomy,
} from '../src/schema.js';
import {
  SubAnatomyResolutionError,
  loadSubAnatomies,
  loadSubAnatomy,
  resolveAnatomyRefs,
} from '../src/loader.js';

const here = dirname(fileURLToPath(import.meta.url));
const subAnatomiesDir = join(here, '..', '..', 'content', 'sub-anatomies');

const fixtureSlot = (id: string, overrides: Partial<AnatomySlot> = {}): AnatomySlot => ({
  id,
  required: true,
  purpose: `purpose for ${id}`,
  layout: { row: 1, col: 1, span: 1 },
  figma: { type: 'instance', hint: `figma hint for ${id}` },
  code: { slot: id, semantic: 'button' },
  a11y: { hint: `a11y hint for ${id}` },
  slotKind: 'interactive',
  ...overrides,
});

const fixtureSubAnatomy = (): SubAnatomy => ({
  id: 'action-group',
  name: 'Action Group',
  description: 'horizontal cluster of one to three buttons',
  lastReviewed: '2026-05-05',
  a11y: {
    groupRule: 'Order primary first in the DOM.',
    focusRule: 'Default focus targets primary-action.',
  },
  slots: [
    fixtureSlot('primary-action'),
    fixtureSlot('secondary-action', { required: false, layout: { row: 1, col: 2, span: 1 } }),
    fixtureSlot('tertiary-action', { required: false, layout: { row: 1, col: 3, span: 1 } }),
  ],
});

describe('subAnatomySchema', () => {
  it('parses a complete sub-anatomy body', () => {
    const result = subAnatomySchema.safeParse(fixtureSubAnatomy());
    expect(result.success).toBe(true);
  });

  it('rejects missing lastReviewed', () => {
    const { lastReviewed, ...rest } = fixtureSubAnatomy();
    const result = subAnatomySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects empty slots array', () => {
    const sub = { ...fixtureSubAnatomy(), slots: [] };
    const result = subAnatomySchema.safeParse(sub);
    expect(result.success).toBe(false);
  });
});

describe('anatomySlotRefSchema', () => {
  it('accepts a bare $ref', () => {
    const result = anatomySlotRefSchema.safeParse({ $ref: 'action-group' });
    expect(result.success).toBe(true);
  });

  it('accepts a $ref with overrides', () => {
    const result = anatomySlotRefSchema.safeParse({
      $ref: 'action-group',
      parent: 'footer',
      overrides: [
        { slot: 'tertiary-action', type: 'omitted', rationale: 'cap at 2' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty overrides array', () => {
    const result = anatomySlotRefSchema.safeParse({
      $ref: 'action-group',
      overrides: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown override type', () => {
    const result = anatomySlotRefSchema.safeParse({
      $ref: 'action-group',
      overrides: [{ slot: 'primary-action', type: 'mutated', rationale: 'x' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty overridden override (no fields to apply)', () => {
    const result = subAnatomyOverrideSchema.safeParse({
      slot: 'primary-action',
      type: 'overridden',
      rationale: 'x',
    });
    expect(result.success).toBe(false);
  });
});

describe('resolveAnatomyRefs', () => {
  const sub = fixtureSubAnatomy();
  const subs = new Map([[sub.id, sub]]);

  it('flattens a bare $ref to all sub-anatomy slots', () => {
    const ref: AnatomySlotRef = { $ref: 'action-group' };
    const out = resolveAnatomyRefs([ref], subs);
    expect(out.map((s) => s.id)).toEqual([
      'primary-action',
      'secondary-action',
      'tertiary-action',
    ]);
  });

  it('preserves inline slots verbatim', () => {
    const inline = fixtureSlot('container');
    const out = resolveAnatomyRefs([inline], subs);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('container');
  });

  it('omitted override drops the slot', () => {
    const ref: AnatomySlotRef = {
      $ref: 'action-group',
      overrides: [
        { slot: 'tertiary-action', type: 'omitted', rationale: 'cap at 2' },
      ],
    };
    const out = resolveAnatomyRefs([ref], subs);
    expect(out.map((s) => s.id)).toEqual(['primary-action', 'secondary-action']);
  });

  it('renamed override changes id', () => {
    const ref: AnatomySlotRef = {
      $ref: 'action-group',
      overrides: [
        { slot: 'primary-action', type: 'renamed', to: 'commit-button', rationale: 'host name' },
      ],
    };
    const out = resolveAnatomyRefs([ref], subs);
    expect(out[0].id).toBe('commit-button');
  });

  it('renamed override updates sibling layout.parent references', () => {
    const subWithChild: SubAnatomy = {
      ...fixtureSubAnatomy(),
      slots: [
        fixtureSlot('group-root'),
        fixtureSlot('child', { layout: { parent: 'group-root', row: 1, col: 1, span: 1 } }),
      ],
    };
    const localSubs = new Map([[subWithChild.id, subWithChild]]);
    const ref: AnatomySlotRef = {
      $ref: 'action-group',
      overrides: [
        { slot: 'group-root', type: 'renamed', to: 'wrapper', rationale: 'host' },
      ],
    };
    const out = resolveAnatomyRefs([ref], localSubs);
    const child = out.find((s) => s.id === 'child');
    expect(child?.layout.parent).toBe('wrapper');
  });

  it('overridden merges fields shallowly and tokens deeply', () => {
    const ref: AnatomySlotRef = {
      $ref: 'action-group',
      overrides: [
        {
          slot: 'primary-action',
          type: 'overridden',
          rationale: 'host customisation',
          a11y: { hint: 'overridden a11y' },
          layout: { row: 5 },
          tokens: { spacing: { padding: 'spacing.compact' } },
        },
      ],
    };
    const out = resolveAnatomyRefs([ref], subs);
    const primary = out[0];
    expect(primary.a11y.hint).toBe('overridden a11y');
    expect(primary.layout.row).toBe(5);
    expect(primary.layout.col).toBe(1);  // base preserved
    expect(primary.tokens?.spacing?.padding).toBe('spacing.compact');
  });

  it('ref-level parent is applied to resolved root slot', () => {
    const ref: AnatomySlotRef = { $ref: 'action-group', parent: 'footer' };
    const out = resolveAnatomyRefs([ref], subs);
    expect(out[0].layout.parent).toBe('footer');
  });

  it('unknown $ref id throws SubAnatomyResolutionError', () => {
    const ref: AnatomySlotRef = { $ref: 'nonexistent' };
    expect(() => resolveAnatomyRefs([ref], subs)).toThrow(SubAnatomyResolutionError);
  });

  it('override targeting unknown slot throws', () => {
    const ref: AnatomySlotRef = {
      $ref: 'action-group',
      overrides: [{ slot: 'fourth-action', type: 'omitted', rationale: 'x' }],
    };
    expect(() => resolveAnatomyRefs([ref], subs)).toThrow(SubAnatomyResolutionError);
  });

  it('all-omitted ref throws (zero resolved slots)', () => {
    const ref: AnatomySlotRef = {
      $ref: 'action-group',
      overrides: [
        { slot: 'primary-action', type: 'omitted', rationale: 'x' },
        { slot: 'secondary-action', type: 'omitted', rationale: 'x' },
        { slot: 'tertiary-action', type: 'omitted', rationale: 'x' },
      ],
    };
    expect(() => resolveAnatomyRefs([ref], subs)).toThrow(SubAnatomyResolutionError);
  });

  it('resolved slot id collision with inline slot throws', () => {
    const inline = fixtureSlot('primary-action');
    const ref: AnatomySlotRef = { $ref: 'action-group' };
    expect(() => resolveAnatomyRefs([inline, ref], subs)).toThrow(SubAnatomyResolutionError);
  });

  it('attaches non-enumerable __subAnatomy provenance', () => {
    const ref: AnatomySlotRef = { $ref: 'action-group' };
    const out = resolveAnatomyRefs([ref], subs);
    const desc = Object.getOwnPropertyDescriptor(out[0], '__subAnatomy');
    expect(desc?.enumerable).toBe(false);
    expect(desc?.value).toEqual({ id: 'action-group', slot: 'primary-action' });
  });

  it('provenance survives JSON round-trip as expected (invisible)', () => {
    const ref: AnatomySlotRef = { $ref: 'action-group' };
    const out = resolveAnatomyRefs([ref], subs);
    const round = JSON.parse(JSON.stringify(out[0]));
    expect('__subAnatomy' in round).toBe(false);
  });
});

describe('action-group YAML', () => {
  it('loadSubAnatomy parses content/sub-anatomies/action-group.yaml', async () => {
    const sub = await loadSubAnatomy(join(subAnatomiesDir, 'action-group.yaml'));
    expect(sub.id).toBe('action-group');
    expect(sub.name).toBe('Action Group');
    expect(sub.slots.map((s) => s.id)).toEqual([
      'primary-action',
      'secondary-action',
      'tertiary-action',
    ]);
    expect(sub.a11y?.groupRule).toContain('primary');
    expect(sub.a11y?.focusRule).toContain('primary');
  });

  it('loadSubAnatomies returns a map with action-group keyed by id', async () => {
    const map = await loadSubAnatomies({ subAnatomiesDir });
    expect(map.has('action-group')).toBe(true);
    expect(map.size).toBeGreaterThanOrEqual(1);
  });
});
