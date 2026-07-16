import { ToggleButton, ToggleButtonGroup } from "@phoenix/components/core";

import type { EvaluationMetricsView } from "./evaluationMetricsUtils";

function isEvaluationMetricsView(
  value: unknown
): value is EvaluationMetricsView {
  return value === "labels" || value === "scores";
}

export function EvaluationMetricsViewToggle({
  view,
  onChange,
}: {
  view: EvaluationMetricsView;
  onChange: (view: EvaluationMetricsView) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Evaluation metric view"
      size="S"
      selectedKeys={[view]}
      onSelectionChange={(selection) => {
        const selectedView = selection.keys().next().value;
        if (isEvaluationMetricsView(selectedView)) {
          onChange(selectedView);
        }
      }}
    >
      <ToggleButton id="labels">Labels</ToggleButton>
      <ToggleButton id="scores">Scores</ToggleButton>
    </ToggleButtonGroup>
  );
}
