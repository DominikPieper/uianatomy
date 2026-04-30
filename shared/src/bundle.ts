import { componentSchema, type Component } from './schema.js';

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
