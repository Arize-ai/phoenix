import { css } from "@emotion/react";
import type { CellContext } from "@tanstack/react-table";

const MAX_LENGTH = 100;

/**
 * Truncates the text if it is too long.
 * @param {string} text The text to truncate
 * @returns {string} The truncated text
 */
function formatText(text: string) {
  if (text.length > MAX_LENGTH) {
    return `${text.slice(0, MAX_LENGTH)}...`;
  }
  return text;
}
/**
 * A table cell that is designed to show text. It will truncate the text if it
 * is too long.
 */
export function TextCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  const str =
    value != null && typeof value === "string" ? formatText(value) : "--";
  return <span>{str}</span>;
}

// a stylesheet rule rather than an inline style, which would outrank the
// row-height rules of a table that clips its rows to a single line
const preformattedTextCellCSS = css`
  white-space: pre-wrap;
  // a <pre>'s own block margin would drop the text below the rest of the row
  margin: 0;
`;

/**
 * A table cell that shows pre-formatted text.
 */
export function PreformattedTextCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  const str = value != null && typeof value === "string" ? value : "--";
  return <pre css={preformattedTextCellCSS}>{str}</pre>;
}
