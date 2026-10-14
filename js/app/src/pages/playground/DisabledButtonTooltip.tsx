import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Focusable } from "react-aria";

import { Tooltip, TooltipArrow, TooltipTrigger } from "@phoenix/components";

// A disabled button swallows pointer events, so the wrapper never hears the
// hover a tooltip needs; letting them fall through fixes that.
const wrapCSS = css`
  display: inline-flex;

  button[disabled] {
    pointer-events: none;
  }
`;

/**
 * Says why a disabled button is disabled. Disabled buttons cannot be hovered
 * or focused, so the tooltip hangs off a focusable wrapper that stands in
 * for the button: it carries the button's name and disabled state, and the
 * button itself is hidden from assistive technology.
 */
export function DisabledButtonTooltip({
  label,
  reason,
  children,
}: {
  /** The disabled button's name, e.g. "Run". */
  label: string;
  reason: string;
  children: ReactNode;
}) {
  return (
    <TooltipTrigger delay={0}>
      <Focusable>
        <span
          css={wrapCSS}
          role="button"
          aria-disabled="true"
          aria-label={label}
        >
          <span aria-hidden="true">{children}</span>
        </span>
      </Focusable>
      <Tooltip>
        <TooltipArrow />
        {reason}
      </Tooltip>
    </TooltipTrigger>
  );
}
