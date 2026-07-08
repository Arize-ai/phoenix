import { ComboBox, ComboBoxItem, Flex } from "@phoenix/components";

export type ModelTokenKind = "PROMPT" | "COMPLETION";

type TokenTypeOption = {
  tokenType: string;
  kind: ModelTokenKind;
};

type PromptTokenTypeOption = TokenTypeOption & {
  kind: "PROMPT";
};

type CompletionTokenTypeOption = TokenTypeOption & {
  kind: "COMPLETION";
};

export const DEFAULT_TOKEN_PROMPT_OPTIONS = [
  {
    tokenType: "input",
    kind: "PROMPT",
  },
  {
    tokenType: "audio",
    kind: "PROMPT",
  },
  {
    tokenType: "cache_read",
    kind: "PROMPT",
  },
  {
    tokenType: "cache_write",
    kind: "PROMPT",
  },
] satisfies PromptTokenTypeOption[];

export const DEFAULT_TOKEN_COMPLETION_OPTIONS = [
  {
    tokenType: "output",
    kind: "COMPLETION",
  },
  {
    tokenType: "audio",
    kind: "COMPLETION",
  },
  {
    tokenType: "reasoning",
    kind: "COMPLETION",
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
  const selectedOption = options.find((option) => option.tokenType === value);
  return (
    <ComboBox
      aria-label="Token type"
      placeholder="Choose or enter a token type"
      selectedKey={selectedOption?.tokenType ?? ""}
      inputValue={value ?? ""}
      onSelectionChange={(tokenType) => {
        const option = options.find((option) => option.tokenType === tokenType);
        if (option) {
          onChange(option.tokenType);
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
      {options.map((item) =>
        item.tokenType ? (
          <ComboBoxItem
            key={item.tokenType}
            textValue={item.tokenType}
            id={item.tokenType}
          >
            <Flex alignItems="center" gap="size-50">
              {item.tokenType}
            </Flex>
          </ComboBoxItem>
        ) : null
      )}
    </ComboBox>
  );
}
