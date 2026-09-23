import type { ReactNode } from "react";

import { Text } from "../content";
import { getSeverityIcon } from "../icon";
import { Flex } from "../layout";
import { Tooltip } from "../tooltip";
import type { TooltipProps } from "../tooltip";
import type { SeverityLevel } from "../types";

export type ValidationTooltipProps = Omit<TooltipProps, "children"> & {
  /** Heading of the tooltip. */
  title: string;
  /** Detail rendered below the title. */
  children?: ReactNode;
  /** @default "danger" */
  variant?: SeverityLevel;
};

/**
 * The tooltip half of a validation status: the severity icon beside a heavy
 * title with the detail below. Every other `Tooltip` prop passes through, so
 * a composition can place and style it like any tooltip.
 */
export function ValidationTooltip({
  title,
  children,
  variant = "danger",
  placement = "top",
  ...tooltipProps
}: ValidationTooltipProps) {
  return (
    <Tooltip placement={placement} {...tooltipProps}>
      <Flex direction="row" gap="size-100" alignItems="start">
        {getSeverityIcon(variant, { filled: false })}
        <Flex direction="column" gap="size-25">
          <Text size="S" weight="heavy">
            {title}
          </Text>
          {children}
        </Flex>
      </Flex>
    </Tooltip>
  );
}
