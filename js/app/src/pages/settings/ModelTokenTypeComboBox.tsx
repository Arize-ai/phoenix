import { ComboBox, ComboBoxItem, Flex } from "@phoenix/components";
import type { GenerativeModelType } from "@phoenix/constants/generativeConstants";

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

/**
 * The token types each model type's spans report, suggested in the token type
 * combobox. Custom token types can still be typed. Decision spans report input
 * and output counts (and cache counts on legacy `llm.*` attributes); embedding
 * spans report input tokens only, so embedding models have no completion side.
 */
export const TOKEN_TYPE_OPTIONS_BY_MODEL_TYPE: Readonly<
  Record<
    GenerativeModelType,
    {
      prompt: PromptTokenTypeOption[];
      completion: CompletionTokenTypeOption[];
    }
  >
> = {
  LLM: {
    prompt: DEFAULT_TOKEN_PROMPT_OPTIONS,
    completion: DEFAULT_TOKEN_COMPLETION_OPTIONS,
  },
  DECISION: {
    prompt: DEFAULT_TOKEN_PROMPT_OPTIONS.filter(
      (option) => option.tokenType !== "audio"
    ),
    completion: DEFAULT_TOKEN_COMPLETION_OPTIONS.filter(
      (option) => option.tokenType === "output"
    ),
  },
  EMBEDDING: {
    prompt: DEFAULT_TOKEN_PROMPT_OPTIONS.filter(
      (option) => option.tokenType === "input"
    ),
    completion: [],
  },
};

const KNOWN_TOKEN_TYPES = new Set<string>(
  [...DEFAULT_TOKEN_PROMPT_OPTIONS, ...DEFAULT_TOKEN_COMPLETION_OPTIONS].map(
    (option) => option.tokenType
  )
);

/**
 * Trims a token type and snaps known token types to their lowercase form, as
 * the server does, so that `Input` prices the `input` tokens spans report.
 */
export function normalizeTokenType(tokenType: string): string {
  const trimmed = tokenType.trim();
  const lowered = trimmed.toLowerCase();
  return KNOWN_TOKEN_TYPES.has(lowered) ? lowered : trimmed;
}

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
  const normalizedValue = normalizeTokenType(value ?? "");
  const selectedOption = options.find(
    (option) => option.tokenType === normalizedValue
  );
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
      onInputChange={(value) => {
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
