import { CellContext } from "@tanstack/react-table";

import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { isStringOrNullOrUndefined } from "@phoenix/typeUtils";

/**
 * A table cell that nicely formats a timestamp
 */
export function TimestampCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const { fullTimeFormatter } = useTimeFormatters();
  const value = getValue();
  if (!isStringOrNullOrUndefined(value)) {
    throw new Error(
      "TimestampCell only supports string, null, or undefined values."
    );
  }
  const timestamp = value != null ? fullTimeFormatter(new Date(value)) : "--";
  return <time title={value != null ? String(value) : ""}>{timestamp}</time>;
}
