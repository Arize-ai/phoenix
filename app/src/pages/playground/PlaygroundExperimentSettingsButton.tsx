import { useSearchParams } from "react-router";

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
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

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
}: {
  isDisabled?: boolean;
}) {
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get("datasetId");

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

  const setPlaygroundAppendedMessagesPathForDataset = usePreferencesContext(
    (state) => state.setPlaygroundAppendedMessagesPathForDataset
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
                    setTemplateVariablesPath(key || null);
                  }
                }}
                onInputChange={(value) => {
                  setTemplateVariablesPath(value || null);
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
                  const path = value || null;
                  setAppendedMessagesPath(path);
                  // Save to preferences if a dataset is selected
                  if (datasetId) {
                    setPlaygroundAppendedMessagesPathForDataset({
                      datasetId,
                      path,
                    });
                  }
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
