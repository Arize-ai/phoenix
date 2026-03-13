import { removeBOM } from "./csvUtils";
import { isPlainObject } from "./jsonUtils";

export type JSONLParseError = {
  line: number;
  message: string;
};

/**
 * Gets a human-readable type description for error messages.
 * Handles the JavaScript quirk where typeof null === "object".
 */
function getTypeDescription(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
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

const DEFAULT_MAX_ROWS = 10;

/**
 * Parses a single JSONL line and returns the parsed object with its keys.
 * Returns null if the line is empty/whitespace.
 * Throws an error with a descriptive message if parsing fails.
 */
function parseJSONLLine(
  line: string
): { keys: string[]; data: Record<string, unknown> } | null {
  const trimmed = line.trim();
  if (trimmed === "") {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`Invalid JSON - ${(error as Error).message}`);
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error(`Expected a JSON object, got ${getTypeDescription(json)}`);
  }

  return { keys: Object.keys(json), data: json as Record<string, unknown> };
}

/**
 * Checks if a line looks like a JSON object (starts with '{' after trimming).
 * This is a fast heuristic for counting without full JSON parsing.
 */
function looksLikeJSONObject(line: string): boolean {
  const trimmed = line.trim();
  // A valid JSON object line must start with '{' and end with '}'
  return trimmed.length > 0 && trimmed[0] === "{" && trimmed.endsWith("}");
}

/**
 * Result of parsing a JSONL file in a single pass.
 */
export type JSONLFileParseResult =
  | {
      success: true;
      /** All unique keys found across preview rows */
      keys: string[];
      /** Preview rows (up to maxPreviewRows) */
      previewRows: Record<string, unknown>[];
      /** Total number of rows (using fast heuristic counting) */
      totalRowCount: number;
      /**
       * Keys that have plain object values in ALL preview rows.
       * These keys can be "collapsed" - their children promoted to top-level.
       */
      collapsibleKeys: string[];
    }
  | {
      success: false;
      error: JSONLParseError;
    };

/**
 * Parses a JSONL file in a single streaming pass, extracting:
 * - All unique keys from preview rows
 * - Preview rows (up to maxPreviewRows)
 * - Total row count (using fast heuristic)
 *
 * This is more efficient than calling parseJSONLKeys, parseJSONLRows,
 * and countJSONLRows separately, as it only reads the file once.
 *
 * The first N rows (maxPreviewRows) are fully parsed to extract keys and data.
 * Remaining rows are counted using a fast heuristic (checking for '{' prefix).
 */
export async function parseJSONLFile(
  file: File,
  maxPreviewRows: number = DEFAULT_MAX_ROWS
): Promise<JSONLFileParseResult> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bomChecked = false;
  let lineNumber = 0;
  const allKeys = new Set<string>();
  const previewRows: Record<string, unknown>[] = [];
  let totalRowCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      // Remove BOM on first chunk
      if (!bomChecked) {
        buffer = removeBOM(buffer);
        bomChecked = true;
      }

      // Process complete lines in the buffer
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // Handle Windows line endings
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        lineNumber++;

        if (previewRows.length < maxPreviewRows) {
          // Full parse for preview rows
          try {
            const result = parseJSONLLine(line);
            if (result !== null) {
              result.keys.forEach((key) => allKeys.add(key));
              previewRows.push(result.data);
              totalRowCount++;
            }
          } catch (error) {
            return {
              success: false,
              error: {
                line: lineNumber,
                message: (error as Error).message,
              },
            };
          }
        } else {
          // Fast counting for remaining rows
          if (looksLikeJSONObject(line)) {
            totalRowCount++;
          }
        }
      }

      if (done) {
        // Process any remaining content in the buffer
        if (buffer.trim() !== "") {
          lineNumber++;

          if (previewRows.length < maxPreviewRows) {
            try {
              const result = parseJSONLLine(buffer);
              if (result !== null) {
                result.keys.forEach((key) => allKeys.add(key));
                previewRows.push(result.data);
                totalRowCount++;
              }
            } catch (error) {
              return {
                success: false,
                error: {
                  line: lineNumber,
                  message: (error as Error).message,
                },
              };
            }
          } else {
            if (looksLikeJSONObject(buffer)) {
              totalRowCount++;
            }
          }
        }
        break;
      }
    }

    if (previewRows.length === 0) {
      return {
        success: false,
        error: { line: 0, message: "JSONL file is empty" },
      };
    }

    // Compute collapsible keys: keys that have plain object values in ALL preview rows
    const keys = Array.from(allKeys);
    const collapsibleKeys = keys.filter((key) =>
      previewRows.every((row) => key in row && isPlainObject(row[key]))
    );

    return {
      success: true,
      keys,
      previewRows,
      totalRowCount,
      collapsibleKeys,
    };
  } finally {
    reader.cancel();
  }
}
