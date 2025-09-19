import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { isObject } from "@phoenix/typeUtils";
import { safelyParseJSON } from "@phoenix/utils/jsonUtils";

/**
 * Detect duplicate keys in JSON string before parsing
 * This catches cases where JSON.parse() would silently overwrite duplicate keys
 */
function detectDuplicateKeys(jsonString: string): string | null {
  try {
    const keyPattern = /"((?:[^"\\]|\\.)*)"\s*:/g;
    const keys: string[] = [];
    let match;

    while ((match = keyPattern.exec(jsonString)) !== null) {
      const key = match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      keys.push(key);
    }

    if (keys.length === 0) return null;

    const exactKeys = new Set(keys);
    if (exactKeys.size !== keys.length) {
      return "Duplicate keys found in JSON object";
    }

    const lowerKeys = keys.map((key) => key.toLowerCase());
    const uniqueLowerKeys = new Set(lowerKeys);
    if (uniqueLowerKeys.size !== lowerKeys.length) {
      return "Duplicate header names found (header names are case-insensitive)";
    }

    return null;
  } catch {
    return null;
  }
}

// RFC 7230 compliant regex patterns
const HTTP_HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/;
const HTTP_HEADER_VALUE_PATTERN = /^[\x20-\x7E\t]*$/;

const EMPTY_JSON_STATES = ["", "{}", "{\n  \n}"] as const;

/**
 * HTTP header name validation following RFC 7230
 * Header names are case-insensitive and consist of ASCII letters, digits, and certain special characters
 */
const httpHeaderNameSchema = z
  .string()
  .min(1, "Header name cannot be empty")
  .regex(
    HTTP_HEADER_NAME_PATTERN,
    "Header name must only contain valid HTTP header characters (letters, numbers, and !#$%&'*+-.^_`|~)"
  );

/**
 * HTTP header value validation following RFC 7230
 * Header values can contain any visible ASCII characters and spaces/tabs
 */
const httpHeaderValueSchema = z
  .string()
  .refine(
    (value) => HTTP_HEADER_VALUE_PATTERN.test(value),
    "Header value must only contain visible ASCII characters"
  );

/**
 * Schema for HTTP headers as a key-value object
 */
export const httpHeadersSchema = z
  .record(httpHeaderNameSchema, httpHeaderValueSchema)
  .describe("HTTP headers as key-value pairs")
  .refine((headers) => {
    // Check for duplicate header names (case-insensitive)
    const names = Object.keys(headers);
    const lowerNames = names.map((name) => name.toLowerCase());
    const uniqueNames = new Set(lowerNames);
    return uniqueNames.size === names.length;
  }, "Duplicate header names are not allowed (header names are case-insensitive)");

/**
 * The type of HTTP headers
 */
export type HttpHeaders = z.infer<typeof httpHeadersSchema>;

/**
 * JSON Schema for HTTP headers (for JSONEditor validation)
 */
export const httpHeadersJSONSchema = zodToJsonSchema(httpHeadersSchema, {
  name: "HttpHeaders",
  definitions: {},
});

/**
 * Transform a string to HTTP headers schema.
 *
 * If the string is not valid JSON, return null.
 * If the string is valid JSON and matches the HTTP headers schema, return the parsed headers.
 */
export const stringToHttpHeadersSchema = z.string().transform((s, ctx) => {
  const trimmedValue = s.trim();
  if ((EMPTY_JSON_STATES as readonly string[]).includes(trimmedValue)) {
    return null;
  }

  const duplicateError = detectDuplicateKeys(trimmedValue);
  if (duplicateError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: duplicateError,
    });
    return z.NEVER;
  }

  const { json } = safelyParseJSON(s);
  if (!isObject(json)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Custom headers must be a valid JSON object",
    });
    return z.NEVER;
  }

  const { success, data } = httpHeadersSchema.safeParse(json);
  if (!success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Custom headers must be a valid HTTP headers object",
    });
    return z.NEVER;
  }

  // Only return headers if there are actually headers (not empty object)
  const hasHeaders = Object.keys(data).length > 0;
  return hasHeaders ? data : null;
});
