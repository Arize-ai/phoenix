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
  Token,
} from "@phoenix/components";
import type { CanonicalToolChoice } from "@phoenix/store/playground/types";
import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * Per-provider configuration for rendering tool choice options.
 *
 * The only property that varies by provider is the API token for ONE_OR_MORE:
 * OpenAI-style providers call it "required"; Anthropic/Google/AWS call it "any".
 * Everything else — "auto" for ZERO_OR_MORE, "none" for NONE — is identical
 * across all providers.
 */
type ProviderToolChoiceConfig = {
  /** The wire token sent to the provider's API for "use at least one tool". */
  oneOrMoreToken: "required" | "any";
};

/**
 * Configuration for every provider that supports tool choice.
 * A provider's presence here is the canonical signal that it supports tools.
 */
export const TOOL_CHOICE_CONFIG_BY_PROVIDER = {
  OPENAI: { oneOrMoreToken: "required" },
  AZURE_OPENAI: { oneOrMoreToken: "required" },
  DEEPSEEK: { oneOrMoreToken: "required" },
  XAI: { oneOrMoreToken: "required" },
  OLLAMA: { oneOrMoreToken: "required" },
  CEREBRAS: { oneOrMoreToken: "required" },
  FIREWORKS: { oneOrMoreToken: "required" },
  GROQ: { oneOrMoreToken: "required" },
  MOONSHOT: { oneOrMoreToken: "required" },
  PERPLEXITY: { oneOrMoreToken: "required" },
  TOGETHER: { oneOrMoreToken: "required" },
  ANTHROPIC: { oneOrMoreToken: "any" },
  AWS: { oneOrMoreToken: "any" },
  GOOGLE: { oneOrMoreToken: "any" },
} satisfies Partial<Record<ModelProvider, ProviderToolChoiceConfig>>;

export type SupportedToolChoiceProvider =
  keyof typeof TOOL_CHOICE_CONFIG_BY_PROVIDER;

/**
 * Checks whether a provider supports tool choice.
 * After this guard passes, TypeScript narrows the type to SupportedToolChoiceProvider.
 */
export const isSupportedToolChoiceProvider = (
  provider: ModelProvider
): provider is SupportedToolChoiceProvider =>
  provider in TOOL_CHOICE_CONFIG_BY_PROVIDER;

/**
 * Prefix applied to specific-function item IDs to avoid collisions with
 * the canonical type names used for the built-in choices.
 */
const SPECIFIC_FUNCTION_PREFIX = "tool_";

/**
 * Maps a canonical tool choice to the stable Select item ID.
 *
 * Built-in choices use their canonical type name directly ("ZERO_OR_MORE",
 * "ONE_OR_MORE", "NONE") so the ID never encodes provider-specific vocabulary.
 * Specific-function choices use "tool_<name>".
 */
const canonicalToId = (
  choice: CanonicalToolChoice | null | undefined
): string => {
  if (!choice) return "ZERO_OR_MORE";
  switch (choice.type) {
    case "NONE":
      return "NONE";
    case "ZERO_OR_MORE":
      return "ZERO_OR_MORE";
    case "ONE_OR_MORE":
      return "ONE_OR_MORE";
    case "SPECIFIC_FUNCTION":
      return `${SPECIFIC_FUNCTION_PREFIX}${choice.functionName ?? ""}`;
    default:
      assertUnreachable(choice.type);
  }
};

/**
 * Maps a stable Select item ID back to a canonical tool choice.
 */
const idToCanonical = (id: string): CanonicalToolChoice => {
  if (id === "NONE") return { type: "NONE" };
  if (id === "ONE_OR_MORE") return { type: "ONE_OR_MORE" };
  if (id.startsWith(SPECIFIC_FUNCTION_PREFIX))
    return {
      type: "SPECIFIC_FUNCTION",
      functionName: id.slice(SPECIFIC_FUNCTION_PREFIX.length),
    };
  return { type: "ZERO_OR_MORE" };
};

/**
 * Renders a labelled option row with a provider-specific API token badge.
 */
const OptionLabel = ({
  label,
  apiToken,
}: {
  label: string;
  apiToken: string;
}) => (
  <Flex
    gap="size-100"
    alignItems="center"
    justifyContent="space-between"
    width="100%"
  >
    <span>{label}</span>
    <Token color="var(--global-color-gray-900)" size="S">
      {apiToken}
    </Token>
  </Flex>
);

type ToolChoiceSelectorProps = {
  provider: SupportedToolChoiceProvider;
  /** The current canonical tool choice. */
  choice: CanonicalToolChoice | null | undefined;
  /** Callback — always emits canonical form. */
  onChange: (choice: CanonicalToolChoice) => void;
  /** User-defined tool names available for SPECIFIC_FUNCTION selection. */
  toolNames: string[];
};

export function ToolChoiceSelector({
  choice,
  onChange,
  toolNames,
  provider,
}: ToolChoiceSelectorProps) {
  const config = TOOL_CHOICE_CONFIG_BY_PROVIDER[provider];
  const currentId = canonicalToId(choice);

  return (
    <Select
      value={currentId}
      aria-label="Tool Choice for an LLM"
      onChange={(id) => {
        if (typeof id === "string") {
          onChange(idToCanonical(id));
        }
      }}
    >
      <Label>Tool Choice</Label>
      <Button>
        <SelectValue />
        <SelectChevronUpDownIcon />
      </Button>
      <Popover>
        <ListBox>
          <SelectItem id="ZERO_OR_MORE" textValue="auto">
            <OptionLabel label="Tools auto-selected by LLM" apiToken="auto" />
          </SelectItem>
          <SelectItem id="ONE_OR_MORE" textValue={config.oneOrMoreToken}>
            <OptionLabel
              label="Use at least one tool"
              apiToken={config.oneOrMoreToken}
            />
          </SelectItem>
          <SelectItem id="NONE" textValue="none">
            <OptionLabel label="Don't use any tools" apiToken="none" />
          </SelectItem>
          {toolNames.map((toolName) => (
            <SelectItem
              key={`${SPECIFIC_FUNCTION_PREFIX}${toolName}`}
              id={`${SPECIFIC_FUNCTION_PREFIX}${toolName}`}
              textValue={toolName}
            >
              {toolName}
            </SelectItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
