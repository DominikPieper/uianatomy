import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnatomySlot, Component, LayoutHint } from './schema.js';

const CANVAS_WIDTH = 800;
const PADDING = 16;
const GAP = 8;
const NESTED_PADDING = 12;
const ROW_HEIGHT_DEFAULT = 64;
const REPEAT_GAP = 6;
const COLUMNS = 12;
const LABEL_MAX = 32;

const SPAN_TO_COLS: Record<string, number> = {
  full: 12,
  half: 6,
  third: 4,
  quarter: 3,
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface SlotBoxes {
  primary: Box;
  repeats: Box[];
}

function spanToCols(span: LayoutHint['span'] | undefined, fallback = 12): number {
  if (span === undefined) return fallback;
  if (typeof span === 'number') return Math.max(1, Math.min(COLUMNS, span));
  return SPAN_TO_COLS[span] ?? fallback;
}

function aspectToHeight(aspect: string | undefined, width: number): number | null {
  if (!aspect) return null;
  const [w, h] = aspect.split(':').map(Number);
  if (!w || !h) return null;
  return Math.round((width * h) / w);
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s: string, n = LABEL_MAX): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n - 1) + '…' : flat;
}

interface LayoutResult {
  boxes: Map<string, SlotBoxes>;
  overlaySlot: AnatomySlot | null;
  totalHeight: number;
  width: number;
}

function layoutGrid(
  slots: AnatomySlot[],
  area: Box,
  childrenByParent: Map<string, AnatomySlot[]>,
  out: Map<string, SlotBoxes>,
): number {
  const innerWidth = area.w - GAP * (COLUMNS - 1);
  const colWidth = innerWidth / COLUMNS;
  const rows = new Map<number, AnatomySlot[]>();
  for (const s of slots) {
    const r = s.layout.row ?? 1;
    const list = rows.get(r) ?? [];
    list.push(s);
    rows.set(r, list);
  }
  for (const list of rows.values()) {
    list.sort((a, b) => (a.layout.col ?? 0) - (b.layout.col ?? 0));
  }

  let y = area.y;
  const sortedRows = [...rows.keys()].sort((a, b) => a - b);
  for (const rowKey of sortedRows) {
    const rowSlots = rows.get(rowKey)!;
    const rowBoxes: { slot: AnatomySlot; box: Box; reps: number }[] = [];

    let x = area.x;
    let rowHeight = ROW_HEIGHT_DEFAULT;
    for (const slot of rowSlots) {
      const reps = slot.layout.repeats ?? 1;
      const cols = spanToCols(slot.layout.span);
      const slotWidth = cols * colWidth + (cols - 1) * GAP;

      let primaryHeight = ROW_HEIGHT_DEFAULT;
      const aspectH = aspectToHeight(slot.layout.aspect, slotWidth);
      if (aspectH) primaryHeight = aspectH;
      const kids = childrenByParent.get(slot.id) ?? [];
      if (kids.length > 0) {
        primaryHeight = Math.max(primaryHeight, estimateNestedHeight(kids, childrenByParent, slotWidth));
      }

      const horizontal = reps > 1 && cols * reps <= COLUMNS;
      let totalWidth = slotWidth;
      let totalHeight = primaryHeight;
      if (reps > 1) {
        if (horizontal) totalWidth = slotWidth * reps + REPEAT_GAP * (reps - 1);
        else totalHeight = primaryHeight * reps + REPEAT_GAP * (reps - 1);
      }

      const box: Box = { x, y, w: slotWidth, h: primaryHeight };
      rowBoxes.push({ slot, box, reps });

      if (totalHeight > rowHeight) rowHeight = totalHeight;
      x += totalWidth + GAP;
    }

    for (const { slot, box, reps } of rowBoxes) {
      const horizontal = reps > 1 && spanToCols(slot.layout.span) * reps <= COLUMNS;
      const repeatBoxes: Box[] = [];
      for (let i = 1; i < reps; i++) {
        if (horizontal) {
          repeatBoxes.push({ x: box.x + (box.w + REPEAT_GAP) * i, y: box.y, w: box.w, h: box.h });
        } else {
          repeatBoxes.push({ x: box.x, y: box.y + (box.h + REPEAT_GAP) * i, w: box.w, h: box.h });
        }
      }
      out.set(slot.id, { primary: box, repeats: repeatBoxes });

      const kids = (childrenByParent.get(slot.id) ?? []).slice();
      if (kids.length > 0) {
        const innerArea: Box = {
          x: box.x + NESTED_PADDING,
          y: box.y + NESTED_PADDING,
          w: box.w - NESTED_PADDING * 2,
          h: box.h - NESTED_PADDING * 2,
        };
        layoutGrid(kids, innerArea, childrenByParent, out);
      }
    }

    y += rowHeight + GAP;
  }
  return y - GAP;
}

function estimateNestedHeight(
  children: AnatomySlot[],
  childrenByParent: Map<string, AnatomySlot[]>,
  parentWidth: number,
): number {
  const innerWidth = parentWidth - NESTED_PADDING * 2;
  const colWidth = (innerWidth - GAP * (COLUMNS - 1)) / COLUMNS;
  const rows = new Map<number, AnatomySlot[]>();
  for (const s of children) {
    const r = s.layout.row ?? 1;
    const list = rows.get(r) ?? [];
    list.push(s);
    rows.set(r, list);
  }
  let total = NESTED_PADDING * 2;
  const sortedRows = [...rows.keys()].sort((a, b) => a - b);
  for (let i = 0; i < sortedRows.length; i++) {
    const rowSlots = rows.get(sortedRows[i]!)!;
    let rowHeight = ROW_HEIGHT_DEFAULT;
    for (const slot of rowSlots) {
      const reps = slot.layout.repeats ?? 1;
      const cols = spanToCols(slot.layout.span);
      const slotWidth = cols * colWidth + (cols - 1) * GAP;
      let h = ROW_HEIGHT_DEFAULT;
      const aspectH = aspectToHeight(slot.layout.aspect, slotWidth);
      if (aspectH) h = aspectH;
      const grandkids = childrenByParent.get(slot.id) ?? [];
      if (grandkids.length > 0) h = Math.max(h, estimateNestedHeight(grandkids, childrenByParent, slotWidth));
      const horizontal = reps > 1 && cols * reps <= COLUMNS;
      if (reps > 1 && !horizontal) h = h * reps + REPEAT_GAP * (reps - 1);
      if (h > rowHeight) rowHeight = h;
    }
    total += rowHeight;
    if (i < sortedRows.length - 1) total += GAP;
  }
  return total;
}

function layoutFloating(
  slot: AnatomySlot,
  boxes: Map<string, SlotBoxes>,
  width: number,
): Box | null {
  const f = slot.layout.floating;
  if (!f) return null;
  const anchor = boxes.get(f.anchor);
  if (!anchor) return null;
  const offset = f.offset ?? 8;
  const a = anchor.primary;
  const cols = spanToCols(slot.layout.span, 12);
  const colWidth = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const inferredWidth =
    slot.layout.span !== undefined ? cols * colWidth + (cols - 1) * GAP : a.w;
  const aspectH = aspectToHeight(slot.layout.aspect, inferredWidth);
  const baseHeight = aspectH ?? ROW_HEIGHT_DEFAULT;

  switch (f.position) {
    case 'below':
      return { x: a.x, y: a.y + a.h + offset, w: inferredWidth, h: baseHeight };
    case 'above':
      return { x: a.x, y: a.y - offset - baseHeight, w: inferredWidth, h: baseHeight };
    case 'right':
      return { x: a.x + a.w + offset, y: a.y, w: inferredWidth, h: baseHeight };
    case 'left':
      return { x: a.x - offset - inferredWidth, y: a.y, w: inferredWidth, h: baseHeight };
  }
}

function buildLayout(component: Component, width: number): LayoutResult {
  const boxes = new Map<string, SlotBoxes>();
  const slotsById = new Map<string, AnatomySlot>();
  for (const s of component.anatomy) slotsById.set(s.id, s);

  const overlaySlot = component.anatomy.find((s) => s.layout.overlay) ?? null;
  const childrenByParent = new Map<string, AnatomySlot[]>();
  for (const s of component.anatomy) {
    const p = s.layout.parent;
    if (p) {
      const list = childrenByParent.get(p) ?? [];
      list.push(s);
      childrenByParent.set(p, list);
    }
  }

  const roots = component.anatomy.filter(
    (s) => !s.layout.parent && !s.layout.overlay && !s.layout.floating,
  );
  const rootArea: Box = { x: PADDING, y: PADDING, w: width - PADDING * 2, h: 0 };
  const yEnd = layoutGrid(roots, rootArea, childrenByParent, boxes);

  // Floating slots may chain off other floating slots; resolve in passes
  const floatingSlots = component.anatomy.filter((s) => s.layout.floating);
  let resolved = true;
  let safety = 5;
  while (resolved && safety-- > 0) {
    resolved = false;
    for (const slot of floatingSlots) {
      if (boxes.has(slot.id)) continue;
      const box = layoutFloating(slot, boxes, width);
      if (box) {
        boxes.set(slot.id, { primary: box, repeats: [] });
        resolved = true;
        const kids = childrenByParent.get(slot.id) ?? [];
        if (kids.length > 0) {
          const innerArea: Box = {
            x: box.x + NESTED_PADDING,
            y: box.y + NESTED_PADDING,
            w: box.w - NESTED_PADDING * 2,
            h: box.h - NESTED_PADDING * 2,
          };
          // Children of floating slot may need vertical space; expand floating box if needed
          const childrenHeight = estimateNestedHeight(kids, childrenByParent, box.w);
          if (childrenHeight > box.h) {
            box.h = childrenHeight;
            boxes.set(slot.id, { primary: box, repeats: [] });
            innerArea.h = box.h - NESTED_PADDING * 2;
          }
          layoutGrid(kids, innerArea, childrenByParent, boxes);
        }
      }
    }
  }

  let totalHeight = yEnd + PADDING;
  for (const { primary, repeats } of boxes.values()) {
    totalHeight = Math.max(totalHeight, primary.y + primary.h + PADDING);
    for (const r of repeats) totalHeight = Math.max(totalHeight, r.y + r.h + PADDING);
  }

  return { boxes, overlaySlot, totalHeight, width };
}

function emitSlotGroup(
  slot: AnatomySlot,
  boxes: SlotBoxes,
  isPrimary: boolean,
  index: number,
): string {
  const { x, y, w, h } = isPrimary ? boxes.primary : boxes.repeats[index]!;
  const dasharray = slot.required ? '' : ' stroke-dasharray="6 4"';
  const figma = escape(truncate(slot.figma.hint));
  const code = escape(`slot="${slot.code.slot}"`);
  const bridge = escape(slot.id);
  const cls = isPrimary ? 'anatomy-slot' : 'anatomy-slot anatomy-repeat-ghost';
  const idAttr = isPrimary ? ` id="slot-${escape(slot.id)}"` : '';
  const cy = y + h / 2;
  const cx = x + w / 2;
  return (
    `  <g${idAttr} class="${cls}" data-required="${slot.required}">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="white" stroke="currentColor" stroke-width="1"${dasharray}/>` +
    `<text class="anatomy-label label-figma" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="currentColor">${figma}</text>` +
    `<text class="anatomy-label label-code"  x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="currentColor">${code}</text>` +
    `<text class="anatomy-label label-bridge" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="currentColor">${bridge}</text>` +
    `</g>`
  );
}

function emitOverlay(slot: AnatomySlot, width: number, height: number): string {
  const figma = escape(truncate(slot.figma.hint));
  const code = escape(`slot="${slot.code.slot}"`);
  const bridge = escape(slot.id);
  return (
    `  <g id="slot-${escape(slot.id)}" class="anatomy-slot anatomy-overlay" data-required="${slot.required}">` +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="rgba(0,0,0,0.06)" stroke="currentColor" stroke-width="1" stroke-dasharray="6 4"/>` +
    `<text class="anatomy-label label-figma" x="${PADDING}" y="${PADDING + 4}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="11" fill="currentColor">${figma}</text>` +
    `<text class="anatomy-label label-code"  x="${PADDING}" y="${PADDING + 4}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="currentColor">${code}</text>` +
    `<text class="anatomy-label label-bridge" x="${PADDING}" y="${PADDING + 4}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="11" fill="currentColor">${bridge}</text>` +
    `</g>`
  );
}

function emitFloatingConnector(slot: AnatomySlot, boxes: Map<string, SlotBoxes>): string | null {
  const f = slot.layout.floating;
  if (!f) return null;
  const anchor = boxes.get(f.anchor);
  const target = boxes.get(slot.id);
  if (!anchor || !target) return null;
  const a = anchor.primary;
  const t = target.primary;
  let x1: number, y1: number, x2: number, y2: number;
  switch (f.position) {
    case 'below':
      x1 = a.x + a.w / 2; y1 = a.y + a.h; x2 = t.x + t.w / 2; y2 = t.y; break;
    case 'above':
      x1 = a.x + a.w / 2; y1 = a.y; x2 = t.x + t.w / 2; y2 = t.y + t.h; break;
    case 'right':
      x1 = a.x + a.w; y1 = a.y + a.h / 2; x2 = t.x; y2 = t.y + t.h / 2; break;
    case 'left':
      x1 = a.x; y1 = a.y + a.h / 2; x2 = t.x + t.w; y2 = t.y + t.h / 2; break;
  }
  return `  <line class="anatomy-floating-connector" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3"/>`;
}

export interface RenderOptions {
  width?: number;
}

export function renderAnatomySVG(component: Component, options: RenderOptions = {}): string {
  const width = options.width ?? CANVAS_WIDTH;
  const layout = buildLayout(component, width);
  const { boxes, overlaySlot, totalHeight } = layout;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}" class="anatomy-diagram" role="img" aria-label="${escape(component.name)} anatomy">`,
  );

  if (overlaySlot) parts.push(emitOverlay(overlaySlot, width, totalHeight));

  // Floating connectors first (so slot rects render on top)
  for (const slot of component.anatomy) {
    if (!slot.layout.floating) continue;
    const line = emitFloatingConnector(slot, boxes);
    if (line) parts.push(line);
  }

  for (const slot of component.anatomy) {
    if (slot.layout.overlay) continue;
    const slotBoxes = boxes.get(slot.id);
    if (!slotBoxes) continue;
    parts.push(emitSlotGroup(slot, slotBoxes, true, 0));
    for (let i = 0; i < slotBoxes.repeats.length; i++) {
      parts.push(emitSlotGroup(slot, slotBoxes, false, i));
    }
  }

  parts.push(`</svg>`);
  return parts.join('\n');
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
