import { useMemo } from "react";
import { useSearchParams } from "react-router";

import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Heading,
  Icon,
  Icons,
  Popover,
  PopoverArrow,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundConfigButton() {
  const [searchParams] = useSearchParams();
  const hasSelectedDataset = useMemo(() => {
    const datasetId = searchParams.get("datasetId");
    const hasSelectedDataset = datasetId != null;
    return hasSelectedDataset;
  }, [searchParams]);
  const repetitions = usePlaygroundContext((state) => state.repetitions);
  const setRepetitions = usePlaygroundContext((state) => state.setRepetitions);
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Playground Settings"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        isDisabled={isRunning || !hasSelectedDataset}
      />
      <Popover>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <Heading level={2} weight="heavy">
              Settings
            </Heading>
            <View
              paddingTop="size-100"
              paddingBottom="size-50"
              overflow="visible" // prevents the halo around the slider thumb from being clipped
            >
              <Flex direction="column" gap="size-200">
                <Slider
                  defaultValue={1}
                  label="Repetitions"
                  minValue={1}
                  maxValue={30}
                  value={repetitions}
                  onChange={setRepetitions}
                >
                  <SliderNumberField />
                </Slider>
                <Text color="text-700" size="XS">
                  Increase the number of repetitions to run each experiment task
                  multiple times.
                </Text>
              </Flex>
            </View>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
