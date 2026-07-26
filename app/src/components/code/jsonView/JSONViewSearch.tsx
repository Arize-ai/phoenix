import { SearchButton } from "@phoenix/components/core/field";

import { useJSONView } from "./JSONViewContext";

/**
 * Filters the table's rows by key or value. Rendered only in table mode — the
 * JSON document has no rows to filter, and the browser's own find is the right
 * tool there.
 *
 * Rests as an icon button so the toolbar stays compact until searching is
 * what the user is doing.
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
    <SearchButton
      aria-label="Search JSON keys and values"
      placeholder={placeholder}
      // The field unmounts whenever the table is left or the surrounding card
      // is collapsed, while the filter it set stays applied. Seeding from the
      // query means a remounted box shows the rows that are actually missing
      // rather than reading as empty — and, holding text, it remounts already
      // expanded rather than as a button hiding the applied filter.
      defaultValue={query}
      onChange={setQuery}
    />
  );
}
