// Pure component-vs-component diff. Lives in shared so the site can render
// it server-side and the test suite can assert on its shape without touching
// the DOM. The function is purely derivational — it adds no new schema and
// reads no new fields beyond what componentSchema already pins.

import type { Component } from './schema.js';

export interface SetDiff {
  onlyInA: string[];
  onlyInB: string[];
  shared: string[];
}

export interface ComponentDiff {
  ids: { a: string; b: string };
  names: { a: string; b: string };

  anatomy: {
    requiredOnlyInA: string[];
    requiredOnlyInB: string[];
    optionalOnlyInA: string[];
    optionalOnlyInB: string[];
    shared: string[];
  };

  variants: SetDiff;

  properties: {
    onlyInA: string[];
    onlyInB: string[];
    sharedSameKind: string[];
    sharedDifferentKind: Array<{ name: string; aKind: string; bKind: string }>;
  };

  interactiveStates: SetDiff;
  dataStates: SetDiff;

  optionalBlocks: Record<
    | 'motion'
    | 'responsive'
    | 'transitions'
    | 'events'
    | 'formIntegration'
    | 'a11yAcceptance'
    | 'performance',
    { a: boolean; b: boolean }
  >;

  axeRules: SetDiff;

  vsRelated: {
    aMentionsB: string | null; // difference prose if A's vsRelated cites B's id
    bMentionsA: string | null; // mirror
  };
}

function setDiff(a: Iterable<string>, b: Iterable<string>): SetDiff {
  const aSet = new Set(a);
  const bSet = new Set(b);
  return {
    onlyInA: [...aSet].filter((x) => !bSet.has(x)).sort(),
    onlyInB: [...bSet].filter((x) => !aSet.has(x)).sort(),
    shared: [...aSet].filter((x) => bSet.has(x)).sort(),
  };
}

export function computeCompareDiff(a: Component, b: Component): ComponentDiff {
  const aSlots = new Set(a.anatomy.map((s) => s.id));
  const bSlots = new Set(b.anatomy.map((s) => s.id));
  const aRequired = new Set(a.anatomy.filter((s) => s.required).map((s) => s.id));
  const bRequired = new Set(b.anatomy.filter((s) => s.required).map((s) => s.id));
  const aOptional = new Set(a.anatomy.filter((s) => !s.required).map((s) => s.id));
  const bOptional = new Set(b.anatomy.filter((s) => !s.required).map((s) => s.id));

  const aProps = new Map(a.axes.properties.map((p) => [p.name, p]));
  const bProps = new Map(b.axes.properties.map((p) => [p.name, p]));
  const onlyInA: string[] = [];
  const onlyInB: string[] = [];
  const sharedSameKind: string[] = [];
  const sharedDifferentKind: Array<{ name: string; aKind: string; bKind: string }> = [];
  for (const [name, ap] of aProps) {
    const bp = bProps.get(name);
    if (!bp) {
      onlyInA.push(name);
      continue;
    }
    if (ap.kind === bp.kind) {
      sharedSameKind.push(name);
    } else {
      sharedDifferentKind.push({ name, aKind: ap.kind, bKind: bp.kind });
    }
  }
  for (const name of bProps.keys()) {
    if (!aProps.has(name)) onlyInB.push(name);
  }

  return {
    ids: { a: a.id, b: b.id },
    names: { a: a.name, b: b.name },
    anatomy: {
      requiredOnlyInA: [...aRequired]
        .filter((id) => !bSlots.has(id))
        .sort(),
      requiredOnlyInB: [...bRequired]
        .filter((id) => !aSlots.has(id))
        .sort(),
      optionalOnlyInA: [...aOptional].filter((id) => !bSlots.has(id)).sort(),
      optionalOnlyInB: [...bOptional].filter((id) => !aSlots.has(id)).sort(),
      shared: [...aSlots].filter((id) => bSlots.has(id)).sort(),
    },
    variants: setDiff(a.axes.variants, b.axes.variants),
    properties: {
      onlyInA: onlyInA.sort(),
      onlyInB: onlyInB.sort(),
      sharedSameKind: sharedSameKind.sort(),
      sharedDifferentKind: sharedDifferentKind.sort((x, y) => x.name.localeCompare(y.name)),
    },
    interactiveStates: setDiff(a.axes.states.interactive, b.axes.states.interactive),
    dataStates: setDiff(a.axes.states.data, b.axes.states.data),
    optionalBlocks: {
      motion: { a: !!a.motion, b: !!b.motion },
      responsive: { a: !!a.responsive, b: !!b.responsive },
      transitions: { a: !!a.axes.states.transitions, b: !!b.axes.states.transitions },
      events: { a: !!a.events, b: !!b.events },
      formIntegration: { a: !!a.formIntegration, b: !!b.formIntegration },
      a11yAcceptance: { a: !!a.a11yAcceptance, b: !!b.a11yAcceptance },
      performance: { a: !!a.performance, b: !!b.performance },
    },
    axeRules: setDiff(
      a.a11yAcceptance?.axeRules ?? [],
      b.a11yAcceptance?.axeRules ?? [],
    ),
    vsRelated: {
      aMentionsB:
        a.whenToUse?.vsRelated?.find((r) => r.id === b.id)?.difference ?? null,
      bMentionsA:
        b.whenToUse?.vsRelated?.find((r) => r.id === a.id)?.difference ?? null,
    },
  };
}
