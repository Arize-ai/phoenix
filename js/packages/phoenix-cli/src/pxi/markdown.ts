import { fitColumnsToWidth, truncateCell } from "../commands/formatTable";

const MARKDOWN_TABLE_SEPARATOR_PATTERN =
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

type ParsedMarkdownTable = {
  rows: string[][];
  nextIndex: number;
};

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  return MARKDOWN_TABLE_SEPARATOR_PATTERN.test(line);
}

function isPotentialMarkdownTableRow(line: string): boolean {
  return line.includes("|") && splitMarkdownTableRow(line).length > 1;
}

function parseMarkdownTable({
  lines,
  startIndex,
}: {
  lines: string[];
  startIndex: number;
}): ParsedMarkdownTable | null {
  const header = lines[startIndex];
  const separator = lines[startIndex + 1];
  if (
    header === undefined ||
    separator === undefined ||
    !isPotentialMarkdownTableRow(header) ||
    !isMarkdownTableSeparator(separator)
  ) {
    return null;
  }

  const rows = [splitMarkdownTableRow(header)];
  let nextIndex = startIndex + 2;
  while (
    nextIndex < lines.length &&
    isPotentialMarkdownTableRow(lines[nextIndex] ?? "")
  ) {
    rows.push(splitMarkdownTableRow(lines[nextIndex]!));
    nextIndex += 1;
  }

  return { rows, nextIndex };
}

function normalizeRows(rows: string[][]): string[][] {
  const columnCount = Math.max(...rows.map((row) => row.length));
  return rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? "")
  );
}

function renderMarkdownTable({
  rows,
  maxWidth = process.stdout.columns ?? Infinity,
}: {
  rows: string[][];
  maxWidth?: number;
}): string {
  const normalizedRows = normalizeRows(rows);
  const naturalWidths = normalizedRows[0]!.map((_, columnIndex) =>
    normalizedRows.reduce(
      (maxWidthForColumn, row) =>
        Math.max(maxWidthForColumn, row[columnIndex]!.length),
      0
    )
  );
  const colWidths = fitColumnsToWidth({
    naturalWidths,
    terminalWidth: maxWidth,
    columnCount: naturalWidths.length,
  });
  const top =
    "┌" + colWidths.map((width) => "─".repeat(width + 2)).join("┬") + "┐";
  const mid =
    "├" + colWidths.map((width) => "─".repeat(width + 2)).join("┼") + "┤";
  const bot =
    "└" + colWidths.map((width) => "─".repeat(width + 2)).join("┴") + "┘";
  const renderedRows = normalizedRows.map(
    (row) =>
      "│" +
      row
        .map(
          (cell, columnIndex) =>
            ` ${truncateCell(cell, colWidths[columnIndex]!)} `
        )
        .join("│") +
      "│"
  );
  const [headerRow = "", ...bodyRows] = renderedRows;
  return [top, headerRow, mid, ...bodyRows, bot].join("\n");
}

export function formatMarkdownForTerminal({
  text,
  maxWidth,
}: {
  text: string;
  maxWidth?: number;
}): string {
  const lines = text.split("\n");
  const formattedLines: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const parsedTable = parseMarkdownTable({ lines, startIndex: index });
    if (parsedTable) {
      formattedLines.push(
        renderMarkdownTable({ rows: parsedTable.rows, maxWidth })
      );
      index = parsedTable.nextIndex;
      continue;
    }
    formattedLines.push(lines[index]!);
    index += 1;
  }
  return formattedLines.join("\n");
}
