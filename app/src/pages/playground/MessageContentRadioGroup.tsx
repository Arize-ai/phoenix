import React from "react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Icon, Icons, Radio, RadioGroup } from "@phoenix/components";

export type AIMessageMode = "text" | "toolCalls";
export type MessageMode = AIMessageMode;

function isAIMessageMode(value: string): value is AIMessageMode {
  return value === "text" || value === "toolCalls";
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
      aria-label="Message Mode"
      onChange={(v) => {
        if (isAIMessageMode(v)) {
          onChange(v);
        } else {
          throw new Error(`Unknown message mode: ${v}`);
        }
      }}
    >
      <Radio aria-label="text input" value={"text"}>
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <Icon svg={<Icons.MessageSquareOutline />} />
          </TriggerWrap>
          <Tooltip>Text input</Tooltip>
        </TooltipTrigger>
      </Radio>
      <Radio aria-label="tool calling" value={"toolCalls"}>
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <Icon svg={<Icons.Code />} />
          </TriggerWrap>
          <Tooltip>Tool calling</Tooltip>
        </TooltipTrigger>
      </Radio>
    </RadioGroup>
  );
}
