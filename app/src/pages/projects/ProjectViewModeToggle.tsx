import { Tooltip, TooltipTrigger } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Icon,
  Icons,
  Text,
  ToggleButton,
  ToggleButtonGroup,
  View,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts";
import { ProjectViewMode } from "@phoenix/store/preferencesStore";

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
        if (typeof selectedKey === "string") {
          setProjectViewMode(selectedKey as ProjectViewMode);
        }
      }}
      size="S"
    >
      <TooltipTrigger delay={100}>
        <ToggleButton id="grid" leadingVisual={<Icon svg={<Icons.Grid />} />} />
        <Tooltip offset={10}>
          <View
            padding="size-100"
            backgroundColor="light"
            borderColor="dark"
            borderWidth="thin"
            borderRadius="small"
          >
            <Text>View projects in a grid</Text>
          </View>
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={100}>
        <ToggleButton
          id="table"
          leadingVisual={<Icon svg={<Icons.ListOutline />} />}
        />
        <Tooltip offset={10}>
          <View
            padding="size-100"
            backgroundColor="light"
            borderColor="dark"
            borderWidth="thin"
            borderRadius="small"
          >
            <Text>View projects in a table</Text>
          </View>
        </Tooltip>
      </TooltipTrigger>
    </ToggleButtonGroup>
  );
};
