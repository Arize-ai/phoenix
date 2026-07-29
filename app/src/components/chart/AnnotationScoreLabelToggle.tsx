import {
  SegmentedControl,
  SegmentedControlItem,
} from "@phoenix/components/core";

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
    <SegmentedControl
      aria-label="Evaluation metric view"
      size="S"
      selectedKey={view}
      onSelectionChange={(selectedView) => {
        if (isAnnotationMetricsView(selectedView)) {
          onChange(selectedView);
        }
      }}
    >
      <SegmentedControlItem id="scores">Scores</SegmentedControlItem>
      <SegmentedControlItem id="labels">Labels</SegmentedControlItem>
    </SegmentedControl>
  );
}
