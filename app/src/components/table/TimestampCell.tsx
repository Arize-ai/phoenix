import { CellContext } from "@tanstack/react-table";

import { usePreferencesContext } from "@phoenix/contexts";
import { isStringOrNullOrUndefined } from "@phoenix/typeUtils";

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
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );

  const value = getValue();
  if (!isStringOrNullOrUndefined(value)) {
    throw new Error(
      "TimestampCell only supports string, null, or undefined values."
    );
  }

  const formatOptions =
    displayTimezone === "UTC" ? { ...format, timeZone: "UTC" } : format;

  const timestamp =
    value != null ? new Date(value).toLocaleString([], formatOptions) : "--";
  return <time title={value != null ? String(value) : ""}>{timestamp}</time>;
}
