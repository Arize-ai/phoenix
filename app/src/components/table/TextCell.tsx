import React from "react";

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
export function TextCell({ value }: { value: string | null }) {
  const str = value != null ? formatText(value) : "--";
  return <span title={value != null ? value : ""}>{str}</span>;
}
