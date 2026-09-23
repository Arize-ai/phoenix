import { JSONBlock } from "../JSONBlock";
import { PreBlock } from "../PreBlock";
import { JSONTable } from "./JSONTable";
import { useJSONView } from "./JSONViewContext";

/**
 * The rendering itself — the JSON document or the table of flattened keys —
 * and nothing else. Every control lives outside it, so a card can put them in
 * its header rather than stacking a toolbar on top of the content.
 *
 * A value that is not (and does not parse to) an object or array is rendered
 * verbatim; there is no second view of it to switch to.
 */
export function JSONViewBody({
  emptyMessage = "No entries",
  noResultsMessage = "No matching keys or values",
}: {
  /** Shown in the table when the value has no entries at all */
  emptyMessage?: string;
  /** Shown in the table when the search excluded every entry */
  noResultsMessage?: string;
}) {
  const {
    isViewable,
    mode,
    value,
    jsonText,
    visibleEntries,
    query,
    areRowsExpanded,
  } = useJSONView();

  if (!isViewable) {
    return <PreBlock>{String(value)}</PreBlock>;
  }

  if (mode === "table") {
    return (
      <JSONTable
        entries={visibleEntries}
        emptyMessage={query ? noResultsMessage : emptyMessage}
        areRowsExpanded={areRowsExpanded}
      />
    );
  }

  return <JSONBlock value={jsonText} />;
}
