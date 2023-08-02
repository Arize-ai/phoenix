import React from "react";

import {
  Button,
  DropdownMenu,
  DropdownTrigger,
  Flex,
  Icon,
  Icons,
  Slider,
  Switch,
  View,
} from "@arizeai/components";

import { usePointCloudContext } from "@phoenix/contexts";

export function CanvasDisplaySettingsDropdown() {
  const canvasTheme = usePointCloudContext((state) => state.canvasTheme);
  const setCanvasTheme = usePointCloudContext((state) => state.setCanvasTheme);
  const setPointSizeScale = usePointCloudContext(
    (state) => state.setPointSizeScale
  );
  const pointSizeScale = usePointCloudContext((state) => state.pointSizeScale);
  return (
    <DropdownTrigger placement="bottom left">
      <Button
        variant={"default"}
        size="compact"
        icon={<Icon svg={<Icons.OptionsOutline />} />}
        aria-label="Display Settings"
      />
      <DropdownMenu>
        <View padding="size-100">
          <Flex direction={"column"} gap="size-100">
            <Slider
              label="Point Scale"
              minValue={0}
              maxValue={3}
              step={0.1}
              value={pointSizeScale}
              onChange={setPointSizeScale}
            />
            <Switch
              isSelected={canvasTheme === "light"}
              labelPlacement="end"
              onChange={() =>
                setCanvasTheme(canvasTheme === "light" ? "dark" : "light")
              }
            >
              Light Theme
            </Switch>
          </Flex>
        </View>
      </DropdownMenu>
    </DropdownTrigger>
  );
}
