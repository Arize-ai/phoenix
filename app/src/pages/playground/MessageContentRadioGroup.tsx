import React from "react";

import { Icon, Icons, Radio, RadioGroup } from "@arizeai/components";

export type AIMessageMode = "text" | "toolCalls";
export type UserMessageMode = "text" | "multiPart";

function isAIMessageMode(value: string): value is AIMessageMode {
  return value === "text" || value === "toolCalls";
}

function isUserMessageMode(value: string): value is UserMessageMode {
  return value === "text" || value === "multiPart";
}

export function AIMessageContentRadioGroup({
  messageMode,
  onChange,
}: {
  messageMode: AIMessageMode;
  onChange: (messageMode: AIMessageMode) => void;
}) {
  return (
    <RadioGroup
      defaultValue={messageMode}
      variant="inline-button"
      size="compact"
      onChange={(v) => {
        if (isAIMessageMode(v)) {
          onChange(v);
        } else {
          throw new Error(`Unknown message mode: ${v}`);
        }
      }}
    >
      <Radio label="text input" value={"text"}>
        <Icon svg={<Icons.MessageSquareOutline />} />
      </Radio>
      <Radio label="tool calling" value={"toolCalls"}>
        <Icon svg={<Icons.Code />} />
      </Radio>
    </RadioGroup>
  );
}

export function UserMessageContentRadioGroup({
  messageMode,
  onChange,
}: {
  messageMode: UserMessageMode;
  onChange: (messageMode: UserMessageMode) => void;
}) {
  return (
    <RadioGroup
      defaultValue={messageMode}
      variant="inline-button"
      size="compact"
      onChange={(v) => {
        if (isUserMessageMode(v)) {
          onChange(v);
        } else {
          throw new Error(`Unknown message mode: ${v}`);
        }
      }}
    >
      <Radio label="text input" value={"text"}>
        <Icon svg={<Icons.MessageSquareOutline />} />
      </Radio>
      <Radio label="multi-part" value={"multiPart"}>
        <Icon svg={<Icons.ListOutline />} />
      </Radio>
    </RadioGroup>
  );
}
