import type { SerializedStyles } from "@emotion/react";
import { css, keyframes } from "@emotion/react";
import type { ReactNode } from "react";
import { Pressable } from "react-aria";

import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";
import { Flex } from "@phoenix/components/core/layout";
import { Tooltip, TooltipTrigger } from "@phoenix/components/core/tooltip";
import type { TooltipProps } from "@phoenix/components/core/tooltip";

export type ValidationBadgeSeverity = "danger" | "warning";

/**
 * Grows a badge out from its leading edge. Animating max-width alongside
 * opacity keeps the appearance smooth: the neighbors cede the space gradually
 * instead of the badge popping in at full size.
 */
export const validationBadgeGrowIn = keyframes`
  from {
    opacity: 0;
    max-width: 0;
    padding-left: 0;
    padding-right: 0;
  }
`;

const validationBadgeCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  max-width: 200px;
  overflow: hidden;
  padding: 2px var(--global-dimension-size-65);
  border-radius: var(--global-rounding-small);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
  white-space: nowrap;
  cursor: default;
  animation: ${validationBadgeGrowIn} 0.25s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  &[data-severity="danger"] {
    background-color: var(--global-color-danger-100);
    color: var(--global-color-danger);
  }
  &[data-severity="warning"] {
    background-color: color-mix(
      in srgb,
      var(--global-color-warning) 10%,
      transparent
    );
    color: var(--global-color-warning);
  }
  .icon-wrap {
    flex-shrink: 0;
  }
  &:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  .validation-badge__message {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export type ValidationBadgeProps = {
  /** Accessible name for the badge, e.g. "Filter condition error". */
  ariaLabel: string;
  /** The short message shown in the badge itself. Truncates past 200px. */
  message: string;
  /** Heading of the tooltip that carries the full story. */
  title: string;
  /** Detail rendered below the tooltip title. */
  children?: ReactNode;
  /** @default "danger" */
  severity?: ValidationBadgeSeverity;
  /** @default "top" */
  tooltipPlacement?: TooltipProps["placement"];
  /** Extra styles for the tooltip surface. */
  tooltipCSS?: SerializedStyles;
};

/**
 * A passive validation status: a small tinted badge previewing the problem
 * whose tooltip carries the full message on hover or focus. It lives inline
 * beside other controls so it never pushes content around or competes with
 * the input for attention the way a banner does.
 */
export function ValidationBadge({
  ariaLabel,
  message,
  title,
  children,
  severity = "danger",
  tooltipPlacement = "top",
  tooltipCSS,
}: ValidationBadgeProps) {
  return (
    <TooltipTrigger delay={0}>
      <Pressable>
        <div
          role="button"
          tabIndex={0}
          className="validation-badge"
          css={validationBadgeCSS}
          data-severity={severity}
          aria-label={ariaLabel}
        >
          <Icon svg={<Icons.AlertCircle />} color={severity} />
          <span className="validation-badge__message">{message}</span>
        </div>
      </Pressable>
      <Tooltip placement={tooltipPlacement} css={tooltipCSS}>
        <Flex direction="row" gap="size-100" alignItems="start">
          <Icon svg={<Icons.AlertCircle />} color={severity} />
          <Flex direction="column" gap="size-25">
            <Text size="S" weight="heavy">
              {title}
            </Text>
            {children}
          </Flex>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
}
