// Per-component accessibility test fixture, machine-readable.
//
// Purpose: shorten the gap between "documented in canon" and "asserted in
// the test suite." Returns the component's a11yAcceptance block (keyboard
// walks, expected screen-reader announcements, axe rule ids) plus a brief
// _about prose explaining how to wire each part into Playwright +
// @axe-core/playwright or Jest + jest-axe without forcing a specific
// framework.
//
// Returns the same shape for every component, even when a sub-block is
// absent, so a test runner can iterate the manifest without per-component
// branching. Empty arrays mean "the canon does not yet pin a behaviour
// here," not "this component has no accessibility requirements."

import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const components = await getCollection('components');
  return components.map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}

const ABOUT = [
  'Per-component a11y-acceptance data shaped for direct ingestion into Playwright + @axe-core/playwright or Jest + jest-axe.',
  '',
  'Suggested wiring:',
  '- axeRules → pass to AxeBuilder.options({ runOnly: { type: "rule", values: axeRules } }) so the run targets only the rules the canon has pinned for this component (other rules can run in your global pass).',
  '- keyboardWalk → iterate the entries; each `keys` is a human-readable sequence (e.g. "Tab → Tab → Esc"). Translate to page.keyboard.press calls and assert `expected` against the result (focused element, aria-state, visible text, etc.).',
  '- announcements → assert text content of any aria-live region or capture the accessibility tree at the trigger moment and match against `expected`.',
  '',
  'Empty sub-arrays mean the canon does not yet pin behaviour for that axis on this component, not that none is required.',
].join('\n');

export const GET: APIRoute = async ({ props }) => {
  const entry = props.entry as CollectionEntry<'components'>;
  const a11y = entry.data.a11yAcceptance ?? {};
  const fixture = {
    componentId: entry.data.id,
    componentName: entry.data.name,
    lastReviewed: entry.data.lastReviewed ?? null,
    keyboardWalk: a11y.keyboardWalk ?? [],
    announcements: a11y.announcements ?? [],
    axeRules: a11y.axeRules ?? [],
    _about: ABOUT,
  };
  return new Response(JSON.stringify(fixture, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
};
