import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";

import { useJSONView } from "./JSONViewContext";
import { isJSONViewMode } from "./types";

/**
 * A compact segmented control that switches between the table and JSON
 * renderings. Renders nothing when the value cannot be viewed either way.
 */
export function JSONViewModeSelect() {
  const { mode, setMode, isViewable } = useJSONView();
  if (!isViewable) {
    return null;
  }
  return (
    <SegmentedControl
      aria-label="JSON view mode"
      size="S"
      selectedKey={mode}
      // the control renders the two mode ids below and nothing else, so the
      // guard is only here to narrow the Key the selection hands back
      onSelectionChange={(key) => isJSONViewMode(key) && setMode(key)}
    >
      <SegmentedControlItem id="table">Table</SegmentedControlItem>
      <SegmentedControlItem id="json">JSON</SegmentedControlItem>
    </SegmentedControl>
  );
}
