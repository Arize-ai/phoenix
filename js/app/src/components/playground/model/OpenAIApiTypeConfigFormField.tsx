import {
  Button,
  Label,
  ListBox,
  Popover,
  Select,
  SelectChevronUpDownIcon,
  SelectItem,
  SelectValue,
} from "@phoenix/components";
import { DEFAULT_OPENAI_API_TYPE } from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

const API_TYPE_OPTIONS: { id: OpenAIApiType; label: string }[] = [
  { id: "CHAT_COMPLETIONS", label: "Chat Completions" },
  { id: "RESPONSES", label: "Responses" },
];

export type OpenAIApiTypeConfigFormFieldProps = {
  playgroundInstanceId: number;
};

/**
 * Form field for selecting OpenAI/Azure API type (Chat Completions vs Responses).
 * Shown for built-in OpenAI and Azure OpenAI providers only.
 *
 * Only rendered where the selection is sent to the server. Surfaces that do not
 * send one (evaluators) leave the choice to the server's per-model default, which
 * this field cannot predict.
 */
export function OpenAIApiTypeConfigFormField({
  playgroundInstanceId,
}: OpenAIApiTypeConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  if (!instance) {
    return null;
  }

  const value = instance.model.openaiApiType ?? DEFAULT_OPENAI_API_TYPE;

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
      <Button data-testid="invocation-param-apiType">
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
