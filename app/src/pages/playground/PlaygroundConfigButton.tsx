import {
  Button,
  ComboBox,
  ComboBoxItem,
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
import { awsBedrockModelPrefixes } from "@phoenix/store/preferencesStore";

import {
  NUM_MAX_PLAYGROUND_REPETITIONS,
  NUM_MIN_PLAYGROUND_REPETITIONS,
} from "./constants";

export function PlaygroundConfigButton() {
  const streaming = usePlaygroundContext((state) => state.streaming);
  const repetitions = usePlaygroundContext((state) => state.repetitions);
  const setStreaming = usePlaygroundContext((state) => state.setStreaming);
  const setRepetitions = usePlaygroundContext((state) => state.setRepetitions);
  const setPlaygroundStreamingEnabled = usePreferencesContext(
    (state) => state.setPlaygroundStreamingEnabled
  );
  const awsBedrockModelPrefix = usePreferencesContext(
    (state) => state.awsBedrockModelPrefix
  );
  const setAwsBedrockModelPrefix = usePreferencesContext(
    (state) => state.setAwsBedrockModelPrefix
  );
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Playground Settings"
        leadingVisual={<Icon svg={<Icons.Options />} />}
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
                  defaultValue={NUM_MIN_PLAYGROUND_REPETITIONS}
                  label="Repetitions"
                  minValue={NUM_MIN_PLAYGROUND_REPETITIONS}
                  maxValue={NUM_MAX_PLAYGROUND_REPETITIONS}
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
                <ComboBox
                  aria-label="AWS Bedrock Model Prefix"
                  label="AWS Bedrock Model Prefix"
                  description="Cross-region inference prefix for AWS Bedrock models"
                  selectedKey={awsBedrockModelPrefix}
                  onSelectionChange={(value) => {
                    const prefix = awsBedrockModelPrefixes.find(
                      (p) => p === value
                    );
                    if (prefix != null) {
                      setAwsBedrockModelPrefix(prefix);
                    }
                  }}
                >
                  {awsBedrockModelPrefixes.map((prefix) => (
                    <ComboBoxItem
                      key={prefix === "" ? "__none__" : prefix}
                      id={prefix}
                      textValue={prefix === "" ? "None (no prefix)" : prefix}
                    >
                      <Text>{prefix === "" ? "None (no prefix)" : prefix}</Text>
                    </ComboBoxItem>
                  ))}
                </ComboBox>
              </Flex>
            </View>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
