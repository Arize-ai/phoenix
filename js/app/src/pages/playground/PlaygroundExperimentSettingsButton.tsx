import {
  Button,
  Checkbox,
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
import {
  getPlaygroundTaskKind,
  getTemplateVariablesPath,
} from "@phoenix/store/playground";

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
  const appendedMessagesPath = usePlaygroundContext(
    (state) => state.stateByDatasetId[datasetId]?.appendedMessagesPath
  );

  // Each kind of task keeps its own path; the gear edits the page's kind.
  const taskKind = usePlaygroundContext((state) =>
    getPlaygroundTaskKind(state.instances)
  );

  const templateVariablesPath = usePlaygroundContext((state) =>
    getTemplateVariablesPath({
      stateByDatasetId: state.stateByDatasetId,
      datasetId,
      taskKind: getPlaygroundTaskKind(state.instances),
    })
  );
  const setAppendedMessagesPath = usePlaygroundContext(
    (state) => state.setAppendedMessagesPath
  );
  const setTemplateVariablesPath = usePlaygroundContext(
    (state) => state.setTemplateVariablesPath
  );

  // A per-browser preference: the metadata cells leave the `annotations` key
  // out until this is turned off.
  const hideExpectedAnnotations = usePreferencesContext(
    (state) => state.hideExpectedAnnotationsInMetadata
  );

  const setHideExpectedAnnotations = usePreferencesContext(
    (state) => state.setHideExpectedAnnotationsInMetadata
  );

  return (
    <DialogTrigger>
      <Button
        size="S"
        aria-label="Experiment Settings"
        leadingVisual={<Icon svg={<Icons.Options />} />}
        isDisabled={isDisabled}
      />
      <Popover style={{ width: "400px" }}>
        <PopoverArrow />
        <Dialog>
          <View padding="size-200">
            <Flex direction="column" gap="size-200">
              <ComboBox
                label="Template variables path"
                description="Path prefix for template variables, kept per kind of task"
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
                      taskKind,
                    });
                  }
                }}
                onInputChange={(value) => {
                  setTemplateVariablesPath({
                    templateVariablesPath: value || null,
                    datasetId,
                    taskKind,
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
              <Flex direction="column" gap="size-50">
                <Checkbox
                  isSelected={hideExpectedAnnotations}
                  onChange={setHideExpectedAnnotations}
                >
                  Hide expected annotations in metadata cells
                </Checkbox>
                <Text size="XS" color="text-700">
                  Expected outputs are stored under the example&apos;s
                  &quot;annotations&quot; key and already show in each
                  evaluator&apos;s expected band.
                </Text>
              </Flex>
            </Flex>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
