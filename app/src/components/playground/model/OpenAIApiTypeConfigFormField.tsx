import {
  Button,
  Flex,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
  Text,
} from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import type { OpenAIApiType } from "@phoenix/store";

const API_TYPE_OPTIONS: { id: OpenAIApiType; label: string }[] = [
  { id: "CHAT_COMPLETIONS", label: "Chat Completions" },
  { id: "RESPONSES", label: "Responses API" },
];

const DEFAULT_API_TYPE: OpenAIApiType = "CHAT_COMPLETIONS";

function getApiTypeLabel(apiType: OpenAIApiType): string {
  return API_TYPE_OPTIONS.find((opt) => opt.id === apiType)?.label ?? apiType;
}

export type OpenAIApiTypeConfigFormFieldProps = {
  playgroundInstanceId: number;
  /**
   * When true, shows only the fixed default "Responses API" as static text (not editable).
   * Does not read from instance/model or localStorage — used when ephemeral routing is disabled.
   */
  displayDefaultOnly?: boolean;
};

/**
 * Form field for selecting OpenAI/Azure API type (Chat Completions vs Responses API).
 * Shown for built-in OpenAI and Azure OpenAI providers only.
 */
export function OpenAIApiTypeConfigFormField({
  playgroundInstanceId,
  displayDefaultOnly = false,
}: OpenAIApiTypeConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  if (!instance) {
    return null;
  }

  // When ephemeral routing is disabled: always show RESPONSES, never use stored value
  if (displayDefaultOnly) {
    return (
      <Flex direction="column" gap="size-50">
        <Label>API Type</Label>
        <Text size="S">{getApiTypeLabel(DEFAULT_API_TYPE)}</Text>
      </Flex>
    );
  }

  const value = instance.model.openaiApiType ?? DEFAULT_API_TYPE;

  return (
    <Select
      key="openai-api-type"
      value={value}
      onChange={(key) => {
        if (key != null) {
          updateModel({
            instanceId: playgroundInstanceId,
            patch: { openaiApiType: key as OpenAIApiType },
          });
        }
      }}
    >
      <Label>API Type</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          {API_TYPE_OPTIONS.map((opt) => (
            <SelectItem key={opt.id} id={opt.id} textValue={opt.label}>
              {opt.label}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
