import { useEffect } from "react";

import {
  Button,
  ComboBox,
  ComboBoxItem,
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
import { DEFAULT_TEMPLATE_VARIABLES_PATH } from "@phoenix/store";

const TEMPLATE_VARIABLES_PATH_OPTIONS = [
  {
    id: "",
    label: "Example root",
    description: "Variables like {{input}}, {{reference}}, {{metadata}}",
  },
  {
    id: "input",
    label: "input",
    description: "Variables resolve from input (e.g., {{query}} → input.query)",
  },
  {
    id: "reference",
    label: "reference",
    description: "Variables resolve from reference/output",
  },
  {
    id: "metadata",
    label: "metadata",
    description: "Variables resolve from metadata",
  },
];

export function PlaygroundExperimentSettingsButton({
  isDisabled,
  datasetId,
}: {
  isDisabled?: boolean;
  datasetId: string;
}) {
  const playgroundDatasetState = usePlaygroundContext(
    (state) => state.stateByDatasetId[datasetId]
  );
  const { appendedMessagesPath, templateVariablesPath } =
    playgroundDatasetState ?? {};
  const setAppendedMessagesPath = usePlaygroundContext(
    (state) => state.setAppendedMessagesPath
  );

  const setTemplateVariablesPath = usePlaygroundContext(
    (state) => state.setTemplateVariablesPath
  );

  // ensure default state is set when switching datasets
  useEffect(() => {
    if (!datasetId) {
      return;
    }

    if (playgroundDatasetState) {
      return;
    }
    setTemplateVariablesPath({
      templateVariablesPath: DEFAULT_TEMPLATE_VARIABLES_PATH,
      datasetId,
    });
  }, [datasetId, playgroundDatasetState, setTemplateVariablesPath]);

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
              <ComboBox
                label="Template variables path"
                description="Path prefix for template variables"
                size="M"
                placeholder="the root of the example"
                selectedKey={templateVariablesPath ?? ""}
                inputValue={templateVariablesPath ?? ""}
                defaultItems={TEMPLATE_VARIABLES_PATH_OPTIONS}
                allowsCustomValue
                onSelectionChange={(key) => {
                  if (typeof key === "string") {
                    setTemplateVariablesPath({
                      templateVariablesPath: key || null,
                      datasetId,
                    });
                  }
                }}
                onInputChange={(value) => {
                  setTemplateVariablesPath({
                    templateVariablesPath: value || null,
                    datasetId,
                  });
                }}
              >
                {(item) => (
                  <ComboBoxItem key={item.id} id={item.id} textValue={item.id}>
                    <Flex direction="column">
                      <Text weight="heavy">{item.label || "Example root"}</Text>
                      <Text size="XS" color="text-700">
                        {item.description}
                      </Text>
                    </Flex>
                  </ComboBoxItem>
                )}
              </ComboBox>
              <TextField
                value={appendedMessagesPath ?? ""}
                size="S"
                onChange={(value) => {
                  setAppendedMessagesPath({ path: value || null, datasetId });
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
