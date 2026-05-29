// Output schemas for the object-returning MCP tools.
//
// Coverage rule (see server.ts header): `outputSchema` + `structuredContent`
// are attached ONLY to tools whose handler returns a non-null object. MCP
// requires structuredContent to be a JSON object, so array-returning and
// nullable "slice" tools (get_motion, get_anatomy, list_*, …) stay
// content-only by design — wrapping them in an envelope would change the
// wire shape for existing array consumers and obscure the `null` ("absent")
// semantics the nullable slices rely on.
//
// Reuse over redefinition: the canonical Zod schemas in @uianatomy/shared
// already validate every Component / Pattern / SubAnatomy at load time, so
// reusing them here is safe by construction — anything the loader accepted
// will re-validate against the same schema. We only hand-write the small
// derived/aggregate envelopes the canon schema doesn't cover.
import { z } from 'zod';
import {
  componentSchema,
  patternSchema,
  subAnatomySchema,
  axesSchema,
  frameworkMapSchema,
  contractsSchema,
} from '@uianatomy/shared/schema';

// A permissive object schema for surfaces whose shape is large or dynamic
// (canonical vocabularies, role-projected views). Must be a real ZodObject
// (not z.record) — the MCP SDK reads `.shape` to build the JSON Schema, and a
// record has none. An empty loose object accepts any object and serializes to
// `{ type: "object" }`, which is all MCP requires of structuredContent.
const looseObject = z.looseObject({});

export const aboutOutput = z.object({
  markdown: z.string(),
  summary: z.string(),
});

// get_component augments the canonical record with two derived fields.
// componentSchema is non-strict, so extra keys are tolerated; we extend so
// the derived fields are advertised rather than silently stripped.
export const componentOutput = componentSchema.extend({
  stalenessDays: z.number().nullable(),
  staleAfter: z.number(),
});

export const componentsBulkOutput = z.object({
  components: z.array(componentSchema),
  missing: z.array(z.string()),
});

export const componentViewOutput = looseObject;

export const axesOutput = axesSchema;

export const frameworkMapOutput = frameworkMapSchema;

export const contractsOutput = z.object({
  id: z.string(),
  kind: z.enum(['component', 'pattern']),
  contracts: contractsSchema.nullable(),
});

export const canonicalVocabulariesOutput = looseObject;

export const patternOutput = patternSchema;

export const subAnatomyOutput = subAnatomySchema;

export const patternA11yAggregateOutput = z.object({
  patternId: z.string(),
  componentIds: z.array(z.string()),
  axeRules: z.array(z.string()),
  keyboardWalk: z.array(z.record(z.string(), z.unknown())),
  announcements: z.array(z.record(z.string(), z.unknown())),
  axeCoreVersion: z.string().nullable(),
});

export const validateImplementationOutput = z.object({
  componentId: z.string(),
  componentName: z.string(),
  framework: z.string(),
  summary: z.record(z.string(), z.number()),
  missing: z.object({
    requiredSlots: z.array(z.string()),
    variants: z.array(z.string()),
    properties: z.array(z.string()),
    events: z.array(z.string()),
  }),
  notes: z.array(z.string()),
  _about: z.string(),
});
