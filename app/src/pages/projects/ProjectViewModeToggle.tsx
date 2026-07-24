import { css } from "@emotion/react";

import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
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
    <ToggleButtonGroup
      css={css`
        flex-basis: fit-content;
      `}
      selectedKeys={[projectViewMode]}
      selectionMode="single"
      onSelectionChange={(value) => {
        const selectedKey = value.values().next().value;
        if (selectedKey === "table" || selectedKey === "grid") {
          setProjectViewMode(selectedKey);
        }
      }}
      size="M"
    >
      <TooltipTrigger delay={100}>
        <ToggleButton
          id="grid"
          aria-label="Grid view"
          leadingVisual={<Icon svg={<Icons.GridFilled />} />}
        />
        <Tooltip>View projects in a grid</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={100}>
        <ToggleButton
          id="table"
          aria-label="Table view"
          leadingVisual={<Icon svg={<Icons.List />} />}
        />
        <Tooltip>View projects in a table</Tooltip>
      </TooltipTrigger>
    </ToggleButtonGroup>
  );
};
