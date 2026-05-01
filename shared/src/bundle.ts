import {
  componentSchema,
  implementationSchema,
  patternSchema,
  type Component,
  type Implementation,
  type Pattern,
} from './schema.js';

export function loadComponentsFromBundle(
  bundle: Record<string, unknown>,
): Map<string, Component> {
  const map = new Map<string, Component>();
  for (const [id, raw] of Object.entries(bundle)) {
    const result = componentSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(
        `Bundle component "${id}" failed validation: ${JSON.stringify(result.error.format())}`,
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
