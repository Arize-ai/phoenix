/**
 * Parses a CSV row handling quoted fields per RFC 4180.
 * Handles: quoted fields, commas within quotes, escaped quotes ("").
 */
export function parseCSVRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < row.length) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      current += char;
      i++;
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ",") {
        // End of field
        fields.push(current.trim());
        current = "";
        i++;
        continue;
      }
      current += char;
      i++;
    }
  }

  // Don't forget the last field
  fields.push(current.trim());
  return fields;
}

/**
 * Removes BOM (Byte Order Mark) from the start of a string if present.
 */
export function removeBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Finds the end index of the first complete CSV row in a buffer.
 * Handles quoted fields that may contain newlines.
 * Returns -1 if no complete row is found.
 */
export function findCompleteCSVRowEnd(buffer: string): number {
  let inQuotes = false;
  let i = 0;

  while (i < buffer.length) {
    const char = buffer[i];

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote ("")
        if (i + 1 < buffer.length && buffer[i + 1] === '"') {
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      // Any other character inside quotes (including newlines)
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === "\n") {
        return i;
      }
      if (char === "\r" && i + 1 < buffer.length && buffer[i + 1] === "\n") {
        return i;
      }
      i++;
    }
  }

  return -1; // No complete row found
}

import { isPlainObject, safelyParseJSONString } from "./jsonUtils";

/**
 * Result of parsing a CSV file in a single pass.
 */
export type CSVParseResult = {
  /** Column names from the header row */
  columns: string[];
  /** Preview rows (up to maxPreviewRows) */
  previewRows: string[][];
  /** Total number of data rows (excluding header) */
  totalRowCount: number;
  /**
   * Columns that contain valid JSON objects in ALL preview rows.
   * These columns can be "collapsed" - their children promoted to top-level.
   */
  collapsibleColumns: string[];
};

/**
 * Parses a CSV file in a single streaming pass, extracting:
 * - Column names from the header row
 * - Preview rows (up to maxPreviewRows)
 * - Total row count
 *
 * This is more efficient than calling parseCSVColumns, parseCSVRows,
 * and countCSVRows separately, as it only reads the file once.
 */
export async function parseCSVFile(
  file: File,
  maxPreviewRows: number = 10
): Promise<CSVParseResult> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bomChecked = false;
  let columns: string[] | null = null;
  const previewRows: string[][] = [];
  let totalRowCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Remove BOM on first chunk
      if (!bomChecked) {
        buffer = removeBOM(buffer);
        bomChecked = true;
      }

      // Process complete rows from buffer
      while (true) {
        const rowEnd = findCompleteCSVRowEnd(buffer);
        if (rowEnd === -1) break;

        const row = buffer.slice(0, rowEnd);
        // Advance buffer past the row and newline character(s)
        const newlineLength = buffer[rowEnd] === "\r" ? 2 : 1;
        buffer = buffer.slice(rowEnd + newlineLength);

        if (columns === null) {
          // First row is the header
          columns = parseCSVRow(row);
          continue;
        }

        // Data row
        totalRowCount++;
        if (previewRows.length < maxPreviewRows) {
          previewRows.push(parseCSVRow(row));
        }
      }
    }

    // Handle remaining buffer (file ended without trailing newline)
    if (buffer.length > 0) {
      if (columns === null) {
        // File only has header row (no trailing newline)
        columns = parseCSVRow(buffer);
      } else if (buffer.trim().length > 0) {
        // Remaining data row
        totalRowCount++;
        if (previewRows.length < maxPreviewRows) {
          previewRows.push(parseCSVRow(buffer));
        }
      }
    }

    if (columns === null) {
      throw new Error("CSV file is empty");
    }

    // Compute collapsible columns: columns where ALL preview rows have valid JSON object values
    const collapsibleColumns = columns.filter((_, colIndex) => {
      // Must have at least one preview row to determine collapsibility
      if (previewRows.length === 0) {
        return false;
      }
      return previewRows.every((row) => {
        const cellValue = row[colIndex];
        if (cellValue === undefined || cellValue === "") {
          return false;
        }
        const parsed = safelyParseJSONString(cellValue);
        return isPlainObject(parsed);
      });
    });

    return { columns, previewRows, totalRowCount, collapsibleColumns };
  } finally {
    reader.cancel();
  }
}
