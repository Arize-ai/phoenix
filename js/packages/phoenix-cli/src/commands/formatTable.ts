/**
 * Formats an array of flat objects as an ASCII table suitable for terminal output.
 *
 * Produces a compact table with column headers aligned to the widest value in
 * each column, matching the style of Node.js `console.table`.
 *
 * @param rows - Array of objects whose keys become column headers.
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
export function formatTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]!);

  // Pre-stringify all cell values once; reuse for both width calculation and rendering.
  const stringRows = rows.map((row) =>
    headers.map((h) => String(row[h] ?? ""))
  );

  const colWidths = headers.map((h, i) =>
    stringRows.reduce((max, row) => Math.max(max, row[i]!.length), h.length)
  );

  const top = "┌" + colWidths.map((w) => "─".repeat(w + 2)).join("┬") + "┐";
  const mid = "├" + colWidths.map((w) => "─".repeat(w + 2)).join("┼") + "┤";
  const bot = "└" + colWidths.map((w) => "─".repeat(w + 2)).join("┴") + "┘";

  const headerRow =
    "│" + headers.map((h, i) => ` ${h.padEnd(colWidths[i]!)} `).join("│") + "│";

  const dataRows = stringRows.map(
    (row) =>
      "│" +
      row.map((cell, i) => ` ${cell.padEnd(colWidths[i]!)} `).join("│") +
      "│"
  );

  return [top, headerRow, mid, ...dataRows, bot].join("\n");
}
