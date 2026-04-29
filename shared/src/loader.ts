import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import yaml from 'js-yaml';
import {
  componentSchema,
  implementationSchema,
  type Component,
  type Implementation,
} from './schema.js';

export interface LoaderOptions {
  contentDir: string;
}

export interface ImplementationLoaderOptions {
  implementationsDir: string;
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
