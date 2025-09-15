import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";

export type ExperimentCompareViewMode = "grid" | "list" | "metrics";

/**
 * TypeGuard for the experiment compare view mode
 */
export function isExperimentCompareViewMode(
  maybeViewMode: unknown
): maybeViewMode is ExperimentCompareViewMode {
  const experimentCompareViewModes: ExperimentCompareViewMode[] = [
    "grid",
    "list",
    "metrics",
  ];
  return (
    typeof maybeViewMode === "string" &&
    experimentCompareViewModes.includes(
      maybeViewMode as ExperimentCompareViewMode
    )
  );
}

export function ExperimentCompareViewModeToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ExperimentCompareViewMode;
  onViewModeChange: (newViewMode: ExperimentCompareViewMode) => void;
}) {
  return (
    <ToggleButtonGroup
      selectedKeys={[viewMode]}
      selectionMode="single"
      onSelectionChange={(selection) => {
        if (selection.size === 0) {
          return;
        }
        const selectedKey = selection.keys().next().value;
        if (isExperimentCompareViewMode(selectedKey)) {
          onViewModeChange(selectedKey);
        } else {
          onViewModeChange("grid");
        }
      }}
      size="S"
    >
      <ToggleButton id="grid" leadingVisual={<Icon svg={<Icons.Grid />} />}>
        Grid
      </ToggleButton>
      <ToggleButton
        id="list"
        leadingVisual={<Icon svg={<Icons.ListOutline />} />}
      >
        List
      </ToggleButton>
      <ToggleButton
        id="metrics"
        leadingVisual={<Icon svg={<Icons.BarChartOutline />} />}
      >
        Metrics
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
