import type { JSONSchema7 } from "json-schema";
import type { z } from "zod";
import { z as zod } from "zod";

/**
 * Converts a Zod schema to a `json-schema` `JSONSchema7`.
 *
 * `z.toJSONSchema()` returns Zod's own `ZodStandardJSONSchemaPayload`, which is
 * structurally a JSON Schema but is not assignable to the `json-schema`
 * package's `JSONSchema7` — the two libraries model the same spec with
 * unrelated types. Editors and form fields in this app take `JSONSchema7`.
 *
 * This is the single sanctioned home for bridging the two. Prefer exporting a
 * schema through this helper over asserting at each consumer, so the gap is
 * acknowledged in one reviewed place.
 */
export function toJSONSchema7(schema: z.ZodType): JSONSchema7 {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see the doc comment above; the two libraries' JSON Schema types are structurally compatible but nominally unrelated
  return zod.toJSONSchema(schema) as JSONSchema7;
}
