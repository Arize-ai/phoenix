import { z } from "zod";

/**
 * Simple utility to check if two types are exactly equivalent
 */
export type AssertEqual<T, U> =
  (<V>() => V extends T ? 1 : 2) extends <V>() => V extends U ? 1 : 2
    ? true
    : false;

/**
 * Zod utility to check if a schema is defined correctly against a given type
 *
 * @see https://github.com/colinhacks/zod/issues/372#issuecomment-2445439772
 */
export const schemaMatches =
  <T>() =>
  <S extends z.ZodType<T, z.ZodTypeDef, unknown>>(
    schema: AssertEqual<S["_output"], T> extends true
      ? S
      : S & {
          "types do not match": {
            expected: T;
            received: S["_output"];
          };
        }
  ): S => {
    return schema;
  };
