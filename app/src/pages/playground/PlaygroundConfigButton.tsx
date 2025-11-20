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
  Switch,
  Text,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

export function PlaygroundConfigButton() {
  const streaming = usePlaygroundContext((state) => state.streaming);
  const repetitions = usePlaygroundContext((state) => state.repetitions);
  const setStreaming = usePlaygroundContext((state) => state.setStreaming);
  const setRepetitions = usePlaygroundContext((state) => state.setRepetitions);
  const setPlaygroundStreamingEnabled = usePreferencesContext(
    (state) => state.setPlaygroundStreamingEnabled
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Playground Settings"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        isDisabled={isRunning}
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
                <Flex direction="row" justifyContent="start">
                  <Switch
                    labelPlacement="start"
                    isSelected={streaming}
                    onChange={() => {
                      setStreaming(!streaming);
                      setPlaygroundStreamingEnabled(!streaming);
                    }}
                    isDisabled={isRunning}
                  >
                    <Text size="M">Streaming</Text>
                  </Switch>
                </Flex>
                <Text color="text-700" size="XS">
                  Enable streaming to view experiment task output as it is
                  generated in real time.
                </Text>
              </Flex>
            </View>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
