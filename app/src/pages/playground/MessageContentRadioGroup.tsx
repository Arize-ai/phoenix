import React from "react";

import {
  Icon,
  Icons,
  Radio,
  RadioGroup,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

export type AIMessageMode = "text" | "toolCalls";
export type UserMessageMode = "text" | "json";
export type MessageMode = AIMessageMode | UserMessageMode;

function isAIMessageMode(value: string): value is AIMessageMode {
  return value === "text" || value === "toolCalls";
}

function isUserMessageMode(value: string): value is UserMessageMode {
  return value === "text" || value === "json";
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
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <Icon svg={<Icons.MessageSquareOutline />} />
          </TriggerWrap>
          <Tooltip>Text input</Tooltip>
        </TooltipTrigger>
      </Radio>
      <Radio label="tool calling" value={"toolCalls"}>
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
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <Icon svg={<Icons.MessageSquareOutline />} />
          </TriggerWrap>
          <Tooltip>Text input</Tooltip>
        </TooltipTrigger>
      </Radio>
      <Radio label="json input" value={"json"}>
        <TooltipTrigger placement="top" delay={0} offset={10}>
          <TriggerWrap>
            <Icon svg={<Icons.Code />} />
          </TriggerWrap>
          <Tooltip>JSON input</Tooltip>
        </TooltipTrigger>
      </Radio>
    </RadioGroup>
  );
}
