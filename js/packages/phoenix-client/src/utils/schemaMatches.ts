import type { z } from "zod";

/**
 * Simple utility to check if two types are exactly equivalent
 */
export type AssertEqual<Actual, Expected> =
  (<Argument>() => Argument extends Actual ? 1 : 2) extends <
    Argument,
  >() => Argument extends Expected ? 1 : 2
    ? true
    : false;

/**
 * Zod utility to check if a schema is defined correctly against a given type
 *
 * @see https://github.com/colinhacks/zod/issues/372#issuecomment-2445439772
 */
export const schemaMatches =
  <Value>() =>
  <Schema extends z.ZodType<Value, unknown>>(
    schema: AssertEqual<Schema["_output"], Value> extends true
      ? Schema
      : Schema & {
          "types do not match": {
            expected: Value;
            received: Schema["_output"];
          };
        }
  ): Schema => {
    return schema;
  };
