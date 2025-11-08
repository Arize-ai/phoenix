import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { isObject } from "@phoenix/typeUtils";

/**
 * Detect duplicate keys in raw JSON string before parsing.
 * This is necessary because JSON.parse() silently overwrites duplicates.
 *
 * IMPORTANT: This is intentionally conservative - for complex nested JSON,
 * we skip duplicate detection and let JSON.parse handle it. This avoids
 * false positives while catching the common case of flat HTTP headers.
 */
function detectDuplicateKeys(jsonString: string): string | null {
  const trimmed = jsonString.trim();

  // Quick validation: must be an object
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  // Conservative approach: if we detect nested objects/arrays, skip duplicate check
  // This avoids false positives from nested structures
  const hasNestedStructures = /[{}[\]]/.test(trimmed.slice(1, -1));
  if (hasNestedStructures) {
    return null; // Skip duplicate detection for complex JSON
  }

  // For simple flat objects, use regex to find all quoted strings followed by colon
  const keyMatches = trimmed.match(/"([^"\\]|\\.)*"\s*:/g);
  if (!keyMatches) return null;

  const keys = keyMatches.map((match) => {
    const quotedKey = match.slice(0, match.indexOf(":"));
    try {
      // Use JSON.parse to properly handle escape sequences
      return JSON.parse(quotedKey);
    } catch {
      return quotedKey; // Fallback for malformed keys
    }
  });

  // Check for exact duplicates
  const seenKeys = new Set<string>();
  for (const key of keys) {
    if (seenKeys.has(key)) {
      return "Duplicate keys found in JSON object";
    }
    seenKeys.add(key);
  }

  // Check for case-insensitive duplicates (HTTP headers)
  const seenLowerKeys = new Set<string>();
  for (const key of keys) {
    const lowerKey = key.toLowerCase();
    if (seenLowerKeys.has(lowerKey)) {
      return "Duplicate header names found (header names are case-insensitive)";
    }
    seenLowerKeys.add(lowerKey);
  }

  return null;
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
// Note: Duplicate checking is handled in detectDuplicateKeys() before parsing
export const httpHeadersSchema = z
  .record(httpHeaderNameSchema, httpHeaderValueSchema)
  .describe("HTTP headers as key-value pairs");

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
 * Returns null for empty input, validated headers object for valid input.
 */
export const stringToHttpHeadersSchema = z.string().transform((input, ctx) => {
  const trimmed = input.trim();

  if ((EMPTY_JSON_STATES as readonly string[]).includes(trimmed)) {
    return null;
  }

  const duplicateError = detectDuplicateKeys(trimmed);
  if (duplicateError) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: duplicateError,
    });
    return z.NEVER;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (!isObject(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Must be a valid JSON object",
      });
      return z.NEVER;
    }

    const result = httpHeadersSchema.safeParse(parsed);
    if (!result.success) {
      // Forward the original validation error for better UX
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          result.error.errors[0]?.message || "Invalid HTTP headers format",
      });
      return z.NEVER;
    }

    return Object.keys(result.data).length > 0 ? result.data : null;
  } catch (_error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid JSON format",
    });
    return z.NEVER;
  }
});
