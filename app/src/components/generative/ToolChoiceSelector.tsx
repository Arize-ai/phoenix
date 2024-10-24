import React from "react";

import { Flex, Item, Label, Picker } from "@arizeai/components";

type DefaultToolChoice = Extract<ToolChoice, "auto" | "required" | "none">;

const isDefaultToolChoice = (choice: string): choice is DefaultToolChoice => {
  return choice === "auto" || choice === "required" || choice === "none";
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

type ToolChoicePickerProps = {
  /**
   * The current choice including the default {@link ToolChoice} and any user defined tools
   */
  choice: ToolChoice | undefined;
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
    choice == null || typeof choice === "string"
      ? choice
      : addToolNamePrefix(choice.function.name);
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
        <Item key="auto" textValue="auto">
          <Flex gap={"size-100"}>
            Tools auto-selected by LLM <Label>auto</Label>
          </Flex>
        </Item>,
        <Item key="required" textValue="required">
          <Flex gap={"size-100"}>
            Use at least one tool <Label>required</Label>
          </Flex>
        </Item>,
        <Item key="none" textValue="none">
          <Flex gap={"size-100"}>
            Don&apos;t use any tools <Label>none</Label>
          </Flex>
        </Item>,
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
