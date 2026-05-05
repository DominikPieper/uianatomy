import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnatomySlot, Component, LayoutHint } from './schema.js';

const CANVAS_WIDTH = 800;
const PADDING = 16;
const GAP = 8;
const NESTED_PADDING = 12;
const PARENT_LABEL_STRIP = 24;
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

// Width-aware truncation for SVG slot labels.
// Avg char widths at 12px chosen empirically from rendered serif-italic / mono samples,
// with safety margin so the label never crosses the rect border.
function truncateForBox(s: string, boxWidth: number, fontKind: 'serif' | 'mono' = 'serif'): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  const charPx = fontKind === 'mono' ? 7.2 : 6.5;
  const padding = 12;
  const usable = Math.max(0, boxWidth - padding);
  const maxChars = Math.max(4, Math.floor(usable / charPx));
  if (flat.length <= maxChars) return flat;
  return flat.slice(0, Math.max(1, maxChars - 1)) + '…';
}

interface LayoutResult {
  boxes: Map<string, SlotBoxes>;
  childrenByParent: Map<string, AnatomySlot[]>;
  depthById: Map<string, number>;
  overlaySlot: AnatomySlot | null;
  totalHeight: number;
  width: number;
}

function hasTokens(slot: AnatomySlot): boolean {
  if (!slot.tokens) return false;
  return Object.values(slot.tokens).some(
    (cat) => cat !== undefined && Object.keys(cat).length > 0,
  );
}

function layoutGrid(
  slots: AnatomySlot[],
  area: Box,
  childrenByParent: Map<string, AnatomySlot[]>,
  out: Map<string, SlotBoxes>,
  floatingExtensions: Map<string, number> = new Map(),
): number {
  // P6-144 — when nested area is too narrow to subdivide into 12 gapped
  // columns (e.g. an indicator parented to an already 1-col input slot),
  // colWidth would go negative and emit invalid `<rect width="-…">`. Clamp
  // to 0 so nested slots collapse rather than overlap with negative geometry.
  const innerWidth = Math.max(0, area.w - GAP * (COLUMNS - 1));
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
        primaryHeight = Math.max(
          primaryHeight,
          estimateNestedHeight(kids, childrenByParent, slotWidth) + PARENT_LABEL_STRIP,
        );
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
          y: box.y + NESTED_PADDING + PARENT_LABEL_STRIP,
          w: box.w - NESTED_PADDING * 2,
          h: box.h - NESTED_PADDING * 2 - PARENT_LABEL_STRIP,
        };
        layoutGrid(kids, innerArea, childrenByParent, out);
      }
    }

    let extraDrop = 0;
    for (const [anchorId, ext] of floatingExtensions) {
      const anchorBox = out.get(anchorId)?.primary;
      if (!anchorBox) continue;
      if (anchorBox.y < y || anchorBox.y >= y + rowHeight) continue;
      const overflow = anchorBox.y + anchorBox.h + ext - (y + rowHeight);
      if (overflow > extraDrop) extraDrop = overflow;
    }

    y += rowHeight + GAP + extraDrop;
  }
  return y - GAP;
}

function estimateNestedHeight(
  children: AnatomySlot[],
  childrenByParent: Map<string, AnatomySlot[]>,
  parentWidth: number,
): number {
  const innerWidth = Math.max(0, parentWidth - NESTED_PADDING * 2);
  const colWidth = Math.max(0, (innerWidth - GAP * (COLUMNS - 1)) / COLUMNS);
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
      if (grandkids.length > 0) {
        h = Math.max(
          h,
          estimateNestedHeight(grandkids, childrenByParent, slotWidth) + PARENT_LABEL_STRIP,
        );
      }
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

function computeDepths(
  component: Component,
  childrenByParent: Map<string, AnatomySlot[]>,
): Map<string, number> {
  const depths = new Map<string, number>();
  const visit = (slot: AnatomySlot, depth: number) => {
    depths.set(slot.id, depth);
    for (const child of childrenByParent.get(slot.id) ?? []) {
      visit(child, depth + 1);
    }
  };
  for (const slot of component.anatomy) {
    if (!slot.layout.parent && !slot.layout.overlay) {
      visit(slot, 0);
    }
  }
  for (const slot of component.anatomy) {
    if (!depths.has(slot.id)) depths.set(slot.id, 0);
  }
  return depths;
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
  const depthById = computeDepths(component, childrenByParent);

  const roots = component.anatomy.filter(
    (s) => !s.layout.parent && !s.layout.overlay && !s.layout.floating,
  );

  const floatingExtensions = new Map<string, number>();
  for (const slot of component.anatomy) {
    const f = slot.layout.floating;
    if (!f || f.position !== 'below') continue;
    const cols = spanToCols(slot.layout.span, 12);
    const colWidth = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
    const fWidth = cols * colWidth + (cols - 1) * GAP;
    const fHeight = aspectToHeight(slot.layout.aspect, fWidth) ?? ROW_HEIGHT_DEFAULT;
    const offset = f.offset ?? 8;
    floatingExtensions.set(f.anchor, fHeight + offset);
  }

  const rootArea: Box = { x: PADDING, y: PADDING, w: width - PADDING * 2, h: 0 };
  const yEnd = layoutGrid(roots, rootArea, childrenByParent, boxes, floatingExtensions);

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
            y: box.y + NESTED_PADDING + PARENT_LABEL_STRIP,
            w: box.w - NESTED_PADDING * 2,
            h: box.h - NESTED_PADDING * 2 - PARENT_LABEL_STRIP,
          };
          // Children of floating slot may need vertical space; expand floating box if needed
          const childrenHeight =
            estimateNestedHeight(kids, childrenByParent, box.w) + PARENT_LABEL_STRIP;
          if (childrenHeight > box.h) {
            box.h = childrenHeight;
            boxes.set(slot.id, { primary: box, repeats: [] });
            innerArea.h = box.h - NESTED_PADDING * 2 - PARENT_LABEL_STRIP;
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

  return { boxes, childrenByParent, depthById, overlaySlot, totalHeight, width };
}

function emitSlotGroup(
  slot: AnatomySlot,
  boxes: SlotBoxes,
  isPrimary: boolean,
  index: number,
  hasChildren: boolean,
  depth: number,
): string {
  const { x, y, w, h } = isPrimary ? boxes.primary : boxes.repeats[index]!;
  const dasharray = slot.required ? '' : ' stroke-dasharray="6 4"';
  const labelMaxWidth = hasChildren ? Math.min(w - 24, 360) : w;
  const figma = escape(truncateForBox(slot.figma.hint, labelMaxWidth, 'serif'));
  const code = escape(truncateForBox(`slot="${slot.code.slot}"`, labelMaxWidth, 'mono'));
  const bridge = escape(truncateForBox(slot.id, labelMaxWidth, 'mono'));
  const isFloating = slot.layout.floating !== undefined;
  const totalReps = boxes.repeats.length + 1;
  const depthClamped = Math.min(2, Math.max(0, depth));
  const slotKindClass = slot.slotKind ? `anatomy-kind-${slot.slotKind}` : '';
  const slotHasTokens = hasTokens(slot);

  const classes = ['anatomy-slot', `anatomy-depth-${depthClamped}`];
  if (slotKindClass) classes.push(slotKindClass);
  if (!isPrimary) classes.push('anatomy-repeat-ghost');
  if (isFloating && isPrimary) classes.push('anatomy-floating');
  if (hasChildren) classes.push('anatomy-parent');
  if (slotHasTokens) classes.push('anatomy-has-tokens');
  if (totalReps > 1) classes.push('anatomy-has-repeats');
  const cls = classes.join(' ');
  const idAttr = isPrimary ? ` id="slot-${escape(slot.id)}"` : '';
  const dataSlot = ` data-slot="${escape(slot.id)}"`;
  const cy = y + h / 2;
  const cx = x + w / 2;
  const labelX = hasChildren ? x + 12 : cx;
  const labelY = hasChildren ? y + 14 : cy;
  const textAnchor = hasChildren ? 'start' : 'middle';
  const baseline = hasChildren ? 'hanging' : 'middle';

  const titleText = isPrimary
    ? `<title>${escape(slot.purpose)}</title>`
    : '';

  let badges = '';
  if (isPrimary && isFloating) {
    const bx = x + w - 12;
    const by = y + 12;
    badges +=
      `<g class="anatomy-z-badge" aria-hidden="true">` +
      `<circle cx="${bx}" cy="${by}" r="9" fill="currentColor"/>` +
      `<text x="${bx}" y="${by + 3.5}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="10" font-weight="600" fill="white">z</text>` +
      `</g>`;
  }
  if (isPrimary && totalReps > 1) {
    const offset = isFloating ? 36 : 18;
    const bx = x + w - offset;
    const by = y + 12;
    const label = `${totalReps}×`;
    badges +=
      `<g class="anatomy-repeat-count" aria-hidden="true">` +
      `<rect x="${bx - 13}" y="${by - 8}" width="26" height="16" rx="3" fill="white" stroke="currentColor" stroke-width="1"/>` +
      `<text x="${bx}" y="${by + 3}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10" fill="currentColor">${label}</text>` +
      `</g>`;
  }

  let indicators = '';
  if (isPrimary && slotHasTokens) {
    const ix = x + w - 8;
    const iy = y + h - 8;
    indicators =
      `<g class="anatomy-indicators" aria-hidden="true">` +
      `<circle class="anatomy-indicator anatomy-indicator-tokens" cx="${ix}" cy="${iy}" r="3"/>` +
      `</g>`;
  }

  return (
    `  <g${idAttr}${dataSlot} class="${cls}" data-required="${slot.required}">` +
    titleText +
    `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="4" stroke="currentColor" stroke-width="1"${dasharray}/>` +
    `<text class="anatomy-label label-figma" x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="12" fill="currentColor">${figma}</text>` +
    `<text class="anatomy-label label-code"  x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="currentColor">${code}</text>` +
    `<text class="anatomy-label label-bridge" x="${labelX}" y="${labelY}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="currentColor">${bridge}</text>` +
    badges +
    indicators +
    `</g>`
  );
}

function emitOverlay(slot: AnatomySlot, width: number, height: number): string {
  const figma = escape(truncate(slot.figma.hint));
  const code = escape(`slot="${slot.code.slot}"`);
  const bridge = escape(slot.id);
  const slotKindClass = slot.slotKind ? ` anatomy-kind-${slot.slotKind}` : '';
  return (
    `  <g id="slot-${escape(slot.id)}" data-slot="${escape(slot.id)}" class="anatomy-slot anatomy-overlay${slotKindClass}" data-required="${slot.required}">` +
    `<title>${escape(slot.purpose)}</title>` +
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
  const { boxes, childrenByParent, depthById, overlaySlot, totalHeight } = layout;

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
    const hasChildren = (childrenByParent.get(slot.id) ?? []).length > 0;
    const depth = depthById.get(slot.id) ?? 0;
    parts.push(emitSlotGroup(slot, slotBoxes, true, 0, hasChildren, depth));
    for (let i = 0; i < slotBoxes.repeats.length; i++) {
      parts.push(emitSlotGroup(slot, slotBoxes, false, i, hasChildren, depth));
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

// P6-49 stage-4: composition-SVG-renderer. Mirrors renderAnatomySVG's
// wireframe vocabulary (dashed outer frame for the pattern boundary,
// solid inner frames per composition entry) so the visual language
// stays consistent across component-anatomy and pattern-composition.
export function renderCompositionSVG(
  pattern: import('./schema.js').Pattern,
  components: Map<string, Component>,
  options: RenderOptions = {},
): string {
  const width = options.width ?? CANVAS_WIDTH;
  const OUTER_PAD = 24;
  const OUTER_LABEL_STRIP = 28;
  const INNER_PAD = 16;
  const ENTRY_HEIGHT = 56;
  const ENTRY_GAP = 8;
  const ROLE_BADGE_WIDTH = 140;
  const SLOTS_BADGE_WIDTH = 80;

  const entries = pattern.composition;
  const innerWidth = width - OUTER_PAD * 2 - INNER_PAD * 2;
  const innerHeight = entries.length * ENTRY_HEIGHT + (entries.length - 1) * ENTRY_GAP;
  const outerHeight = OUTER_LABEL_STRIP + INNER_PAD + innerHeight + INNER_PAD;
  const totalHeight = OUTER_PAD + outerHeight + OUTER_PAD;

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${totalHeight}" width="${width}" height="${totalHeight}" class="composition-diagram" role="img" aria-label="${escape(pattern.name)} composition">`,
  );

  const outerX = OUTER_PAD;
  const outerY = OUTER_PAD;
  const outerW = width - OUTER_PAD * 2;
  const outerH = outerHeight;
  parts.push(
    `<rect x="${outerX}" y="${outerY}" width="${outerW}" height="${outerH}" rx="6" class="composition-outer" stroke-dasharray="6 4" fill="none" />`,
  );
  parts.push(
    `<text x="${outerX + 12}" y="${outerY + 18}" class="composition-outer-label">${escape(pattern.name)}</text>`,
  );

  let cursorY = outerY + OUTER_LABEL_STRIP + INNER_PAD;
  const innerX = outerX + INNER_PAD;
  for (const entry of entries) {
    const comp = components.get(entry.componentId);
    const compName = comp?.name ?? entry.componentId;
    const slotCount = comp?.anatomy.length ?? 0;
    const slotsLabel = slotCount > 0 ? `${slotCount} slot${slotCount === 1 ? '' : 's'}` : '—';

    parts.push(
      `<rect x="${innerX}" y="${cursorY}" width="${innerWidth}" height="${ENTRY_HEIGHT}" rx="4" class="composition-entry" fill="none" />`,
    );
    parts.push(
      `<text x="${innerX + 12}" y="${cursorY + 22}" class="composition-entry-name">${escape(compName)}</text>`,
    );
    parts.push(
      `<text x="${innerX + 12}" y="${cursorY + 40}" class="composition-entry-role">${escape(entry.role)}</text>`,
    );

    const slotsX = innerX + innerWidth - SLOTS_BADGE_WIDTH - 8;
    parts.push(
      `<text x="${slotsX + SLOTS_BADGE_WIDTH - 4}" y="${cursorY + 22}" class="composition-entry-slots" text-anchor="end">${escape(slotsLabel)}</text>`,
    );
    const roleX = slotsX - ROLE_BADGE_WIDTH;
    void roleX; // reserved for future right-aligned role-badge if needed

    cursorY += ENTRY_HEIGHT + ENTRY_GAP;
  }

  parts.push('</svg>');
  return parts.join('');
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
