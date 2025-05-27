import { Item, Picker } from "@arizeai/components";

import { Flex, Token } from "@phoenix/components";
import {
  AnthropicToolChoice,
  findToolChoiceName,
  makeAnthropicToolChoice,
  makeOpenAIToolChoice,
  OpenaiToolChoice,
} from "@phoenix/schemas/toolChoiceSchemas";
import { assertUnreachable, isObject } from "@phoenix/typeUtils";

/**
 * The "default" tool choices for each provider
 * Default just means choices we an always render without knowing any tool names
 * Note: Some providers wrap all tool choices in an object, some only wrap specific tool selections in an object
 *   so you need to unwrap the choice before checking if it is a default choice
 *
 */
export const DEFAULT_TOOL_CHOICES_BY_PROVIDER = {
  OPENAI: ["required", "auto", "none"] as const,
  AZURE_OPENAI: ["required", "auto", "none"] as const,
  ANTHROPIC: ["any", "auto", "none"] as const,
} satisfies Partial<
  Record<ModelProvider, (string | Record<string, unknown>)[]>
>;

/**
 * Extracts the type of tool choice from a choice
 *
 * Some providers wrap all tool choices in an object, some only wrap specific tool selections in an object
 *
 * @param provider The provider of the choice
 * @param choice The choice to extract the type from
 * @returns The type of the choice
 */
export const findToolChoiceType = (
  provider: ModelProvider,
  choice: unknown
) => {
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      if (
        isObject(choice) &&
        "type" in choice &&
        typeof choice.type === "string"
      ) {
        return choice.type;
      }
      return choice;
    case "ANTHROPIC":
      if (
        isObject(choice) &&
        "type" in choice &&
        typeof choice.type === "string"
      ) {
        return choice.type;
      }
      return choice;
    case "GOOGLE":
      // TODO(apowell): #5348 Add Google tool choice schema
      return "auto";
    default:
      assertUnreachable(provider);
  }
};

/**
 * Checks if a provider has a default tool choice
 * If so, it is supported by the {@link ToolChoiceSelector} component
 * @param provider The provider to check
 * @returns True if the provider has a default tool choice, false otherwise
 */
export const isSupportedToolChoiceProvider = (
  provider: ModelProvider
): provider is keyof typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER => {
  return provider in DEFAULT_TOOL_CHOICES_BY_PROVIDER;
};

/**
 * Checks if a choice is a default (simple) tool choice for a provider.
 *
 * A default tool choice is one like "auto" or {type: "auto"}, that we can render without knowing any tool names
 * Note: Wrapped tool choices must be unwrapped before being checked
 *
 * @param provider The provider to check the choice for
 * @param choice The choice to check
 * @returns True if the choice is a default tool choice for the provider, false otherwise
 */
const isDefaultToolChoice = <
  T extends keyof typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER,
>(
  provider: T,
  choice: unknown
): choice is (typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER)[T][number] => {
  return (
    DEFAULT_TOOL_CHOICES_BY_PROVIDER[provider]?.includes(choice as "auto") ??
    false
  );
};

/**
 * A prefix to add to user defined tools in the picker to avoid picker key collisions with default {@link ToolChoice} keys
 */
const TOOL_NAME_PREFIX = "tool_";

/**
 * Adds a prefix to user defined tool names to avoid conflicts picker key collisions with default {@link ToolChoice} keys
 * @param toolName The name of a tool
 * @returns  The tool name with the "TOOL_NAME_PREFIX" prefix added
 */
const addToolNamePrefix = (toolName: string) =>
  `${TOOL_NAME_PREFIX}${toolName}`;

/**
 * Removes the "TOOL_NAME_PREFIX" prefix from a tool name so that it can be used as a choice that corresponds to an actual tool
 * @param toolName The name of a tool with the "TOOL_NAME_PREFIX" prefix
 * @returns The tool name with the "TOOL_NAME_PREFIX" prefix removed
 */
const removeToolNamePrefix = (toolName: string) =>
  toolName.startsWith(TOOL_NAME_PREFIX)
    ? toolName.slice(TOOL_NAME_PREFIX.length)
    : toolName;

/**
 * Renders a label for a tool choice
 *
 * Fuzzily matches the choice type to a friendly label
 *
 * @returns A label for the tool choice
 */
export const ChoiceLabel = ({
  choiceType,
}: {
  choiceType: string;
}): JSX.Element => {
  switch (choiceType) {
    case "any":
    case "required":
      return (
        <Flex gap={"size-100"} width={"100%"}>
          Use at least one tool{" "}
          <Token color="var(--ac-global-color-grey-900)" size="S">
            {choiceType}
          </Token>
        </Flex>
      );
    case "none":
      return (
        <Flex gap={"size-100"} width={"100%"}>
          Don&apos;t use any tools{" "}
          <Token color="var(--ac-global-color-grey-900)" size="S">
            {choiceType}
          </Token>
        </Flex>
      );
    case "auto":
    default:
      return (
        <Flex gap={"size-100"} width={"100%"}>
          Tools auto-selected by LLM{" "}
          <Token color="var(--ac-global-color-grey-900)" size="S">
            {choiceType}
          </Token>
        </Flex>
      );
  }
};

type ToolChoiceSelectorProps<
  T extends keyof typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER,
> = {
  provider: T;
  /**
   * The current choice including the default {@link ToolChoice} and any user defined tools
   */
  choice: OpenaiToolChoice | AnthropicToolChoice | undefined;
  /**
   * Callback for when the tool choice changes
   */
  onChange: (choice: OpenaiToolChoice | AnthropicToolChoice) => void;
  /**
   * A list of user defined tool names
   */
  toolNames: string[];
};

export function ToolChoiceSelector<
  T extends keyof typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER,
>({ choice, onChange, toolNames, provider }: ToolChoiceSelectorProps<T>) {
  const currentChoiceType = findToolChoiceType(provider, choice);
  const inDefaultToolChoices = isDefaultToolChoice(provider, currentChoiceType);
  const currentKey = inDefaultToolChoices
    ? currentChoiceType
    : addToolNamePrefix(findToolChoiceName(choice) ?? "");
  return (
    <Picker
      selectedKey={currentKey}
      label="Tool Choice"
      aria-label="Tool Choice for an LLM"
      onSelectionChange={(choice) => {
        if (typeof choice !== "string") {
          return;
        }
        if (choice.startsWith(TOOL_NAME_PREFIX)) {
          switch (provider) {
            case "AZURE_OPENAI":
            case "OPENAI":
              onChange(
                makeOpenAIToolChoice({
                  type: "function",
                  function: {
                    name: removeToolNamePrefix(choice),
                  },
                })
              );
              break;
            case "ANTHROPIC":
              onChange(
                makeAnthropicToolChoice({
                  type: "tool",
                  name: removeToolNamePrefix(choice),
                })
              );
              break;
            default:
              assertUnreachable(provider);
          }
        } else if (isDefaultToolChoice(provider, choice)) {
          switch (provider) {
            case "AZURE_OPENAI":
            case "OPENAI":
              onChange(
                makeOpenAIToolChoice(
                  choice as (typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER)["OPENAI"][number]
                )
              );
              break;
            case "ANTHROPIC":
              onChange(
                makeAnthropicToolChoice({
                  type: choice as (typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER)["ANTHROPIC"][number],
                })
              );
              break;
            default:
              assertUnreachable(provider);
          }
        }
      }}
    >
      {[
        ...(DEFAULT_TOOL_CHOICES_BY_PROVIDER[provider]
          ? DEFAULT_TOOL_CHOICES_BY_PROVIDER[provider].map((choice) => (
              <Item key={choice} textValue={choice}>
                <ChoiceLabel choiceType={choice} />
              </Item>
            ))
          : []),
        // Add "TOOL_NAME_PREFIX" prefix to user defined tool names to avoid conflicts with default keys
        ...toolNames.map((toolName) => (
          <Item key={addToolNamePrefix(toolName)} textValue={toolName}>
            {toolName}
          </Item>
        )),
      ]}
    </Picker>
  );
}
