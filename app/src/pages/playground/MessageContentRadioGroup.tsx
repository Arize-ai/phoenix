import React from "react";

import { Icon, Icons, Radio, RadioGroup } from "@arizeai/components";

export type MessageMode = "text" | "toolCalls";

function isMessageMode(value: string): value is MessageMode {
  return value === "text" || value === "toolCalls";
}

export function MessageContentRadioGroup({
  messageMode,
  onChange,
}: {
  messageMode: MessageMode;
  onChange: (messageMode: MessageMode) => void;
}) {
  return (
    <RadioGroup
      defaultValue={messageMode}
      variant="inline-button"
      size="compact"
      onChange={(v) => {
        if (isMessageMode(v)) {
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
