import { removeBOM } from "./csvUtils";

export type JSONLParseError = {
  line: number;
  message: string;
};

export type JSONLParseResult =
  | { success: true; keys: string[] }
  | { success: false; error: JSONLParseError };

/**
 * Parses JSONL text to extract all unique keys from all JSON objects.
 * Handles BOM, Windows/Unix line endings, and provides detailed error messages.
 */
export function parseJSONLKeys(jsonlText: string): JSONLParseResult {
  const text = removeBOM(jsonlText);
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return {
      success: false,
      error: { line: 0, message: "JSONL file is empty" },
    };
  }

  const allKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    let json: unknown;
    try {
      json = JSON.parse(lines[i]);
    } catch (error) {
      return {
        success: false,
        error: {
          line: i + 1,
          message: `Invalid JSON - ${(error as Error).message}`,
        },
      };
    }

    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      return {
        success: false,
        error: {
          line: i + 1,
          message: `Expected a JSON object, got ${Array.isArray(json) ? "array" : typeof json}`,
        },
      };
    }

    Object.keys(json).forEach((key) => allKeys.add(key));
  }

  return { success: true, keys: Array.from(allKeys) };
}

/**
 * Formats a JSONL parse error into a user-friendly error message.
 */
export function formatJSONLError(error: JSONLParseError): string {
  if (error.line === 0) {
    return error.message;
  }
  return `Line ${error.line}: ${error.message}`;
}
