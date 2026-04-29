import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnatomySlot, Component, LayoutHint } from './schema.js';

const CANVAS_WIDTH = 800;
const PADDING = 16;
const GAP = 8;
const ROW_HEIGHT_DEFAULT = 64;
const COLUMNS = 12;

const SPAN_TO_COLS: Record<string, number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
};

function spanToCols(span: LayoutHint['span']): number {
  if (typeof span === 'number') return Math.max(1, Math.min(COLUMNS, span));
  return SPAN_TO_COLS[span] ?? COLUMNS;
}

function aspectToHeight(aspect: string | undefined, width: number): number | null {
  if (!aspect) return null;
  const [w, h] = aspect.split(':').map(Number);
  if (!w || !h) return null;
  return Math.round((width * h) / w);
}

function groupByRow(slots: AnatomySlot[]): Map<number, AnatomySlot[]> {
  const map = new Map<number, AnatomySlot[]>();
  for (const slot of slots) {
    const row = slot.layout.row;
    const list = map.get(row) ?? [];
    list.push(slot);
    map.set(row, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.layout.col ?? 0) - (b.layout.col ?? 0));
  }
  return map;
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface RenderOptions {
  width?: number;
}

export function renderAnatomySVG(component: Component, options: RenderOptions = {}): string {
  const width = options.width ?? CANVAS_WIDTH;
  const innerWidth = width - PADDING * 2;
  const colWidth = (innerWidth - GAP * (COLUMNS - 1)) / COLUMNS;

  const rows = groupByRow(component.anatomy);
  const sortedRows = [...rows.keys()].sort((a, b) => a - b);

  const rects: string[] = [];
  let y = PADDING;
  for (const rowKey of sortedRows) {
    const slots = rows.get(rowKey)!;
    let rowHeight = ROW_HEIGHT_DEFAULT;
    for (const slot of slots) {
      const cols = spanToCols(slot.layout.span);
      const slotWidth = cols * colWidth + (cols - 1) * GAP;
      const aspectHeight = aspectToHeight(slot.layout.aspect, slotWidth);
      if (aspectHeight && aspectHeight > rowHeight) rowHeight = aspectHeight;
    }

    let x = PADDING;
    for (const slot of slots) {
      const cols = spanToCols(slot.layout.span);
      const slotWidth = cols * colWidth + (cols - 1) * GAP;
      const dasharray = slot.required ? '' : ' stroke-dasharray="6 4"';
      const label = escape(slot.id);
      rects.push(
        `  <g id="slot-${escape(slot.id)}" class="anatomy-slot" data-required="${slot.required}">` +
          `<rect x="${x}" y="${y}" width="${slotWidth}" height="${rowHeight}" rx="4" fill="white" stroke="currentColor" stroke-width="1"${dasharray}/>` +
          `<text x="${x + slotWidth / 2}" y="${y + rowHeight / 2}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="13" fill="currentColor">${label}</text>` +
          `</g>`,
      );
      x += slotWidth + GAP;
    }
    y += rowHeight + GAP;
  }

  const totalHeight = y - GAP + PADDING;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}" class="anatomy-diagram" role="img" aria-label="${escape(component.name)} anatomy">`,
    ...rects,
    `</svg>`,
  ].join('\n');
}

export interface OverrideValidationResult {
  ok: boolean;
  missing: string[];
  extra: string[];
}

export function validateOverride(svg: string, component: Component): OverrideValidationResult {
  const expected = new Set(component.anatomy.map((s) => `slot-${s.id}`));
  const found = new Set<string>();
  const idRegex = /id="(slot-[a-z0-9-]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(svg)) !== null) {
    found.add(match[1]!);
  }
  const missing = [...expected].filter((id) => !found.has(id));
  const extra = [...found].filter((id) => !expected.has(id));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

export interface ResolveOptions {
  contentDir: string;
  width?: number;
}

export async function resolveAnatomySVG(component: Component, options: ResolveOptions): Promise<string> {
  const overridePath = join(options.contentDir, `${component.id}.anatomy.svg`);
  if (existsSync(overridePath)) {
    const svg = await readFile(overridePath, 'utf-8');
    const validation = validateOverride(svg, component);
    if (!validation.ok) {
      throw new Error(
        `Override SVG for "${component.id}" is out of sync with YAML.` +
          (validation.missing.length ? ` Missing: ${validation.missing.join(', ')}.` : '') +
          (validation.extra.length ? ` Extra: ${validation.extra.join(', ')}.` : ''),
      );
    }
    return svg;
  }
  return renderAnatomySVG(component, options.width !== undefined ? { width: options.width } : {});
}
