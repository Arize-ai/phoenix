import { useState } from "react";
import { useSearchParams } from "react-router";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
  Switch,
} from "@arizeai/components";

import {
  Flex,
  Heading,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

export function PlaygroundSettingsDropdown() {
  const [searchParams] = useSearchParams();
  const selectedDatasetid = searchParams.get("datasetId");
  const hasSelectedDataset = selectedDatasetid != null;
  const [isOpen, setIsOpen] = useState(false);
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
    <div
      css={css`
        .ac-dropdown-button {
          min-width: 0px;
        }
      `}
    >
      <DropdownTrigger
        placement="bottom"
        isOpen={isOpen}
        onOpenChange={(isOpen) => {
          setIsOpen(isOpen);
        }}
      >
        <DropdownButton size="compact" isDisabled={isRunning}>
          Settings
        </DropdownButton>
        <DropdownMenu>
          <View padding="size-200">
            <Heading level={2} weight="heavy">
              Settings
            </Heading>
            <View paddingTop="size-100" paddingBottom="size-50">
              <Flex direction="column" gap="size-200">
                {hasSelectedDataset && (
                  <>
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
                      Increase the number of repetitions to run each experiment
                      task multiple times.
                    </Text>
                  </>
                )}
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
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
