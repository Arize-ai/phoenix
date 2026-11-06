export interface FormatTableOptions {
  /** Terminal width to fit the table within. Defaults to `process.stdout.columns` or 80. */
  maxWidth?: number;
}

/**
 * Formats an array of flat objects as an ASCII table suitable for terminal output.
 *
 * Produces a compact table with column headers aligned to the widest value in
 * each column. When the table would exceed the terminal width, the widest
 * columns are truncated with an ellipsis (`…`) so the table fits.
 *
 * @param rows - Array of objects whose keys become column headers.
 * @param options - Optional configuration.
 * @returns A multi-line string representing the table, or an empty string when
 *   `rows` is empty.
 *
 * @example
 * formatTable([
 *   { name: "my-dataset", examples: 3, created: "1/1/2026" },
 *   { name: "other",      examples: 10, created: "2/1/2026" },
 * ]);
 * // ┌────────────┬──────────┬──────────┐
 * // │ name       │ examples │ created  │
 * // ├────────────┼──────────┼──────────┤
 * // │ my-dataset │ 3        │ 1/1/2026 │
 * // │ other      │ 10       │ 2/1/2026 │
 * // └────────────┴──────────┴──────────┘
 */
export function formatTable(
  rows: Record<string, unknown>[],
  options?: FormatTableOptions
): string {
  if (rows.length === 0) {
    return "";
  }

  // Only constrain width when explicitly requested or when connected to a TTY.
  // In non-TTY environments (pipes, CI) we render the full table.
  const terminalWidth = options?.maxWidth ?? process.stdout.columns ?? Infinity;

  const headers = Object.keys(rows[0]!);

  // Pre-stringify all cell values once; reuse for both width calculation and rendering.
  const stringRows = rows.map((row) =>
    headers.map((header) => String(row[header] ?? ""))
  );

  const naturalWidths = headers.map((header, colIndex) =>
    stringRows.reduce(
      (max, row) => Math.max(max, row[colIndex]!.length),
      header.length
    )
  );

  const colWidths = fitColumnsToWidth({
    naturalWidths,
    terminalWidth,
    columnCount: headers.length,
  });

  const top =
    "┌" + colWidths.map((width) => "─".repeat(width + 2)).join("┬") + "┐";
  const mid =
    "├" + colWidths.map((width) => "─".repeat(width + 2)).join("┼") + "┤";
  const bot =
    "└" + colWidths.map((width) => "─".repeat(width + 2)).join("┴") + "┘";

  const headerRow =
    "│" +
    headers
      .map(
        (header, colIndex) => ` ${truncateCell(header, colWidths[colIndex]!)} `
      )
      .join("│") +
    "│";

  const dataRows = stringRows.map(
    (row) =>
      "│" +
      row
        .map(
          (cell, colIndex) => ` ${truncateCell(cell, colWidths[colIndex]!)} `
        )
        .join("│") +
      "│"
  );

  return [top, headerRow, mid, ...dataRows, bot].join("\n");
}

/** Minimum characters a column can be shrunk to (not counting padding/borders). */
const MIN_COL_WIDTH = 4;

/**
 * Shrinks columns so the rendered table fits within `terminalWidth`.
 *
 * Iteratively trims the widest column by one character until the table fits or
 * every column has reached {@link MIN_COL_WIDTH}.
 */
export function fitColumnsToWidth({
  naturalWidths,
  terminalWidth,
  columnCount,
}: {
  naturalWidths: number[];
  terminalWidth: number;
  columnCount: number;
}): number[] {
  const widths = [...naturalWidths];

  // Fixed overhead: outer borders (2 chars) + inner separators + padding (3 per col: space-content-space│)
  // Each column uses: 1 (border) + 1 (pad) + width + 1 (pad) = width + 3
  // Total: 1 (left border) + sum(width + 3) + ... but last col ends with │ already counted
  // Actual: "│" + columns joined by "│" + "│"
  //   = 1 + columnCount * (1 + width + 1) + (columnCount - 1) * 1 + ... hmm let me think.
  // "│ cell │ cell │" -> 1 + (w+2) + 1 + (w+2) + 1 = 2*w + 4 + 3 = nope, let me just count:
  // For N columns: "│" + N * " {cell} " joined by "│" + "│"
  //   = 1 + N*(w+2) + (N-1)*1 + 1 = N*w + 2*N + N - 1 + 2 = N*w + 3*N + 1
  const fixedOverhead = 3 * columnCount + 1;

  const tableWidth = () =>
    widths.reduce((sum, width) => sum + width, 0) + fixedOverhead;

  while (tableWidth() > terminalWidth) {
    // Find the widest column that is still above the minimum.
    let widestIndex = -1;
    let widestValue = MIN_COL_WIDTH;
    for (let index = 0; index < widths.length; index++) {
      if (widths[index]! > widestValue) {
        widestValue = widths[index]!;
        widestIndex = index;
      }
    }
    if (widestIndex === -1) {
      // Every column is already at minimum — nothing more we can do.
      break;
    }
    widths[widestIndex] = widths[widestIndex]! - 1;
  }

  return widths;
}

/**
 * Pads or truncates a cell value to exactly `width` characters.
 * Values that exceed `width` are trimmed and end with `…`.
 */
export function truncateCell(value: string, width: number): string {
  if (value.length <= width) {
    return value.padEnd(width);
  }
  if (width <= 1) {
    return "…".padEnd(width);
  }
  return value.slice(0, width - 1) + "…";
}
