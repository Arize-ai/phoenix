import React from "react";

import {
  FileTextOutline,
  Icon,
  Radio,
  RadioGroup,
  TextOutline,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import { MarkdownDisplayMode } from "./types";

export function MarkdownModeRadioGroup({
  mode,
  onModeChange,
}: {
  mode: MarkdownDisplayMode;
  onModeChange: (newMode: MarkdownDisplayMode) => void;
}) {
  return (
    <RadioGroup
      size="compact"
      variant="inline-button"
      defaultValue={mode}
      onChange={(value) => {
        onModeChange(value as MarkdownDisplayMode);
      }}
    >
      <Radio label="text" value="text">
        <TooltipTrigger placement="top" delay={1000} offset={10}>
          <TriggerWrap>
            <Icon svg={<TextOutline />} />
          </TriggerWrap>
          <Tooltip>Text</Tooltip>
        </TooltipTrigger>
      </Radio>
      <Radio label="markdown" value="markdown">
        <TooltipTrigger placement="top" delay={1000} offset={10}>
          <TriggerWrap>
            <Icon svg={<FileTextOutline />} />
          </TriggerWrap>
          <Tooltip>Markdown</Tooltip>
        </TooltipTrigger>
      </Radio>
    </RadioGroup>
  );
}

export function ConnectedMarkdownModeRadioGroup() {
  const { mode, setMode } = useMarkdownMode();
  return <MarkdownModeRadioGroup mode={mode} onModeChange={setMode} />;
}
