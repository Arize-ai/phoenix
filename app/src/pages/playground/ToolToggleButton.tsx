import React from "react";

import {
  Button,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@arizeai/components";

import { ToolOutline } from "./ToolOutline";

export function ToolToggleButton({
  hasTools,
  onClick,
}: {
  hasTools: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipTrigger delay={0} offset={5}>
      <Button
        icon={
          hasTools ? (
            <Icon svg={<Icons.MinusOutline />} />
          ) : (
            <Icon svg={<ToolOutline />} />
          )
        }
        aria-label={hasTools ? "Remove tool calls" : "Add tool calls"}
        title={hasTools ? "Remove tool calls" : "Add tool calls"}
        size="compact"
        variant="default"
        onClick={onClick}
      />
      <Tooltip>{hasTools ? "Remove tool calls" : "Add tool calls"}</Tooltip>
    </TooltipTrigger>
  );
}
