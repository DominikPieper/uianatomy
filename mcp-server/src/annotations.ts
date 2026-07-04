// MCP tool annotations (hints to clients about tool behaviour).
//
// Every tool on this server is a pure read over a static, bundled canon
// corpus — there are no write/mutate/external-call tools. So every tool
// shares one annotation set:
//   readOnlyHint    true  — never modifies state
//   destructiveHint false — implied by readOnly, set explicitly for clarity
//   idempotentHint  true  — same args → same result (cache is immutable post-load)
//   openWorldHint   false — the corpus is closed & bundled, not a live API
//
// `validate_implementation` is included: it is a pure structural check over
// supplied code, it changes nothing.
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
