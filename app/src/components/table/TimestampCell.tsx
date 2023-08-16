import React from "react";
import { CellContext } from "@tanstack/react-table";

import { isStringOrNull } from "@phoenix/typeUtils";

/**
 * A table cell that nicely formats a timestamp
 */
export function TimestampCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  if (!isStringOrNull(value)) {
    throw new Error("TimestampCell only supports number or null values.");
  }
  const timestamp = value != null ? new Date(value).toLocaleString() : "--";
  return <time title={value != null ? String(value) : ""}>{timestamp}</time>;
}
