// Maximum size (in characters of the serialized JSON) of a single tool
// response before the server appends a soft-limit warning (the data is never
// dropped — see contentFor()). The guard exists for the unbounded surfaces —
// bulk get_components, search_components, and the pattern a11y aggregate —
// where a caller could request enough records to overwhelm a downstream
// LLM's context.
//
// P6-194 — raised from 25,000: with compact (non-pretty-printed) JSON, the
// single heaviest canonical component serializes to ~55,000 chars on its own,
// which meant the warning fired on 33/41 components via get_component alone —
// an alarm that always rings stops signalling anything. 60,000 sits above
// every current single-component response, so the warning is reserved for
// genuinely unbounded multi-record requests.
export const CHARACTER_LIMIT = 60000;
