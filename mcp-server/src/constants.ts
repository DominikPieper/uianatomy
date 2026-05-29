// Maximum size (in characters of the serialized JSON) of a single tool
// response before the server truncates it. Mirrors the mcp-builder skill's
// guidance (reference/node_mcp_server.md). The canon corpus is small and
// static, so most responses are well under this; the guard exists for the
// unbounded surfaces — bulk get_components, search_components, and the
// pattern a11y aggregate — where a caller could request enough records to
// overwhelm a downstream LLM's context.
export const CHARACTER_LIMIT = 25000;
