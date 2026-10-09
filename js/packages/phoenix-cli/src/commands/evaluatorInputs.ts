import * as fs from "node:fs";

import { InvalidArgumentError } from "../exitCodes";

/**
 * Parse a flag whose value is a JSON document. Reports the flag name so the
 * user can see which of several JSON flags was malformed.
 */
export function parseJsonFlag<T>({
  flag,
  value,
}: {
  flag: string;
  value: string;
}): T {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new InvalidArgumentError(
      `${flag} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse a flag whose value is a JSON object, rejecting arrays and scalars.
 */
export function parseJsonObjectFlag<T extends object>({
  flag,
  value,
}: {
  flag: string;
  value: string;
}): T {
  const parsed = parseJsonFlag<unknown>({ flag, value });
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InvalidArgumentError(`${flag} must be a JSON object`);
  }
  return parsed as T;
}

/**
 * Parse a flag whose value is a JSON array, rejecting objects and scalars.
 * With `nonEmpty`, an empty array is rejected too, offering `nonEmpty.hint`.
 */
export function parseJsonArrayFlag<T>({
  flag,
  value,
  nonEmpty,
}: {
  flag: string;
  value: string;
  nonEmpty?: { hint: string };
}): T[] {
  const parsed = parseJsonFlag<unknown>({ flag, value });
  if (!Array.isArray(parsed)) {
    throw new InvalidArgumentError(`${flag} must be a JSON array`);
  }
  if (nonEmpty && parsed.length === 0) {
    throw new InvalidArgumentError(`${flag} must be a non-empty JSON array`, {
      hint: nonEmpty.hint,
    });
  }
  return parsed as T[];
}

/**
 * Resolve text supplied either inline or as a file path. Exactly one of the
 * two must be given.
 */
export function readInlineOrFile({
  inline,
  inlineFlag,
  file,
  fileFlag,
}: {
  inline?: string;
  inlineFlag: string;
  file?: string;
  fileFlag: string;
}): string {
  if (inline !== undefined && file !== undefined) {
    throw new InvalidArgumentError(
      `Specify either ${inlineFlag} or ${fileFlag}, not both`
    );
  }
  if (inline !== undefined) {
    return inline;
  }
  if (file !== undefined) {
    try {
      return fs.readFileSync(file, "utf8");
    } catch (error) {
      throw new InvalidArgumentError(
        `Could not read ${fileFlag} ${file}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  throw new InvalidArgumentError(
    `Missing required flag ${inlineFlag} or ${fileFlag}`
  );
}
