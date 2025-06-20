import { ComboBox, ComboBoxItem, Flex } from "@phoenix/components";

export type ModelTokenKind = "prompt" | "completion";

type TokenTypeOption = {
  name: string;
  kind: ModelTokenKind;
};

type PromptTokenTypeOption = TokenTypeOption & {
  kind: "prompt";
};

type CompletionTokenTypeOption = TokenTypeOption & {
  kind: "completion";
};

export const DEFAULT_TOKEN_PROMPT_OPTIONS = [
  {
    name: "input",
    kind: "prompt",
  },
  {
    name: "promptAudio",
    kind: "prompt",
  },
  {
    name: "cacheRead",
    kind: "prompt",
  },
  {
    name: "cacheWrite",
    kind: "prompt",
  },
] satisfies PromptTokenTypeOption[];

export const DEFAULT_TOKEN_COMPLETION_OPTIONS = [
  {
    name: "output",
    kind: "completion",
  },
  {
    name: "completionAudio",
    kind: "completion",
  },
  {
    name: "reasoning",
    kind: "completion",
  },
] satisfies CompletionTokenTypeOption[];

export function ModelTokenTypeComboBox<
  Options extends TokenTypeOption[] = TokenTypeOption[],
>({
  options,
  value,
  onChange,
  onBlur,
  invalid,
  isRequired,
  error,
}: {
  options: Options;
  value: string;
  onChange: (option: string | null) => void;
  onBlur: () => void;
  error?: string;
  invalid: boolean;
  isRequired?: boolean;
}) {
  const selectedOption = options.find((option) => option.name === value);
  return (
    <ComboBox
      aria-label="Token type"
      placeholder="Choose or enter a token type"
      selectedKey={selectedOption?.name ?? ""}
      inputValue={value}
      onSelectionChange={(name) => {
        const option = options.find((option) => option.name === name);
        if (option) {
          onChange(option.name);
        }
      }}
      onInputChange={(_value) => {
        const value = _value.toLowerCase();
        if (value) {
          onChange(value);
        } else {
          onChange(null);
        }
      }}
      onBlur={onBlur}
      isInvalid={invalid}
      isRequired={isRequired}
      errorMessage={error}
      size="M"
      allowsCustomValue
    >
      {options.map((item) => (
        <ComboBoxItem key={item.name} textValue={item.name} id={item.name}>
          <Flex alignItems="center" gap="size-50">
            {item.name}
          </Flex>
        </ComboBoxItem>
      ))}
    </ComboBox>
  );
}
