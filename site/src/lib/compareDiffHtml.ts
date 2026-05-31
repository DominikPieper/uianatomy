import type { ComponentDiff } from '@uianatomy/shared/compare';

// Single source of truth for the compare-diff markup. Used both at build time
// by CompareDiff.astro (the default Card↔Tile render) and at runtime by the
// /compare client script when the user picks a new ?a=&b= pair. Previously the
// client re-render hand-built a near-identical copy of CompareDiff.astro's
// template (backlog P6-166); keeping one function means the two paths cannot
// drift. The matching styles live in global.css (`.compare-diff*`) — not in a
// scoped Astro <style> — so the client-injected HTML is styled too.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCodeList(items: string[]): string {
  return items.map((id) => `<code>${escapeHtml(id)}</code>`).join(' ');
}

function renderDl(rows: Array<[string, string]>): string {
  if (rows.length === 0) return '';
  return `<dl>${rows.map(([dt, dd]) => `<dt>${escapeHtml(dt)}</dt><dd>${dd}</dd>`).join('')}</dl>`;
}

const OPTIONAL_LABELS: Record<keyof ComponentDiff['optionalBlocks'], string> = {
  motion: 'motion',
  responsive: 'responsive',
  transitions: 'state transitions',
  events: 'events',
  formIntegration: 'form integration',
  a11yAcceptance: 'a11y acceptance',
  performance: 'performance thresholds',
};

export function renderDiffHtml(diff: ComponentDiff): string {
  const vsBlock =
    diff.vsRelated.aMentionsB || diff.vsRelated.bMentionsA
      ? `<div class="compare-diff__vs"><h3 class="compare-diff__h3">From the canon</h3>${
          diff.vsRelated.aMentionsB
            ? `<p class="compare-diff__quote"><strong>${escapeHtml(diff.names.a)}</strong> on <strong>${escapeHtml(diff.names.b)}</strong>: <em>${escapeHtml(diff.vsRelated.aMentionsB)}</em></p>`
            : ''
        }${
          diff.vsRelated.bMentionsA
            ? `<p class="compare-diff__quote"><strong>${escapeHtml(diff.names.b)}</strong> on <strong>${escapeHtml(diff.names.a)}</strong>: <em>${escapeHtml(diff.vsRelated.bMentionsA)}</em></p>`
            : ''
        }</div>`
      : '';

  const anatomyRows: Array<[string, string]> = [];
  if (diff.anatomy.requiredOnlyInA.length > 0)
    anatomyRows.push([`Required only in ${diff.names.a}`, renderCodeList(diff.anatomy.requiredOnlyInA)]);
  if (diff.anatomy.requiredOnlyInB.length > 0)
    anatomyRows.push([`Required only in ${diff.names.b}`, renderCodeList(diff.anatomy.requiredOnlyInB)]);
  if (diff.anatomy.optionalOnlyInA.length > 0)
    anatomyRows.push([`Optional only in ${diff.names.a}`, renderCodeList(diff.anatomy.optionalOnlyInA)]);
  if (diff.anatomy.optionalOnlyInB.length > 0)
    anatomyRows.push([`Optional only in ${diff.names.b}`, renderCodeList(diff.anatomy.optionalOnlyInB)]);
  if (diff.anatomy.shared.length > 0)
    anatomyRows.push(['Slot ids in both', renderCodeList(diff.anatomy.shared)]);

  const variantRows: Array<[string, string]> = [];
  if (diff.variants.onlyInA.length > 0)
    variantRows.push([`Only in ${diff.names.a}`, escapeHtml(diff.variants.onlyInA.join(', '))]);
  if (diff.variants.onlyInB.length > 0)
    variantRows.push([`Only in ${diff.names.b}`, escapeHtml(diff.variants.onlyInB.join(', '))]);
  if (diff.variants.shared.length > 0)
    variantRows.push(['Shared', escapeHtml(diff.variants.shared.join(', '))]);

  const propRows: Array<[string, string]> = [];
  if (diff.properties.onlyInA.length > 0)
    propRows.push([`Only in ${diff.names.a}`, escapeHtml(diff.properties.onlyInA.join(', '))]);
  if (diff.properties.onlyInB.length > 0)
    propRows.push([`Only in ${diff.names.b}`, escapeHtml(diff.properties.onlyInB.join(', '))]);
  if (diff.properties.sharedDifferentKind.length > 0) {
    const lines = diff.properties.sharedDifferentKind
      .map(
        (p) =>
          `<div><code>${escapeHtml(p.name)}</code> — ${escapeHtml(diff.names.a)}: <em>${escapeHtml(p.aKind)}</em> · ${escapeHtml(diff.names.b)}: <em>${escapeHtml(p.bKind)}</em></div>`,
      )
      .join('');
    propRows.push(['Same name, different kind', lines]);
  }
  if (diff.properties.sharedSameKind.length > 0)
    propRows.push(['Same name and kind', escapeHtml(diff.properties.sharedSameKind.join(', '))]);

  const intRows: Array<[string, string]> = [];
  if (diff.interactiveStates.onlyInA.length > 0)
    intRows.push([`Only in ${diff.names.a}`, escapeHtml(diff.interactiveStates.onlyInA.join(', '))]);
  if (diff.interactiveStates.onlyInB.length > 0)
    intRows.push([`Only in ${diff.names.b}`, escapeHtml(diff.interactiveStates.onlyInB.join(', '))]);
  if (diff.interactiveStates.shared.length > 0)
    intRows.push(['Shared', escapeHtml(diff.interactiveStates.shared.join(', '))]);

  const dataRows: Array<[string, string]> = [];
  if (diff.dataStates.onlyInA.length > 0)
    dataRows.push([`Only in ${diff.names.a}`, escapeHtml(diff.dataStates.onlyInA.join(', '))]);
  if (diff.dataStates.onlyInB.length > 0)
    dataRows.push([`Only in ${diff.names.b}`, escapeHtml(diff.dataStates.onlyInB.join(', '))]);
  if (diff.dataStates.shared.length > 0)
    dataRows.push(['Shared', escapeHtml(diff.dataStates.shared.join(', '))]);

  const matrixRows = (Object.keys(OPTIONAL_LABELS) as Array<keyof ComponentDiff['optionalBlocks']>)
    .map((key) => {
      const row = diff.optionalBlocks[key];
      const diffClass = row.a !== row.b ? ' class="is-diff"' : '';
      return `<tr><th scope="row">${OPTIONAL_LABELS[key]}</th><td${diffClass}>${row.a ? '✓' : '—'}</td><td${diffClass}>${row.b ? '✓' : '—'}</td></tr>`;
    })
    .join('');

  const axeRows: Array<[string, string]> = [];
  if (diff.axeRules.onlyInA.length > 0)
    axeRows.push([`Only in ${diff.names.a}`, renderCodeList(diff.axeRules.onlyInA)]);
  if (diff.axeRules.onlyInB.length > 0)
    axeRows.push([`Only in ${diff.names.b}`, renderCodeList(diff.axeRules.onlyInB)]);
  if (diff.axeRules.shared.length > 0)
    axeRows.push(['Shared', renderCodeList(diff.axeRules.shared)]);

  return `
    <section class="compare-diff" aria-labelledby="compare-diff-heading">
      <h2 id="compare-diff-heading" class="section-rule">Diff</h2>
      ${vsBlock}
      <div class="compare-diff__grid">
        ${anatomyRows.length > 0 ? `<div class="compare-diff__row"><h3 class="compare-diff__h3">Anatomy slots</h3>${renderDl(anatomyRows)}</div>` : ''}
        ${variantRows.length > 0 ? `<div class="compare-diff__row"><h3 class="compare-diff__h3">Variants</h3>${renderDl(variantRows)}</div>` : ''}
        ${propRows.length > 0 ? `<div class="compare-diff__row"><h3 class="compare-diff__h3">Properties</h3>${renderDl(propRows)}</div>` : ''}
        ${intRows.length > 0 ? `<div class="compare-diff__row"><h3 class="compare-diff__h3">Interactive states</h3>${renderDl(intRows)}</div>` : ''}
        ${dataRows.length > 0 ? `<div class="compare-diff__row"><h3 class="compare-diff__h3">Data states</h3>${renderDl(dataRows)}</div>` : ''}
        <div class="compare-diff__row">
          <h3 class="compare-diff__h3">Schema sections declared</h3>
          <table class="compare-diff__matrix"><thead><tr><th></th><th>${escapeHtml(diff.names.a)}</th><th>${escapeHtml(diff.names.b)}</th></tr></thead><tbody>${matrixRows}</tbody></table>
        </div>
        ${axeRows.length > 0 ? `<div class="compare-diff__row"><h3 class="compare-diff__h3">axe-core rules</h3>${renderDl(axeRows)}</div>` : ''}
      </div>
    </section>
  `;
}
