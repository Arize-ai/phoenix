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
 * Parses CSV text to extract column names from the header row.
 * Handles BOM, Windows/Unix line endings, and quoted fields.
 */
export function parseCSVColumns(csvText: string): string[] {
  const text = removeBOM(csvText);

  // Normalize line endings and get first line
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine) {
    return [];
  }

  return parseCSVRow(firstLine);
}
