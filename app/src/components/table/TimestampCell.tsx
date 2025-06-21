import { CellContext } from "@tanstack/react-table";

import { isStringOrNull } from "@phoenix/typeUtils";

export const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

/**
 * A table cell that nicely formats a timestamp
 */
export function TimestampCell<TData extends object, TValue>({
  getValue,
  format = DEFAULT_FORMAT,
}: CellContext<TData, TValue> & { format?: Intl.DateTimeFormatOptions }) {
  const value = getValue();
  if (!isStringOrNull(value)) {
    throw new Error("TimestampCell only supports string or null values.");
  }
  const timestamp =
    value != null ? new Date(value).toLocaleString([], format) : "--";
  return <time title={value != null ? String(value) : ""}>{timestamp}</time>;
}
