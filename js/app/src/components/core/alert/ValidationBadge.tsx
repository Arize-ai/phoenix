import { css, keyframes } from "@emotion/react";
import { Pressable } from "react-aria";

import type { SeverityLevel } from "../types";
import { getSeverityIcon } from "./getSeverityIcon";

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
