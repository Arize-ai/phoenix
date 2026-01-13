import {
  Button,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
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
  const templateVariablesPath = usePlaygroundContext(
    (state) => state.templateVariablesPath
  );
  const setTemplateVariablesPath = usePlaygroundContext(
    (state) => state.setTemplateVariablesPath
  );

  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Experiment Settings"
        leadingVisual={<Icon svg={<Icons.OptionsOutline />} />}
        isDisabled={isDisabled}
      />
      <Popover style={{ width: "400px" }}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <TextField
                value={templateVariablesPath ?? ""}
                size="S"
                onChange={(value) => {
                  setTemplateVariablesPath(value || null);
                }}
              >
                <Label>Template variables path</Label>
                <Input placeholder="the root of the example" />
                <Text slot="description">
                  Path prefix for template variables
                </Text>
              </TextField>
              <TextField
                value={appendedMessagesPath ?? ""}
                size="S"
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
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
