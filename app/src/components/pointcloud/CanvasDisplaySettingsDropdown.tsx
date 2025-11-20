import { DialogTrigger } from "react-aria-components";

import { Button } from "@phoenix/components/button";
import { Dialog } from "@phoenix/components/dialog";
import { Icon, Icons } from "@phoenix/components/icon";
import { Flex } from "@phoenix/components/layout";
import { Popover } from "@phoenix/components/overlay";
import { Slider } from "@phoenix/components/slider";
import { View } from "@phoenix/components/view";
import { usePointCloudContext } from "@phoenix/contexts";

export function CanvasDisplaySettingsDropdown() {
  const setPointSizeScale = usePointCloudContext(
    (state) => state.setPointSizeScale
  );
  const pointSizeScale = usePointCloudContext((state) => state.pointSizeScale);
  return (
    <DialogTrigger>
      <Button
        variant="default"
        size="S"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        aria-label="Display Settings"
      />
      <Popover>
        <Dialog>
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
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
