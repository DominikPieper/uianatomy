import type { Property } from './schema.js';

export function formatPropertyType(p: Property): string {
  return p.kind === 'primitive' ? p.of : p.values.join(' | ');
}
