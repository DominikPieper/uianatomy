// Heuristic conformance check: does a piece of component code mention every
// required slot, variant, property, and event the canon pins for the matching
// canonical component?
//
// Important: this is a substring search, not a parser. False negatives happen
// whenever the code aliases or minifies a canonical identifier (e.g. renames
// `dismissible` to `closable` in a wrapper). The tool is intended as a fast
// "did the author at least name the canonical concepts?" sanity check that
// agents can run before they hand code to a human reviewer or to a real test
// suite. Real behavioural assertions belong in the a11y-fixture endpoint
// (/api/components/<id>/a11y-fixture.json) plus a Playwright + axe-core run.

import type { Component } from './schema.js';

export type Framework = 'react' | 'vue' | 'angular' | 'webComponents';

export interface ValidateImplementationInput {
  component: Component;
  code: string;
  framework: Framework;
}

export interface ValidationSummary {
  slotsRequired: number;
  slotsMatched: number;
  variantsDeclared: number;
  variantsMatched: number;
  propertiesDeclared: number;
  propertiesMatched: number;
  eventsDeclared: number;
  eventsMatched: number;
}

export interface ValidationReport {
  componentId: string;
  componentName: string;
  framework: Framework;
  summary: ValidationSummary;
  missing: {
    requiredSlots: string[];
    variants: string[];
    properties: string[];
    events: string[];
  };
  notes: string[];
  _about: string;
}

function pascalCase(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

function eventCandidates(name: string, fw: Framework): string[] {
  switch (fw) {
    case 'react':
      // React conventions: on<PascalCase> for callback prop OR the bare
      // event name (some libs use `addEventListener` even in React).
      return [`on${pascalCase(name)}`, name];
    case 'vue':
      // Vue 3 single-file-component templates: @event-name (kebab) or @eventName
      // (preserved camelCase). Also `v-on:` long form. Also bare name when
      // emitted via `emit('eventName')` in setup script.
      return [`@${name}`, `v-on:${name}`, `emit('${name}')`, `emit("${name}")`, name];
    case 'angular':
      // Angular template binding (eventName).
      return [`(${name})`, name];
    case 'webComponents':
      // Custom-element addEventListener('eventName') or emit on the element.
      return [`'${name}'`, `"${name}"`, name];
  }
}

function containsAnyCi(haystackLower: string, needles: string[]): boolean {
  for (const n of needles) {
    if (n.length === 0) continue;
    if (haystackLower.includes(n.toLowerCase())) return true;
  }
  return false;
}

export function validateImplementation({
  component,
  code,
  framework,
}: ValidateImplementationInput): ValidationReport {
  const lower = code.toLowerCase();

  const requiredSlots = component.anatomy.filter((s) => s.required).map((s) => s.id);
  const requiredSlotsMissing = requiredSlots.filter((id) => !containsAnyCi(lower, [id]));

  const variants = component.axes.variants;
  const variantsMissing = variants.filter((v) => !containsAnyCi(lower, [v]));

  const propertyNames = component.axes.properties.map((p) => p.name);
  const propertiesMissing = propertyNames.filter((name) => !containsAnyCi(lower, [name]));

  const events = component.events ?? [];
  const eventsMissing = events
    .filter((e) => !containsAnyCi(lower, eventCandidates(e.name, framework)))
    .map((e) => e.name);

  const notes: string[] = [
    'Heuristic substring search — false-negatives possible if the code aliases or minifies identifiers.',
    `A "missing" entry means the canonical name was not found verbatim in the supplied code (case-insensitive). Verify manually before treating it as a defect.`,
  ];
  if (events.length === 0) {
    notes.push('No canonical events declared for this component, so the events check is trivially satisfied.');
  }

  return {
    componentId: component.id,
    componentName: component.name,
    framework,
    summary: {
      slotsRequired: requiredSlots.length,
      slotsMatched: requiredSlots.length - requiredSlotsMissing.length,
      variantsDeclared: variants.length,
      variantsMatched: variants.length - variantsMissing.length,
      propertiesDeclared: propertyNames.length,
      propertiesMatched: propertyNames.length - propertiesMissing.length,
      eventsDeclared: events.length,
      eventsMatched: events.length - eventsMissing.length,
    },
    missing: {
      requiredSlots: requiredSlotsMissing,
      variants: variantsMissing,
      properties: propertiesMissing,
      events: eventsMissing,
    },
    notes,
    _about:
      'Structural conformance only. Behavioural assertions (focus trap, aria-modal, escape-key handling, etc.) belong in a real test suite — see /api/components/<id>/a11y-fixture.json for the keyboardWalk + announcements + axe rules pinned for this component.',
  };
}
