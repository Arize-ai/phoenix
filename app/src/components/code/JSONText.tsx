import React, { useMemo } from "react";

import { isObject } from "@phoenix/typeUtils";

/**
 * Truncates the text if it is too long.
 * @param {string} text The text to truncate
 * @returns {string} The truncated text
 */
function formatText(text: string, maxLength: number) {
  if (text.length > maxLength) {
    return `${text.slice(0, maxLength)}...`;
  }
  return text;
}

export function JSONText({
  json,
  maxLength,
}: {
  json: unknown;
  maxLength?: number;
}) {
  const hasMaxLength = typeof maxLength === "number";
  const fullValue = useMemo(() => JSON.stringify(json), [json]);
  if (!isObject(json)) {
    // Just show text and log a warning
    // eslint-disable-next-line no-console
    console.warn("JSONText component received a non-object value", json);
    return <span>{String(json)}</span>;
  }
  const obj = json as Record<string, unknown>;
  // If the object has only one key and the value is a string, show the string
  if (Object.keys(obj).length === 1) {
    const key = Object.keys(obj)[0];
    const singleValue = obj[key];
    if (typeof singleValue === "string") {
      const singleValueStr: string = hasMaxLength
        ? formatText(singleValue, maxLength)
        : singleValue;
      return <span title={fullValue}>{singleValueStr}</span>;
    }
  }
  const textValue = hasMaxLength ? formatText(fullValue, maxLength) : fullValue;
  return <span title={fullValue}>{textValue}</span>;
}
