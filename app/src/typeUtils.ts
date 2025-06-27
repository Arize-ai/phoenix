import { z } from "zod";

/**
 * Utility function that uses the type system to check if a switch statement is exhaustive.
 * If the switch statement is not exhaustive, there will be a type error caught in typescript
 *
 * See https://stackoverflow.com/questions/39419170/how-do-i-check-that-a-switch-block-is-exhaustive-in-typescript for more details.
 */
export function assertUnreachable(_: never): never {
  throw new Error("Unreachable");
}

/**
 * A type guard for checking if a value is a number or null
 */
export function isNumberOrNull(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

/**
 * A type guard for checking if a value is a string or null
 */
export function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

/**
 * A type guard for checking if a value is a string or null
 */
export function isStringOrNullOrUndefined(
  value: unknown
): value is string | null | undefined {
  return isStringOrNull(value) || value === undefined;
}

/**
 * A type guard for checking if a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item) => typeof item === "string");
}

/**
 * A type guard for checking if a value is an object
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * A type guard for checking if a value is an object with string keys
 */
export function isStringKeyedObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    isObject(value) &&
    Object.keys(value).every((key) => typeof key === "string")
  );
}

/**
 * Makes a type mutable
 */
export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * A zod type utility that ensures that the schema is written to correctly match (at least) what is included in the type.
 * Note it does not guard against extra fields in the schema not present in the type.
 * @example
 * ```typescript
 * const chatMessageSchema = schemaForType<ChatMessage>()(
 *  z.object({
 *    id: z.number(),
 *    role: chatMessageRolesSchema,
 *    content: z.string(),
 *  })
 * );
 * ```
 * Taken from the zod maintainer here:
 * @see https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
 */
export const schemaForType =
  <T>() =>
  <S extends z.ZodType<T>>(arg: S) => {
    return arg;
  };
