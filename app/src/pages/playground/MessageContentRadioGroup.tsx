import {
  Icon,
  Icons,
  ToggleButton,
  ToggleButtonGroup,
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
    <ToggleButtonGroup
      selectedKeys={[messageMode]}
      size="S"
      aria-label="Message Mode"
      onSelectionChange={(v) => {
        if (v.size === 0) {
          return;
        }
        const mode = v.keys().next().value;
        if (isAIMessageMode(mode)) {
          onChange(mode);
        }
      }}
    >
      <TooltipTrigger delay={0}>
        <ToggleButton aria-label="text input" id={"text"}>
          <Icon svg={<Icons.MessageSquareOutline />} />
        </ToggleButton>
        <Tooltip placement="top">
          <TooltipArrow />
          Text input
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={0}>
        <ToggleButton aria-label="tool calling" id={"toolCalls"}>
          <Icon svg={<Icons.Code />} />
        </ToggleButton>
        <Tooltip placement="top">
          <TooltipArrow />
          Tool calling
        </Tooltip>
      </TooltipTrigger>
    </ToggleButtonGroup>
  );
}
