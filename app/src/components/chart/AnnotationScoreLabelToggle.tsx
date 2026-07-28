import { ToggleButton, ToggleButtonGroup } from "@phoenix/components/core";

import type { AnnotationMetricsView } from "./annotationMetricsUtils";

function isAnnotationMetricsView(
  value: unknown
): value is AnnotationMetricsView {
  return value === "labels" || value === "scores";
}

export function AnnotationScoreLabelToggle({
  view,
  onChange,
}: {
  view: AnnotationMetricsView;
  onChange: (view: AnnotationMetricsView) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Evaluation metric view"
      size="S"
      selectedKeys={[view]}
      onSelectionChange={(selection) => {
        const selectedView = selection.keys().next().value;
        if (isAnnotationMetricsView(selectedView)) {
          onChange(selectedView);
        }
      }}
    >
      <ToggleButton id="labels">Labels</ToggleButton>
      <ToggleButton id="scores">Scores</ToggleButton>
    </ToggleButtonGroup>
  );
}
