import React, { useMemo } from "react";
import { CellContext } from "@tanstack/react-table";

import { isObject } from "@phoenix/typeUtils";

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
 * A table cell that is designed to show an example input or output.
 */

export function ExampleIOCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  const fullValue = useMemo(() => JSON.stringify(value), [value]);
  if (!isObject(value)) {
    return <span>--</span>;
  }
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length === 1) {
    const key = Object.keys(value)[0];
    if (typeof obj[key] === "string") {
      return <span title={fullValue}>{formatText(obj[key])}</span>;
    }
  }
  return <span>{formatText(fullValue)}</span>;
}
