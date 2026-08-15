import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";

import { useJSONView } from "./JSONViewContext";

/**
 * Switches the JSON document between the stringified JSON as it was recorded
 * and the same document with those strings un-nested, so a value like
 * `"invocation_parameters": "{\"temperature\":0.7}"` reads as a real object
 * rather than an escaped string.
 *
 * Both choices are spelled out rather than left to a pressed-or-not icon: which
 * of the two documents is on screen is not something a reader can infer from
 * one glance at the JSON, so the control has to say it.
 *
 * Offered only in JSON mode, and only when there is something to un-nest. The
 * table keys its rows by the attribute keys as they were recorded, so there is
 * nothing there for the control to act on.
 */
export function JSONViewExpandSelect() {
  const { mode, canExpand, isExpanded, setIsExpanded } = useJSONView();
  if (mode !== "json" || !canExpand) {
    return null;
  }
  return (
    <SegmentedControl
      aria-label="Stringified JSON"
      size="S"
      selectedKey={isExpanded ? "unnested" : "raw"}
      onSelectionChange={(key) => setIsExpanded(key === "unnested")}
    >
      <SegmentedControlItem id="raw">Raw</SegmentedControlItem>
      <SegmentedControlItem id="unnested">Un-nested</SegmentedControlItem>
    </SegmentedControl>
  );
}
