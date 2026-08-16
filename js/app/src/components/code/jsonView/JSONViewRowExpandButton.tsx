import { RowExpandToggleButton } from "@phoenix/components/table";

import { useJSONView } from "./JSONViewContext";

/**
 * Toggles how much of a row the table shows: the wrapped text, so a value can
 * be read where it sits, or a single clipped line each, so the keys can be
 * scanned down an even column.
 *
 * Offered only in table mode — the JSON document has no rows to give back.
 */
export function JSONViewRowExpandButton() {
  const { mode, isViewable, areRowsExpanded, setAreRowsExpanded } =
    useJSONView();
  if (!isViewable || mode !== "table") {
    return null;
  }
  return (
    <RowExpandToggleButton
      size="S"
      isExpanded={areRowsExpanded}
      onChange={setAreRowsExpanded}
    />
  );
}
