import { useSearchParams } from "react-router";

import { SegmentedControl, SegmentedControlItem } from "@phoenix/components";

export function PlaygroundModeSelect() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode =
    searchParams.get("mode") === "evaluators" ? "evaluators" : "prompts";
  return (
    <SegmentedControl
      aria-label="Playground mode"
      size="S"
      selectedKey={mode}
      onSelectionChange={(key) => {
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          if (key === "evaluators") next.set("mode", "evaluators");
          else next.delete("mode");
          return next;
        });
      }}
    >
      <SegmentedControlItem id="prompts">Prompts</SegmentedControlItem>
      <SegmentedControlItem id="evaluators">Evaluators</SegmentedControlItem>
    </SegmentedControl>
  );
}
