import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { componentSchema, type Component } from './schema.js';

export interface LoaderOptions {
  contentDir: string;
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

export async function loadComponent(filePath: string): Promise<Component> {
  const raw = await readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const result = componentSchema.safeParse(parsed);
  if (!result.success) {
    throw new ComponentValidationError(filePath, result.error.format());
  }
  return result.data;
}

export async function loadComponents({ contentDir }: LoaderOptions): Promise<Map<string, Component>> {
  const entries = await readdir(contentDir, { withFileTypes: true });
  const yamls = entries
    .filter((e) => e.isFile() && e.name.endsWith('.yaml'))
    .map((e) => join(contentDir, e.name));
  const components = new Map<string, Component>();
  for (const file of yamls) {
    const component = await loadComponent(file);
    if (components.has(component.id)) {
      throw new Error(`Duplicate component id "${component.id}" in ${file}`);
    }
    components.set(component.id, component);
  }
  return components;
}
