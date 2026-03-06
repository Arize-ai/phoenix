import { removeBOM } from "./csvUtils";

export type JSONLParseError = {
  line: number;
  message: string;
};

export type JSONLParseResult =
  | { success: true; keys: string[] }
  | { success: false; error: JSONLParseError };

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
 * Parses a single JSONL line and extracts keys.
 * Returns null if the line is empty/whitespace.
 * Throws an error with a descriptive message if parsing fails.
 */
function parseJSONLLine(line: string): { keys: string[] } | null {
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

  return { keys: Object.keys(json) };
}

/**
 * Parses JSONL keys from a file using streaming.
 * Only reads enough of the file to extract keys from the first N rows.
 * Handles arbitrarily large files efficiently.
 *
 * @param file - The file to parse
 * @param maxRows - Maximum number of rows to parse (default: 10)
 */
export async function parseJSONLKeys(
  file: File,
  maxRows: number = DEFAULT_MAX_ROWS
): Promise<JSONLParseResult> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bomChecked = false;
  let lineNumber = 0;
  let parsedRows = 0;
  const allKeys = new Set<string>();

  try {
    while (parsedRows < maxRows) {
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
      while (
        parsedRows < maxRows &&
        (newlineIndex = buffer.indexOf("\n")) !== -1
      ) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // Handle Windows line endings
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        lineNumber++;

        try {
          const result = parseJSONLLine(line);
          if (result !== null) {
            result.keys.forEach((key) => allKeys.add(key));
            parsedRows++;
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
      }

      if (done) {
        // Process any remaining content in the buffer (file doesn't end with newline)
        if (buffer.trim() !== "" && parsedRows < maxRows) {
          lineNumber++;
          try {
            const result = parseJSONLLine(buffer);
            if (result !== null) {
              result.keys.forEach((key) => allKeys.add(key));
              parsedRows++;
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
        }
        break;
      }
    }

    if (parsedRows === 0) {
      return {
        success: false,
        error: { line: 0, message: "JSONL file is empty" },
      };
    }

    return { success: true, keys: Array.from(allKeys) };
  } finally {
    reader.cancel();
  }
}

/**
 * Parses a single JSONL line and returns the parsed object.
 * Returns null if the line is empty/whitespace or not a valid JSON object.
 */
function parseJSONLRowLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (trimmed === "") {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    // Skip invalid JSON lines
    return null;
  }

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    // Skip non-object values
    return null;
  }

  return json as Record<string, unknown>;
}

/**
 * Parses JSONL rows from a file using streaming.
 * Only reads enough of the file to parse the first N valid rows.
 * Handles arbitrarily large files efficiently.
 * Invalid JSON lines are skipped (not treated as errors).
 *
 * @param file - The file to parse
 * @param maxRows - Maximum number of rows to parse (default: 10)
 * @returns Array of parsed JSON objects
 */
export async function parseJSONLRows(
  file: File,
  maxRows: number = DEFAULT_MAX_ROWS
): Promise<Record<string, unknown>[]> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bomChecked = false;
  const rows: Record<string, unknown>[] = [];

  try {
    while (rows.length < maxRows) {
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
      while (
        rows.length < maxRows &&
        (newlineIndex = buffer.indexOf("\n")) !== -1
      ) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // Handle Windows line endings
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        const result = parseJSONLRowLine(line);
        if (result !== null) {
          rows.push(result);
        }
      }

      if (done) {
        // Process any remaining content in the buffer (file doesn't end with newline)
        if (buffer.trim() !== "" && rows.length < maxRows) {
          const result = parseJSONLRowLine(buffer);
          if (result !== null) {
            rows.push(result);
          }
        }
        break;
      }
    }

    return rows;
  } finally {
    reader.cancel();
  }
}

/**
 * Counts the total number of valid JSON object rows in a JSONL file using streaming.
 * Invalid JSON lines are skipped (not counted).
 * Handles arbitrarily large files efficiently.
 */
export async function countJSONLRows(file: File): Promise<number> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bomChecked = false;
  let count = 0;

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

      // Count complete lines in the buffer
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        // Handle Windows line endings
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }

        const result = parseJSONLRowLine(line);
        if (result !== null) {
          count++;
        }
      }

      if (done) {
        // Process any remaining content in the buffer
        if (buffer.trim() !== "") {
          const result = parseJSONLRowLine(buffer);
          if (result !== null) {
            count++;
          }
        }
        break;
      }
    }

    return count;
  } finally {
    reader.cancel();
  }
}
