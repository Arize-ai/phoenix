import React from "react";

import {
  FileTextOutline,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Icon, Icons, Radio, RadioGroup } from "@phoenix/components";

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
      aria-label="Markdown Mode"
      value={mode}
      onChange={(value) => {
        onModeChange(value as MarkdownDisplayMode);
      }}
    >
      <Radio aria-label="text" value="text">
        <TooltipTrigger placement="top" delay={1000} offset={10}>
          <TriggerWrap>
            <Icon svg={<Icons.TextOutline />} />
          </TriggerWrap>
          <Tooltip>Text</Tooltip>
        </TooltipTrigger>
      </Radio>
      <Radio aria-label="markdown" value="markdown">
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
