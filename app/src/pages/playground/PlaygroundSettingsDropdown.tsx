import { useState } from "react";
import { css } from "@emotion/react";

import {
  DropdownButton,
  DropdownMenu,
  DropdownTrigger,
} from "@arizeai/components";

import {
  Flex,
  Form,
  Heading,
  Slider,
  SliderNumberField,
  Text,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import type { StreamToggle_data$key } from "../project/__generated__/StreamToggle_data.graphql";
import { StreamToggle } from "../project/StreamToggle";

export function PlaygroundSettingsDropdown(
  { project }: { project: StreamToggle_data$key }
) {
  const isRunning = usePlaygroundContext((state) =>
    state.instances.some((instance) => instance.activeRunId != null)
  );
  const [isOpen, setIsOpen] = useState(false);

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
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                setIsOpen(false);
              }}
            >
              <Heading level={2} weight="heavy">
                Repetitions
              </Heading>
              <View paddingY="size-50">
                <Text color="text-700" size="XS">
                  Increase the number of repetitions to run each experiment task
                  multiple times.
                </Text>
              </View>
              <Flex direction="column" gap="size-100">
                <Slider
                  defaultValue={1}
                  label="Repetitions"
                  minValue={1}
                  maxValue={30}
                >
                  <SliderNumberField />
                </Slider>
              </Flex>
            </Form>
            <Heading level={2} weight="heavy">
              Streaming
            </Heading>
            <View paddingY="size-50">
              <Text color="text-700" size="XS">
                Enable streaming to see tokens as they are generated in real time.
              </Text>
            </View>
            {/* <StreamToggle project={project} /> */}
          </View>
        </DropdownMenu>
      </DropdownTrigger>
    </div>
  );
}
