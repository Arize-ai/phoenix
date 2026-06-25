import { Lexer, Marked, type Token } from "marked";
import { markedTerminal } from "marked-terminal";

import { fitColumnsToWidth, truncateCell } from "../commands/formatTable";

const MARKDOWN_TABLE_SEPARATOR_PATTERN =
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

type ParsedMarkdownTable = {
  rows: string[][];
  nextIndex: number;
};

type RenderedTableCell = {
  visibleText: string;
  renderedText: string;
};

type RenderedInlineMarkdown = {
  visibleText: string;
  renderedText: string;
};

const ANSI_OSC_HYPERLINK_PREFIX = "\u001B]8;;";
const ANSI_OSC_TERMINATOR = "\u0007";
const ANSI_OSC_HYPERLINK_SUFFIX = `${ANSI_OSC_HYPERLINK_PREFIX}${ANSI_OSC_TERMINATOR}`;
const ANSI_LINK_STYLE = "\u001B[4m\u001B[94m";
const ANSI_LINK_STYLE_RESET = "\u001B[39m\u001B[24m";

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

function hasNestedInlineTokens(
  token: Token
): token is Token & { raw: string; text: string; tokens: Token[] } {
  return (
    "raw" in token &&
    typeof token.raw === "string" &&
    "text" in token &&
    typeof token.text === "string" &&
    "tokens" in token &&
    Array.isArray(token.tokens)
  );
}

function createTerminalHyperlink({
  text,
  href,
}: {
  text: string;
  href: string;
}): string {
  if (!text || !href) {
    return text;
  }
  return `${ANSI_OSC_HYPERLINK_PREFIX}${href}${ANSI_OSC_TERMINATOR}${ANSI_LINK_STYLE}${text}${ANSI_LINK_STYLE_RESET}${ANSI_OSC_HYPERLINK_SUFFIX}`;
}

function renderInlineMarkdownToken({
  token,
  phoenixBaseUrl,
}: {
  token: Token;
  phoenixBaseUrl?: string;
}): RenderedInlineMarkdown {
  if (token.type === "link") {
    const renderedLabel = renderInlineMarkdownTokens({
      tokens: token.tokens ?? new Lexer().inlineTokens(token.text),
      phoenixBaseUrl,
    });
    const resolvedHref = resolvePhoenixMarkdownHref({
      href: token.href,
      phoenixBaseUrl,
    });
    return {
      visibleText: renderedLabel.visibleText,
      renderedText: createTerminalHyperlink({
        text: renderedLabel.renderedText,
        href: resolvedHref,
      }),
    };
  }
  if (token.type === "image") {
    const resolvedHref = resolvePhoenixMarkdownHref({
      href: token.href,
      phoenixBaseUrl,
    });
    return {
      visibleText: token.text,
      renderedText: createTerminalHyperlink({
        text: token.text,
        href: resolvedHref,
      }),
    };
  }
  if (token.type === "codespan") {
    return {
      visibleText: token.text,
      renderedText: token.text,
    };
  }
  if (token.type === "br") {
    return {
      visibleText: " ",
      renderedText: " ",
    };
  }
  if (token.type === "text" || token.type === "escape") {
    return {
      visibleText: token.text,
      renderedText: token.text,
    };
  }
  if (hasNestedInlineTokens(token)) {
    return renderInlineMarkdownTokens({
      tokens: token.tokens,
      phoenixBaseUrl,
    });
  }
  if ("raw" in token && typeof token.raw === "string") {
    return {
      visibleText: token.raw,
      renderedText: token.raw,
    };
  }
  return {
    visibleText: "",
    renderedText: "",
  };
}

function renderInlineMarkdownTokens({
  tokens,
  phoenixBaseUrl,
}: {
  tokens: Token[];
  phoenixBaseUrl?: string;
}): RenderedInlineMarkdown {
  return tokens.reduce<RenderedInlineMarkdown>(
    (renderedMarkdown, token) => {
      const renderedToken = renderInlineMarkdownToken({
        token,
        phoenixBaseUrl,
      });
      return {
        visibleText: renderedMarkdown.visibleText + renderedToken.visibleText,
        renderedText:
          renderedMarkdown.renderedText + renderedToken.renderedText,
      };
    },
    { visibleText: "", renderedText: "" }
  );
}

function renderInlineMarkdown({
  text,
  phoenixBaseUrl,
}: {
  text: string;
  phoenixBaseUrl?: string;
}): RenderedInlineMarkdown {
  const lexer = new Lexer();
  return renderInlineMarkdownTokens({
    tokens: lexer.inlineTokens(text),
    phoenixBaseUrl,
  });
}

function renderTableCell({
  cell,
  width,
}: {
  cell: RenderedTableCell;
  width: number;
}): string {
  if (cell.visibleText.length > width) {
    return truncateCell(cell.visibleText, width);
  }
  return `${cell.renderedText}${" ".repeat(width - cell.visibleText.length)}`;
}

function renderMarkdownTable({
  rows,
  maxWidth = process.stdout.columns ?? Infinity,
  phoenixBaseUrl,
}: {
  rows: string[][];
  maxWidth?: number;
  phoenixBaseUrl?: string;
}): string {
  const normalizedRows = normalizeRows(rows).map((row) =>
    row.map((cell) => {
      const renderedCell = renderInlineMarkdown({ text: cell, phoenixBaseUrl });
      return {
        visibleText: renderedCell.visibleText,
        renderedText: renderedCell.renderedText,
      };
    })
  );
  const naturalWidths = normalizedRows[0]!.map((_, columnIndex) =>
    normalizedRows.reduce(
      (maxWidthForColumn, row) =>
        Math.max(maxWidthForColumn, row[columnIndex]!.visibleText.length),
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
            ` ${renderTableCell({
              cell,
              width: colWidths[columnIndex]!,
            })} `
        )
        .join("│") +
      "│"
  );
  const [headerRow = "", ...bodyRows] = renderedRows;
  return [top, headerRow, mid, ...bodyRows, bot].join("\n");
}

// There is only ever one terminal width in play at a time, so a single cached
// renderer is enough to avoid re-registering the marked-terminal extension on
// every render. Rebuild it only when the width actually changes (e.g. resize),
// which keeps this bounded instead of accumulating an entry per resize.
let cachedRenderer: { width: number; renderer: Marked } | null = null;

function isAbsoluteOrSpecialHref(href: string): boolean {
  return (
    href.startsWith("#") ||
    href.startsWith("//") ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href)
  );
}

function getPhoenixBaseUrl(phoenixBaseUrl?: string): URL | null {
  const trimmedBaseUrl = phoenixBaseUrl?.trim();
  if (!trimmedBaseUrl) {
    return null;
  }
  try {
    return new URL(trimmedBaseUrl);
  } catch {
    return null;
  }
}

function getOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`;
}

function getNormalizedBasePath(url: URL): string {
  return url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
}

export function resolvePhoenixMarkdownHref({
  href,
  phoenixBaseUrl,
}: {
  href: string;
  phoenixBaseUrl?: string;
}): string {
  const trimmedHref = href.trim();
  if (!trimmedHref || isAbsoluteOrSpecialHref(trimmedHref)) {
    return href;
  }

  const baseUrl = getPhoenixBaseUrl(phoenixBaseUrl);
  if (!baseUrl) {
    return href;
  }

  const origin = getOrigin(baseUrl);
  const basePath = getNormalizedBasePath(baseUrl);
  if (trimmedHref.startsWith("/")) {
    return new URL(`${basePath}${trimmedHref}`, origin).toString();
  }

  return new URL(trimmedHref, `${origin}${basePath}/`).toString();
}

function absolutizeMarkdownLinkToken({
  token,
  phoenixBaseUrl,
}: {
  token: Token;
  phoenixBaseUrl?: string;
}) {
  if (token.type !== "link" && token.type !== "image") {
    return;
  }
  token.href = resolvePhoenixMarkdownHref({
    href: token.href,
    phoenixBaseUrl,
  });
}

function getMarkedRenderer(width: number): Marked {
  if (cachedRenderer?.width === width) {
    return cachedRenderer.renderer;
  }
  const renderer = new Marked();
  renderer.use(
    markedTerminal(Number.isFinite(width) ? { width, reflowText: false } : {})
  );
  cachedRenderer = { width, renderer };
  return renderer;
}

function renderMarkdownBlock({
  text,
  maxWidth,
  phoenixBaseUrl,
}: {
  text: string;
  maxWidth: number;
  phoenixBaseUrl?: string;
}): string {
  if (text.trim() === "") {
    return "";
  }
  const renderer = getMarkedRenderer(maxWidth);
  // The marked-terminal extension renders synchronously, so `parse` returns a
  // string (marked's types don't narrow this from the `async: false` option).
  const rendered = renderer.parse(text, {
    async: false,
    walkTokens: (token) => {
      absolutizeMarkdownLinkToken({ token, phoenixBaseUrl });
    },
  }) as string;
  return rendered.replace(/\n+$/, "");
}

export function formatMarkdownForTerminal({
  text,
  maxWidth = process.stdout.columns ?? Infinity,
  phoenixBaseUrl,
}: {
  text: string;
  maxWidth?: number;
  phoenixBaseUrl?: string;
}): string {
  const lines = text.split("\n");
  const segments: string[] = [];
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) {
      return;
    }
    const rendered = renderMarkdownBlock({
      text: buffer.join("\n"),
      maxWidth,
      phoenixBaseUrl,
    });
    if (rendered !== "") {
      segments.push(rendered);
    }
    buffer = [];
  };

  let index = 0;
  while (index < lines.length) {
    const parsedTable = parseMarkdownTable({ lines, startIndex: index });
    if (parsedTable) {
      // Tables keep the bespoke, width-aware renderer; everything else flows
      // through marked-terminal for clean headings, lists, emphasis, and code.
      flushBuffer();
      segments.push(
        renderMarkdownTable({
          rows: parsedTable.rows,
          maxWidth,
          phoenixBaseUrl,
        })
      );
      index = parsedTable.nextIndex;
      continue;
    }
    buffer.push(lines[index]!);
    index += 1;
  }
  flushBuffer();

  return segments.join("\n");
}
