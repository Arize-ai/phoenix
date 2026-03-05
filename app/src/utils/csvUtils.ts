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

/**
 * Parses CSV column names from a file using streaming.
 * Only reads enough of the file to extract the header row.
 * Handles arbitrarily large files efficiently.
 */
export async function parseCSVColumns(file: File): Promise<string[]> {
  const stream = file.stream();
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bomChecked = false;

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

      // Try to find a complete first row
      const rowEnd = findCompleteCSVRowEnd(buffer);
      if (rowEnd !== -1) {
        const firstRow = buffer.slice(0, rowEnd);
        return parseCSVRow(firstRow);
      }
    }

    // File ended without newline, parse whatever we have
    // This handles single-line CSVs or files without trailing newline
    if (buffer.length > 0) {
      return parseCSVRow(buffer);
    }

    throw new Error("CSV file is empty");
  } finally {
    reader.cancel();
  }
}
