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
  };
}
