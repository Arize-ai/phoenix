import React from "react";

import { Item, Label, Picker } from "@arizeai/components";

import { Flex } from "@phoenix/components";
import {
  AnthropicToolChoice,
  findToolChoiceName,
  makeAnthropicToolChoice,
  makeOpenAIToolChoice,
  OpenaiToolChoice,
  safelyConvertToolChoiceToProvider,
} from "@phoenix/schemas/toolChoiceSchemas";
import { assertUnreachable, isObject } from "@phoenix/typeUtils";

export const DEFAULT_TOOL_CHOICES_BY_PROVIDER = {
  OPENAI: ["auto", "required", "none"] as const,
  AZURE_OPENAI: ["auto", "required", "none"] as const,
  ANTHROPIC: ["auto", "any"] as const,
} satisfies Partial<
  Record<ModelProvider, (string | Record<string, unknown>)[]>
>;

export const getToolChoiceType = (provider: ModelProvider, choice: unknown) => {
  switch (provider) {
    case "AZURE_OPENAI":
    case "OPENAI":
      if (isObject(choice) && "type" in choice) {
        return choice.type;
      }
      return choice;
    case "ANTHROPIC":
      if (isObject(choice) && "type" in choice) {
        return choice.type;
      }
      return choice;
    case "GEMINI":
      // TODO(apowell): #5348 Add Gemini tool choice schema
      return "auto";
    default:
      assertUnreachable(provider);
  }
};

export const isSupportedToolChoiceProvider = (
  provider: ModelProvider
): provider is keyof typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER => {
  return provider in DEFAULT_TOOL_CHOICES_BY_PROVIDER;
};

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

type ToolChoicePickerProps<
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

export function ToolChoicePicker<
  T extends keyof typeof DEFAULT_TOOL_CHOICES_BY_PROVIDER,
>({ choice, onChange, toolNames, provider }: ToolChoicePickerProps<T>) {
  const currentChoiceType = getToolChoiceType(provider, choice);
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
          const convertedChoice = safelyConvertToolChoiceToProvider({
            toolChoice: choice,
            targetProvider: provider,
          });
          if (convertedChoice) {
            onChange(convertedChoice);
          }
        }
      }}
    >
      {[
        // <Item key="auto" textValue="auto">
        //   <Flex gap={"size-100"}>
        //     Tools auto-selected by LLM <Label color="grey-900">auto</Label>
        //   </Flex>
        // </Item>,
        // <Item key="required" textValue="required">
        //   <Flex gap={"size-100"}>
        //     Use at least one tool <Label color="grey-900">required</Label>
        //   </Flex>
        // </Item>,
        // <Item key="none" textValue="none">
        //   <Flex gap={"size-100"}>
        //     Don&apos;t use any tools <Label color="grey-900">none</Label>
        //   </Flex>
        // </Item>,
        ...(DEFAULT_TOOL_CHOICES_BY_PROVIDER[provider]
          ? DEFAULT_TOOL_CHOICES_BY_PROVIDER[provider].map((choice) => (
              <Item key={choice} textValue={choice}>
                {choice}
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
