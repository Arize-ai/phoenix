import React from "react";

import { Flex, Item, Label, Picker } from "@arizeai/components";

type ToolChoiceWithFunctions = ToolChoice | string;
type ToolChoicePickerProps = {
  /**
   * The current choice including the default {@link ToolChoice} and any user defined tools
   */
  choice: ToolChoiceWithFunctions;
  /**
   * Callback for when the tool choice changes
   */
  onChange: (choice: ToolChoiceWithFunctions) => void;
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
  return (
    <Picker
      selectedKey={choice}
      label="Tool Choice"
      aria-label="Tool Choice for an LLM"
      size="compact"
      onSelectionChange={(choice) => {
        if (typeof choice === "string") {
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
        ...toolNames.map((toolName) => <Item key={toolName}>{toolName}</Item>),
      ]}
    </Picker>
  );
}
