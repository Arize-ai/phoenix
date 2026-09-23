import {
  Icon,
  Icons,
  SegmentedControl,
  SegmentedControlItem,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

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
    <SegmentedControl
      selectedKey={messageMode}
      size="S"
      aria-label="Message Mode"
      onSelectionChange={(mode) => {
        if (typeof mode === "string" && isAIMessageMode(mode)) {
          onChange(mode);
        }
      }}
    >
      <TooltipTrigger delay={0}>
        <SegmentedControlItem aria-label="text input" id="text">
          <Icon svg={<Icons.MessageSquare />} />
        </SegmentedControlItem>
        <Tooltip placement="top">
          <TooltipArrow />
          Text input
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={0}>
        <SegmentedControlItem aria-label="tool calling" id="toolCalls">
          <Icon svg={<Icons.Code />} />
        </SegmentedControlItem>
        <Tooltip placement="top">
          <TooltipArrow />
          Tool calling
        </Tooltip>
      </TooltipTrigger>
    </SegmentedControl>
  );
}
