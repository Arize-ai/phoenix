import {
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";

export const ProjectViewModeToggle = () => {
  const { projectViewMode, setProjectViewMode } = usePreferencesContext(
    (state) => ({
      projectViewMode: state.projectViewMode,
      setProjectViewMode: state.setProjectViewMode,
    })
  );

  return (
    <SegmentedControl
      aria-label="Project view"
      selectedKey={projectViewMode}
      onSelectionChange={(value) => {
        if (value === "grid" || value === "table") {
          setProjectViewMode(value);
        }
      }}
      size="M"
    >
      <TooltipTrigger delay={100}>
        <SegmentedControlItem id="grid" aria-label="Grid view">
          <Icon svg={<Icons.GridFilled />} />
        </SegmentedControlItem>
        <Tooltip>View projects in a grid</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={100}>
        <SegmentedControlItem id="table" aria-label="Table view">
          <Icon svg={<Icons.List />} />
        </SegmentedControlItem>
        <Tooltip>View projects in a table</Tooltip>
      </TooltipTrigger>
    </SegmentedControl>
  );
};
