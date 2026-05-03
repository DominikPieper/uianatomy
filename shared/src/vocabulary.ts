// Canonical token vocabularies — single source of truth, shared between
// the consistency test (drift-detection) and the MCP `get_canonical_vocabularies`
// tool (agent-discovery). Mirrors the published vocabulary in docs/schema.md.

export const CANON_SPACING = [
  'spacing.tight',
  'spacing.compact',
  'spacing.cozy',
  'spacing.comfortable',
  'spacing.loose',
] as const;

export const CANON_RADIUS = [
  'radius.none',
  'radius.sm',
  'radius.md',
  'radius.lg',
  'radius.pill',
  'radius.full',
] as const;

export const CANON_COLOR = [
  'color.surface.bg',
  'color.surface.raised',
  'color.surface.sunken',
  'color.surface.scrim',
  'color.text.primary',
  'color.text.muted',
  'color.text.inverse',
  'color.text.accent',
  'color.text.danger',
  'color.border.subtle',
  'color.border.strong',
  'color.border.focus',
  'color.accent.bg',
  'color.accent.fg',
] as const;

export const CANON_ELEVATION = [
  'elevation.none',
  'elevation.sm',
  'elevation.md',
  'elevation.lg',
  'elevation.overlay',
] as const;

export const CANON_TYPOGRAPHY = [
  'text.xs',
  'text.sm',
  'text.md',
  'text.lg',
  'text.xl',
  'weight.regular',
  'weight.medium',
  'weight.semibold',
  'weight.bold',
  'leading.tight',
  'leading.snug',
  'leading.normal',
  'leading.relaxed',
  'tracking.normal',
  'tracking.wide',
] as const;

export const CANON_MOTION_DURATION = [
  'motion.duration.instant',
  'motion.duration.fast',
  'motion.duration.base',
  'motion.duration.slow',
  'motion.duration.slower',
] as const;

export const CANON_MOTION_EASING = [
  'motion.easing.standard',
  'motion.easing.decelerate',
  'motion.easing.accelerate',
  'motion.easing.sharp',
] as const;

export const CANON_BREAKPOINTS = [
  'breakpoint.xs',
  'breakpoint.sm',
  'breakpoint.md',
  'breakpoint.lg',
  'breakpoint.xl',
] as const;

export const CANON_PROPERTY_VOCAB: Record<string, readonly string[]> = {
  density: ['comfortable', 'compact'],
};

export const CANON_PROPERTY_BOUNDED: Record<string, readonly string[]> = {
  size: ['sm', 'md', 'lg', 'xl', 'full'],
};

export const CANON_INTERACTIVE_STATES = [
  'hover',
  'focus-visible',
  'active',
  'disabled',
  'visited',
  'current',
] as const;

// Library-version table — single pin per library the canon refers to.
// Phase-1 (ADR-028) ships the structure with version + verifiedAt
// optional. The user fills them in during a verification cycle by
// re-checking each library's current major version against canonical
// claims. Bumping a library is a one-line edit here; canon-auditor
// compares component.lastReviewed against verifiedAt to flag stale
// component-level claims.
export interface LibraryVersionEntry {
  /** Human-readable name as cited in prose (frameworkMap, notes, vocabularyDrift). */
  readonly name: string;
  /** Canonical upstream URL (docs / project landing). */
  readonly url: string;
  /** Pinned version (semver, calver, or release-tag). Undefined until verified. */
  readonly version?: string;
  /** ISO date YYYY-MM-DD when the version was last verified upstream. Pairs with `version`. */
  readonly verifiedAt?: string;
}

export const LIBRARY_VERSIONS: Readonly<Record<string, LibraryVersionEntry>> = {
  radix: {
    name: 'Radix UI Primitives',
    url: 'https://www.radix-ui.com/primitives',
  },
  reactAria: {
    name: 'React Aria',
    url: 'https://react-spectrum.adobe.com/react-aria/',
  },
  headlessUi: {
    name: 'Headless UI',
    url: 'https://headlessui.com/',
  },
  spectrum: {
    name: 'Spectrum Web Components',
    url: 'https://opensource.adobe.com/spectrum-web-components/',
  },
  polaris: {
    name: 'Shopify Polaris',
    url: 'https://polaris.shopify.com/',
  },
  carbon: {
    name: 'IBM Carbon Design System',
    url: 'https://carbondesignsystem.com/',
  },
  atlassian: {
    name: 'Atlassian Design System',
    url: 'https://atlassian.design/',
  },
  material3: {
    name: 'Material Design 3',
    url: 'https://m3.material.io/',
  },
  govuk: {
    name: 'GOV.UK Design System',
    url: 'https://design-system.service.gov.uk/',
  },
  sonner: {
    name: 'Sonner',
    url: 'https://sonner.emilkowal.ski/',
  },
  vaul: {
    name: 'Vaul',
    url: 'https://vaul.emilkowal.ski/',
  },
  reach: {
    name: 'Reach UI',
    url: 'https://reach.tech/',
  },
  angularCdk: {
    name: 'Angular CDK',
    url: 'https://material.angular.io/cdk/',
  },
} as const;

export interface CanonicalVocabularies {
  spacing: readonly string[];
  radius: readonly string[];
  color: readonly string[];
  elevation: readonly string[];
  typography: readonly string[];
  motion: {
    durations: readonly string[];
    easing: readonly string[];
  };
  breakpoint: readonly string[];
  propertyVocab: Record<string, readonly string[]>;
  propertyBounded: Record<string, readonly string[]>;
  interactiveStates: readonly string[];
  libraryVersions: Readonly<Record<string, LibraryVersionEntry>>;
}

export function getCanonicalVocabularies(): CanonicalVocabularies {
  return {
    spacing: CANON_SPACING,
    radius: CANON_RADIUS,
    color: CANON_COLOR,
    elevation: CANON_ELEVATION,
    typography: CANON_TYPOGRAPHY,
    motion: {
      durations: CANON_MOTION_DURATION,
      easing: CANON_MOTION_EASING,
    },
    breakpoint: CANON_BREAKPOINTS,
    propertyVocab: CANON_PROPERTY_VOCAB,
    propertyBounded: CANON_PROPERTY_BOUNDED,
    interactiveStates: CANON_INTERACTIVE_STATES,
    libraryVersions: LIBRARY_VERSIONS,
  };
}
