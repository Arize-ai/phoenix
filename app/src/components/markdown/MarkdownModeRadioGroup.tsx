import React from "react";

import { FileTextOutline, Tooltip, TooltipTrigger } from "@arizeai/components";

import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
} from "@phoenix/components";

import { useMarkdownMode } from "./MarkdownDisplayContext";
import { MarkdownDisplayMode } from "./types";

const markdownDisplayModes: MarkdownDisplayMode[] = ["text", "markdown"];

/**
 * TypeGuard for the markdown mode
 */
function isMarkdownDisplayMode(m: unknown): m is MarkdownDisplayMode {
  return (
    typeof m === "string" &&
    markdownDisplayModes.includes(m as MarkdownDisplayMode)
  );
}

export function MarkdownModeRadioGroup({
  mode,
  onModeChange,
}: {
  mode: MarkdownDisplayMode;
  onModeChange: (newMode: MarkdownDisplayMode) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="Markdown Mode"
      selectedKeys={[mode]}
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const mode = v.keys().next().value;
        if (isMarkdownDisplayMode(mode)) {
          onModeChange(mode);
        } else {
          throw new Error(`Unknown markdown mode: ${mode}`);
        }
      }}
    >
      <TooltipTrigger placement="top" delay={1000} offset={10}>
        <ToggleButton aria-label="text" id="text">
          <Icon svg={<Icons.TextOutline />} />
        </ToggleButton>
        <Tooltip>Text</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger placement="top" delay={1000} offset={10}>
        <ToggleButton aria-label="markdown" id="markdown">
          <Icon svg={<FileTextOutline />} />
        </ToggleButton>
        <Tooltip>Markdown</Tooltip>
      </TooltipTrigger>
    </ToggleButtonGroup>
  );
}

export function ConnectedMarkdownModeRadioGroup() {
  const { mode, setMode } = useMarkdownMode();
  return <MarkdownModeRadioGroup mode={mode} onModeChange={setMode} />;
}
