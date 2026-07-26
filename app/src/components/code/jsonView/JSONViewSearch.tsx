import { DebouncedSearch } from "@phoenix/components/core/field";

import { useJSONView } from "./JSONViewContext";
import { jsonViewSearchCSS } from "./styles";

/**
 * Filters the table's rows by key or value. Rendered only in table mode — the
 * JSON document has no rows to filter, and the browser's own find is the right
 * tool there.
 */
export function JSONViewSearch({
  placeholder = "Search keys and values",
}: {
  /** Placeholder shown before the user types */
  placeholder?: string;
}) {
  const { mode, query, setQuery, isViewable } = useJSONView();
  if (!isViewable || mode !== "table") {
    return null;
  }
  return (
    <div css={jsonViewSearchCSS}>
      <DebouncedSearch
        aria-label="Search JSON keys and values"
        placeholder={placeholder}
        size="S"
        // The field unmounts whenever the table is left or the surrounding card
        // is collapsed, while the filter it set stays applied. Seeding from the
        // query means a remounted box shows the rows that are actually missing
        // rather than reading as empty.
        defaultValue={query}
        onChange={setQuery}
      />
    </div>
  );
}
