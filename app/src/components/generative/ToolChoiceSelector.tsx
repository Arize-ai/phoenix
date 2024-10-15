import React from "react";

import { Flex, Item, Label, Picker } from "@arizeai/components";

type DefaultToolChoice = Extract<ToolChoice, "auto" | "required" | "none">;

const isDefaultToolChoice = (choice: string): choice is DefaultToolChoice => {
  return choice === "auto" || choice === "required" || choice === "none";
};

/**
 * A prefix to add to user defined tools in the picker to avoid collisions with default {@link ToolChoice} keys
 * Note if a user names their tool "auto", "required", or "none" the picker will always show that they have selected their own tool
 * However, we can't disambiguate this and neither can an LLM API
 * Using this prefix, however, still prevents an error which occurs when there are duplicate keys in the picker
 */
const TOOL_NAME_PREFIX = "tool_";

/**
 * Adds a prefix to user defined tool names to avoid conflicts with default {@link ToolChoice} keys
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

type ToolChoicePickerProps = {
  /**
   * The current choice including the default {@link ToolChoice} and any user defined tools
   */
  choice: ToolChoice;
  /**
   * Callback for when the tool choice changes
   */
  onChange: (choice: ToolChoice) => void;
  /**
   * A list of user defined tool names
   */
  toolNames: string[];
};

export function ToolChoicePicker({
  choice,
  onChange,
  toolNames,
}: ToolChoicePickerProps) {
  const currentKey =
    typeof choice === "string"
      ? choice
      : addToolNamePrefix(choice.function.name);
  return (
    <Picker
      selectedKey={currentKey}
      label="Tool Choice"
      aria-label="Tool Choice for an LLM"
      size="compact"
      onSelectionChange={(choice) => {
        if (typeof choice !== "string") {
          return;
        }
        if (choice.startsWith(TOOL_NAME_PREFIX)) {
          onChange({
            type: "function",
            function: {
              name: removeToolNamePrefix(choice),
            },
          });
        } else if (isDefaultToolChoice(choice)) {
          onChange(choice);
        }
      }}
    >
      {[
        <Item key="auto">
          <Flex gap={"size-50"}>
            Tools auto-selected by LLM <Label>auto</Label>
          </Flex>
        </Item>,
        <Item key="required">
          <Flex gap={"size-50"}>
            Use at least one tool <Label>required</Label>
          </Flex>
        </Item>,
        <Item key="none">
          <Flex gap={"size-50"}>
            Don&apos;t use any tools <Label>none</Label>
          </Flex>
        </Item>,
        // Add "TOOL_NAME_PREFIX" prefix to user defined tool names to avoid conflicts with default keys
        ...toolNames.map((toolName) => (
          <Item key={addToolNamePrefix(toolName)}>{toolName}</Item>
        )),
      ]}
    </Picker>
  );
}
