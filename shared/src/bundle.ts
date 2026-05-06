import {
  componentSchema,
  implementationSchema,
  patternSchema,
  subAnatomySchema,
  type AnatomySlot,
  type AnatomySlotRef,
  type Component,
  type Implementation,
  type Pattern,
  type SubAnatomy,
} from './schema.js';
import { resolveAnatomyRefs } from './loader.js';

// P6-126 / ADR-030 — bundles consumed by the worker may contain anatomy
// `$ref` entries when the bundling script does not pre-resolve them.
// `loadComponentsFromBundle` resolves refs eagerly when a sub-anatomy
// map is supplied. Pre-resolved bundles (the recommended worker path)
// pass an empty map; `$ref` entries cause a clear error then.
export function loadComponentsFromBundle(
  bundle: Record<string, unknown>,
  subAnatomies?: Map<string, SubAnatomy>,
): Map<string, Component> {
  const map = new Map<string, Component>();
  for (const [id, raw] of Object.entries(bundle)) {
    const result = componentSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Bundle component "${id}" failed validation: ${JSON.stringify(result.error.format())}`,
      );
    }
    const data = result.data;
    const rawAnatomy = data.anatomy as Array<AnatomySlot | AnatomySlotRef>;
    const hasRef = rawAnatomy.some((entry) => typeof (entry as AnatomySlotRef).$ref === 'string');
    if (hasRef) {
      if (!subAnatomies) {
        throw new Error(
          `Bundle component "${id}" contains anatomy $ref entries but no sub-anatomies map was supplied`,
        );
      }
      const resolved = resolveAnatomyRefs(rawAnatomy, subAnatomies);
      map.set(id, { ...data, anatomy: resolved } as Component);
    } else {
      map.set(id, { ...data, anatomy: rawAnatomy as AnatomySlot[] } as Component);
    }
  }
  return map;
}

export function loadSubAnatomiesFromBundle(
  bundle: Record<string, unknown>,
): Map<string, SubAnatomy> {
  const map = new Map<string, SubAnatomy>();
  for (const [id, raw] of Object.entries(bundle)) {
    const result = subAnatomySchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Bundle sub-anatomy "${id}" failed validation: ${JSON.stringify(result.error.format())}`,
      );
    }
    map.set(id, result.data);
  }
  return map;
}

export function loadImplementationsFromBundle(
  bundle: Record<string, Record<string, unknown>>,
): Map<string, Map<string, Implementation>> {
  const byLibrary = new Map<string, Map<string, Implementation>>();
  for (const [libraryId, byComponent] of Object.entries(bundle)) {
    const components = new Map<string, Implementation>();
    for (const [componentId, raw] of Object.entries(byComponent)) {
      const result = implementationSchema.safeParse(raw);
      if (!result.success) {
        throw new Error(
          `Bundle implementation "${libraryId}/${componentId}" failed validation: ${JSON.stringify(result.error.format())}`,
        );
      }
      components.set(componentId, result.data);
    }
    byLibrary.set(libraryId, components);
  }
  return byLibrary;
}

export function loadPatternsFromBundle(
  bundle: Record<string, unknown>,
): Map<string, Pattern> {
  const map = new Map<string, Pattern>();
  for (const [id, raw] of Object.entries(bundle)) {
    const result = patternSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Bundle pattern "${id}" failed validation: ${JSON.stringify(result.error.format())}`,
      );
    }
    map.set(id, result.data);
  }
  return map;
}

// P6-158 — project-framing payload bundled from `docs/about.md`. Worker
// imports `@uianatomy/shared/about-bundle.json` at module-init time; stdio
// + test paths use `loadAbout()` from `./loader.js` to read the same
// markdown file at runtime. Both surfaces yield `{ markdown, summary }`.
export function loadAboutFromBundle(
  bundle: { markdown: unknown; summary: unknown },
): { markdown: string; summary: string } {
  if (typeof bundle.markdown !== 'string' || bundle.markdown.length === 0) {
    throw new Error('about-bundle.json: "markdown" must be a non-empty string');
  }
  if (typeof bundle.summary !== 'string' || bundle.summary.length === 0) {
    throw new Error('about-bundle.json: "summary" must be a non-empty string');
  }
  return { markdown: bundle.markdown, summary: bundle.summary };
}
