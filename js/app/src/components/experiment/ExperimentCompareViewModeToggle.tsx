import {
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Text,
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
    <SegmentedControl
      aria-label="Experiment comparison view"
      selectedKey={viewMode}
      onSelectionChange={(selectedKey) => {
        if (isExperimentCompareViewMode(selectedKey)) {
          onViewModeChange(selectedKey);
        } else {
          onViewModeChange("grid");
        }
      }}
      size="S"
    >
      <SegmentedControlItem id="grid">
        <Icon svg={<Icons.GridFilled />} />
        <Text>Grid</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="list">
        <Icon svg={<Icons.List />} />
        <Text>List</Text>
      </SegmentedControlItem>
      <SegmentedControlItem id="metrics">
        <Icon svg={<Icons.BarChart />} />
        <Text>Metrics</Text>
      </SegmentedControlItem>
    </SegmentedControl>
  );
}
