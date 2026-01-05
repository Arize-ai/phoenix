import { Input, Label } from "react-aria-components";

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
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

export function PlaygroundExperimentSettingsButton({
  isDisabled,
}: {
  isDisabled?: boolean;
}) {
  const appendedMessagesPath = usePlaygroundContext(
    (state) => state.appendedMessagesPath
  );
  const setAppendedMessagesPath = usePlaygroundContext(
    (state) => state.setAppendedMessagesPath
  );

  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Experiment Settings"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        isDisabled={isDisabled}
      />
      <Popover style={{ width: "350px" }}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <Heading level={2} weight="heavy">
              Settings
            </Heading>
            <View paddingTop="size-200" paddingBottom="size-100">
              <Flex direction="column" gap="size-200">
                <TextField
                  value={appendedMessagesPath ?? ""}
                  onChange={(value) => {
                    setAppendedMessagesPath(value || null);
                  }}
                >
                  <Label>Appended dataset messages path</Label>
                  <Input placeholder="Disabled" />
                  <Text slot="description">
                    Path to messages from the dataset to append to prompts
                  </Text>
                </TextField>
                <Text color="text-700" size="XS">
                  When set, messages at this path (e.g.,{" "}
                  <code
                    style={{
                      fontSize: "0.9em",
                      backgroundColor: "var(--ac-global-color-grey-200)",
                      padding: "1px 4px",
                      borderRadius: "3px",
                    }}
                  >
                    messages
                  </code>{" "}
                  or{" "}
                  <code
                    style={{
                      fontSize: "0.9em",
                      backgroundColor: "var(--ac-global-color-grey-200)",
                      padding: "1px 4px",
                      borderRadius: "3px",
                    }}
                  >
                    input.messages
                  </code>
                  ) in each dataset example will be appended to the prompt,
                  allowing you to test how a system prompt performs after
                  replaying conversation history.
                </Text>
              </Flex>
            </View>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
