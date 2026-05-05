import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';
import {
  componentSchema,
  implementationSchema,
  patternSchema,
  subAnatomySchema,
  type AnatomySlot,
  type AnatomySlotRef,
  type Component,
  type Implementation,
  type LayoutHint,
  type Pattern,
  type ResolvedAnatomySlot,
  type SlotTokens,
  type SubAnatomy,
  type SubAnatomyOverride,
} from './schema.js';

export interface LoaderOptions {
  contentDir: string;
  // P6-126 / ADR-030 — when supplied, `$ref` entries in component anatomy
  // are resolved eagerly. When omitted, any component using `$ref` will
  // throw a clear error.
  subAnatomies?: Map<string, SubAnatomy>;
  subAnatomiesDir?: string;
}

export interface ImplementationLoaderOptions {
  implementationsDir: string;
}

export interface PatternLoaderOptions {
  patternsDir: string;
}

export class PatternValidationError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: unknown,
  ) {
    super(`Pattern validation failed: ${file}`);
    this.name = 'PatternValidationError';
  }
}

export class ComponentValidationError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: unknown,
  ) {
    super(`Component validation failed: ${file}`);
    this.name = 'ComponentValidationError';
  }
}

export class ImplementationValidationError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: unknown,
  ) {
    super(`Implementation validation failed: ${file}`);
    this.name = 'ImplementationValidationError';
  }
}

export async function loadComponent(
  filePath: string,
  subAnatomies?: Map<string, SubAnatomy>,
): Promise<Component> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const result = componentSchema.safeParse(parsed);
  if (!result.success) {
    throw new ComponentValidationError(filePath, result.error.format());
  }
  const data = result.data;
  const rawAnatomy = data.anatomy as Array<AnatomySlot | AnatomySlotRef>;
  const hasRef = rawAnatomy.some((entry) => typeof (entry as AnatomySlotRef).$ref === 'string');
  if (hasRef) {
    let resolvedSubs = subAnatomies;
    if (!resolvedSubs) {
      // P6-126 / ADR-030 — auto-resolve sibling sub-anatomies dir
      // (`<contentDir>/../sub-anatomies/`) when none supplied.
      const sibling = join(dirname(dirname(filePath)), 'sub-anatomies');
      try {
        const s = await stat(sibling);
        if (s.isDirectory()) {
          resolvedSubs = await loadSubAnatomies({ subAnatomiesDir: sibling });
        }
      } catch {
        // sibling missing — fall through to clear error below
      }
    }
    if (!resolvedSubs) {
      throw new ComponentValidationError(
        filePath,
        `Component uses anatomy $ref entries but no sub-anatomies map was supplied to loadComponent and no sibling sub-anatomies/ directory was found`,
      );
    }
    const resolvedAnatomy = resolveAnatomyRefs(rawAnatomy, resolvedSubs);
    return { ...data, anatomy: resolvedAnatomy } as Component;
  }
  return { ...data, anatomy: rawAnatomy as ResolvedAnatomySlot[] } as Component;
}

export async function loadComponents(
  options: LoaderOptions,
): Promise<Map<string, Component>> {
  const { contentDir } = options;
  let subAnatomies = options.subAnatomies;
  let subAnatomiesDir = options.subAnatomiesDir;
  // P6-126 / ADR-030 — when neither map nor explicit dir was provided,
  // try a sibling `sub-anatomies/` directory next to contentDir. Silent
  // fallback: components without `$ref` keep working when no sub-anatomies
  // exist; components with `$ref` still error clearly via loadComponent.
  if (!subAnatomies && !subAnatomiesDir) {
    const sibling = join(dirname(contentDir), 'sub-anatomies');
    try {
      const s = await stat(sibling);
      if (s.isDirectory()) subAnatomiesDir = sibling;
    } catch {
      // sibling missing is fine — only matters for components using $ref
    }
  }
  if (!subAnatomies && subAnatomiesDir) {
    subAnatomies = await loadSubAnatomies({ subAnatomiesDir });
  }
  const entries = await readdir(contentDir, { withFileTypes: true });
  const yamls = entries
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => join(contentDir, e.name));
  const components = new Map<string, Component>();
  for (const file of yamls) {
    const component = await loadComponent(file, subAnatomies);
    if (components.has(component.id)) {
      throw new Error(`Duplicate component id "${component.id}" in ${file}`);
    }
    components.set(component.id, component);
  }
  return components;
}

export async function loadImplementation(filePath: string): Promise<Implementation> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const result = implementationSchema.safeParse(parsed);
  if (!result.success) {
    throw new ImplementationValidationError(filePath, result.error.format());
  }
  return result.data;
}

export async function loadImplementations(
  { implementationsDir }: ImplementationLoaderOptions,
): Promise<Map<string, Map<string, Implementation>>> {
  const libDirs = await readdir(implementationsDir, { withFileTypes: true });
  const byLibrary = new Map<string, Map<string, Implementation>>();
  for (const lib of libDirs) {
    if (!lib.isDirectory()) continue;
    const libPath = join(implementationsDir, lib.name);
    const entries = await readdir(libPath, { withFileTypes: true });
    const yamls = entries
      .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
      .map((e) => join(libPath, e.name));
    const components = new Map<string, Implementation>();
    for (const file of yamls) {
      const impl = await loadImplementation(file);
      if (impl.libraryId !== lib.name) {
        throw new Error(
          `Implementation libraryId "${impl.libraryId}" does not match parent directory "${lib.name}" in ${file}`,
        );
      }
      if (components.has(impl.componentId)) {
        throw new Error(
          `Duplicate componentId "${impl.componentId}" in library "${lib.name}" at ${file}`,
        );
      }
      components.set(impl.componentId, impl);
    }
    byLibrary.set(lib.name, components);
  }
  return byLibrary;
}

export async function loadPattern(filePath: string): Promise<Pattern> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const result = patternSchema.safeParse(parsed);
  if (!result.success) {
    throw new PatternValidationError(filePath, result.error.format());
  }
  return result.data;
}

export async function loadPatterns({ patternsDir }: PatternLoaderOptions): Promise<Map<string, Pattern>> {
  const entries = await readdir(patternsDir, { withFileTypes: true });
  const yamls = entries
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => join(patternsDir, e.name));
  const patterns = new Map<string, Pattern>();
  for (const file of yamls) {
    const pattern = await loadPattern(file);
    if (patterns.has(pattern.id)) {
      throw new Error(`Duplicate pattern id "${pattern.id}" in ${file}`);
    }
    patterns.set(pattern.id, pattern);
  }
  return patterns;
}

// ---------------------------------------------------------------------------
// P6-126 / ADR-030 — sub-anatomy loader + resolver
// ---------------------------------------------------------------------------

export interface SubAnatomyLoaderOptions {
  subAnatomiesDir: string;
}

export class SubAnatomyValidationError extends Error {
  constructor(
    public readonly file: string,
    public readonly issues: unknown,
  ) {
    super(`Sub-anatomy validation failed: ${file}`);
    this.name = 'SubAnatomyValidationError';
  }
}

export class SubAnatomyResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubAnatomyResolutionError';
  }
}

export async function loadSubAnatomy(filePath: string): Promise<SubAnatomy> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const result = subAnatomySchema.safeParse(parsed);
  if (!result.success) {
    throw new SubAnatomyValidationError(filePath, result.error.format());
  }
  return result.data;
}

export async function loadSubAnatomies(
  { subAnatomiesDir }: SubAnatomyLoaderOptions,
): Promise<Map<string, SubAnatomy>> {
  const entries = await readdir(subAnatomiesDir, { withFileTypes: true });
  const yamls = entries
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => join(subAnatomiesDir, e.name));
  const subAnatomies = new Map<string, SubAnatomy>();
  for (const file of yamls) {
    const sub = await loadSubAnatomy(file);
    if (subAnatomies.has(sub.id)) {
      throw new Error(`Duplicate sub-anatomy id "${sub.id}" in ${file}`);
    }
    subAnatomies.set(sub.id, sub);
  }
  return subAnatomies;
}

const isAnatomySlotRef = (entry: AnatomySlot | AnatomySlotRef): entry is AnatomySlotRef =>
  typeof (entry as AnatomySlotRef).$ref === 'string';

const cloneSlot = (slot: AnatomySlot): AnatomySlot => JSON.parse(JSON.stringify(slot)) as AnatomySlot;

const mergeLayout = (base: LayoutHint, override: Partial<LayoutHint>): LayoutHint => ({
  ...base,
  ...override,
  floating: override.floating ?? base.floating,
});

const mergeTokens = (base: SlotTokens | undefined, override: SlotTokens | undefined): SlotTokens | undefined => {
  if (!base) return override;
  if (!override) return base;
  return {
    spacing: { ...(base.spacing ?? {}), ...(override.spacing ?? {}) },
    radius: { ...(base.radius ?? {}), ...(override.radius ?? {}) },
    color: { ...(base.color ?? {}), ...(override.color ?? {}) },
    elevation: { ...(base.elevation ?? {}), ...(override.elevation ?? {}) },
    typography: { ...(base.typography ?? {}), ...(override.typography ?? {}) },
  };
};

interface ResolveContext {
  subAnatomyId: string;
  refIndex: number;
}

const resolveOneRef = (
  ref: AnatomySlotRef,
  subAnatomies: Map<string, SubAnatomy>,
  ctx: ResolveContext,
): ResolvedAnatomySlot[] => {
  const sub = subAnatomies.get(ref.$ref);
  if (!sub) {
    throw new SubAnatomyResolutionError(
      `Unknown sub-anatomy "$ref: ${ref.$ref}" at anatomy[${ctx.refIndex}]`,
    );
  }

  const overridesBySlot = new Map<string, SubAnatomyOverride>();
  for (const ov of ref.overrides ?? []) {
    if (overridesBySlot.has(ov.slot)) {
      throw new SubAnatomyResolutionError(
        `Duplicate override for slot "${ov.slot}" in $ref ${ref.$ref}`,
      );
    }
    overridesBySlot.set(ov.slot, ov);
  }

  const knownIds = new Set(sub.slots.map((s) => s.id));
  for (const ovId of overridesBySlot.keys()) {
    if (!knownIds.has(ovId)) {
      throw new SubAnatomyResolutionError(
        `Override targets unknown slot "${ovId}" in $ref ${ref.$ref}; sub-anatomy declares [${[...knownIds].join(', ')}]`,
      );
    }
  }

  const renames = new Map<string, string>();
  for (const ov of overridesBySlot.values()) {
    if (ov.type === 'renamed') renames.set(ov.slot, ov.to);
  }

  const resolved: ResolvedAnatomySlot[] = [];
  for (const original of sub.slots) {
    const ov = overridesBySlot.get(original.id);
    if (ov?.type === 'omitted') continue;

    const slot = cloneSlot(original);

    if (slot.layout.parent && renames.has(slot.layout.parent)) {
      slot.layout = { ...slot.layout, parent: renames.get(slot.layout.parent)! };
    }

    if (ov?.type === 'renamed') {
      slot.id = ov.to;
    }

    if (ov?.type === 'overridden') {
      if (ov.purpose !== undefined) slot.purpose = ov.purpose;
      if (ov.required !== undefined) slot.required = ov.required;
      if (ov.figma !== undefined) slot.figma = ov.figma;
      if (ov.code !== undefined) slot.code = ov.code;
      if (ov.a11y !== undefined) slot.a11y = ov.a11y;
      if (ov.layout !== undefined) slot.layout = mergeLayout(slot.layout, ov.layout);
      if (ov.tokens !== undefined) slot.tokens = mergeTokens(slot.tokens, ov.tokens);
    }

    Object.defineProperty(slot, '__subAnatomy', {
      value: { id: sub.id, slot: original.id },
      enumerable: false,
      configurable: false,
      writable: false,
    });

    resolved.push(slot);
  }

  if (resolved.length === 0) {
    throw new SubAnatomyResolutionError(
      `$ref ${ref.$ref} resolved to zero slots after overrides at anatomy[${ctx.refIndex}]`,
    );
  }

  // Apply ref-level layout hints (parent + row) to the resolved root slot.
  // The root is the first slot of the sub-anatomy that isn't a child of
  // another slot inside the same sub-anatomy. After renames have been
  // applied, find the first slot whose layout.parent points outside.
  const internalIds = new Set(resolved.map((s) => s.id));
  const rootIdx = resolved.findIndex(
    (s) => !s.layout.parent || !internalIds.has(s.layout.parent),
  );
  if (rootIdx >= 0) {
    const root = resolved[rootIdx]!;
    if (ref.parent !== undefined) {
      root.layout = { ...root.layout, parent: ref.parent };
    }
    if (ref.row !== undefined) {
      root.layout = { ...root.layout, row: ref.row };
    }
  }

  return resolved;
};

export function resolveAnatomyRefs(
  rawAnatomy: ReadonlyArray<AnatomySlot | AnatomySlotRef>,
  subAnatomies: Map<string, SubAnatomy>,
): ResolvedAnatomySlot[] {
  const out: ResolvedAnatomySlot[] = [];
  const seenIds = new Set<string>();
  rawAnatomy.forEach((entry, idx) => {
    if (isAnatomySlotRef(entry)) {
      const resolved = resolveOneRef(entry, subAnatomies, { subAnatomyId: entry.$ref, refIndex: idx });
      for (const slot of resolved) {
        if (seenIds.has(slot.id)) {
          throw new SubAnatomyResolutionError(
            `Resolved slot id "${slot.id}" collides with an existing slot (from $ref ${entry.$ref})`,
          );
        }
        seenIds.add(slot.id);
        out.push(slot);
      }
    } else {
      if (seenIds.has(entry.id)) {
        throw new SubAnatomyResolutionError(
          `Duplicate slot id "${entry.id}" in component anatomy`,
        );
      }
      seenIds.add(entry.id);
      out.push(entry);
    }
  });
  return out;
}
