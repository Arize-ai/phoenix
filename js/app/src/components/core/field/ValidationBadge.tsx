import { css, keyframes } from "@emotion/react";
import type { ReactNode } from "react";
import { Pressable } from "react-aria";

import { getSeverityIcon } from "@phoenix/components/core/alert/getSeverityIcon";
import { Text } from "@phoenix/components/core/content";
import { Flex } from "@phoenix/components/core/layout";
import { Tooltip } from "@phoenix/components/core/tooltip";
import type { TooltipProps } from "@phoenix/components/core/tooltip";
import type { SeverityLevel } from "@phoenix/components/core/types";

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
  color: var(--validation-badge-color);
  background-color: color-mix(
    in srgb,
    var(--validation-badge-color) 10%,
    transparent
  );
  animation: ${validationBadgeGrowIn} 0.25s ease-out;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
  &[data-variant="danger"] {
    --validation-badge-color: var(--global-color-danger);
  }
  &[data-variant="warning"] {
    --validation-badge-color: var(--global-color-warning);
  }
  &[data-variant="info"] {
    --validation-badge-color: var(--global-color-info);
  }
  &[data-variant="success"] {
    --validation-badge-color: var(--global-color-success);
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
  "aria-label": string;
  /** The short message shown in the badge. Truncates past 200px. */
  children: string;
  /** @default "danger" */
  variant?: SeverityLevel;
};

/**
 * A passive validation status: a small tinted badge previewing a problem. It
 * lives inline beside other controls so it never pushes content around or
 * competes with the input for attention the way a banner does.
 *
 * The badge is a focusable trigger. Compose it inside a `TooltipTrigger` with
 * a `ValidationTooltip` to carry the full message on hover or focus.
 */
export function ValidationBadge({
  "aria-label": ariaLabel,
  children,
  variant = "danger",
}: ValidationBadgeProps) {
  return (
    <Pressable>
      <div
        role="button"
        tabIndex={0}
        className="validation-badge"
        css={validationBadgeCSS}
        data-variant={variant}
        aria-label={ariaLabel}
      >
        {getSeverityIcon(variant, { filled: false })}
        <span className="validation-badge__message">{children}</span>
      </div>
    </Pressable>
  );
}

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
