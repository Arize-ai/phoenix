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
            <Flex direction="column" gap="size-200">
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
