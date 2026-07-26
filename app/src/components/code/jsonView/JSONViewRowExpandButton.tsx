import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

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
  const label = areRowsExpanded ? "Collapse rows" : "Expand rows";
  return (
    <TooltipTrigger>
      <Button
        size="S"
        variant="default"
        aria-label={label}
        aria-pressed={areRowsExpanded}
        leadingVisual={
          <Icon
            svg={areRowsExpanded ? <Icons.RowCollapse /> : <Icons.RowExpand />}
          />
        }
        onPress={() => setAreRowsExpanded(!areRowsExpanded)}
      />
      <Tooltip offset={1}>
        {areRowsExpanded
          ? "Clip each row to a single line"
          : "Wrap each row over as many lines as it needs"}
      </Tooltip>
    </TooltipTrigger>
  );
}
