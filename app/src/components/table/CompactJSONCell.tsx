import { CellContext } from "@tanstack/react-table";

import { JSONText } from "@phoenix/components/code/JSONText";

const MAX_LENGTH = 100;

/**
 * A table cell that is designed to show JSON in a compact form.
 * It will truncate the text if it is too long.
 */
export function CompactJSONCell<TData extends object, TValue>({
  getValue,
}: CellContext<TData, TValue>) {
  const value = getValue();
  return <JSONText json={value} maxLength={MAX_LENGTH} />;
}
