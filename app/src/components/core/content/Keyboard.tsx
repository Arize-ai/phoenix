import { css } from "@emotion/react";
import type { PropsWithChildren, Ref } from "react";

import { classNames } from "@phoenix/utils/classNames";

export interface KeyboardProps extends PropsWithChildren {
  ref?: Ref<HTMLElement>;
  className?: string;
}

const keyboardCSS = css`
  font-family:
    -apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica, Arial,
    sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: var(--global-rounding-small);
  padding: 1px var(--global-dimension-size-50);
  font-size: var(--global-font-size-xs);
  line-height: var(--global-line-height-xs);
`;

/**
 * Keyboard represents text that specifies a keyboard command.
 */
export function Keyboard({
  ref,
  children,
  className,
  ...props
}: KeyboardProps) {
  return (
    <kbd
      ref={ref}
      css={keyboardCSS}
      className={classNames("keyboard", className)}
      {...props}
    >
      {children}
    </kbd>
  );
}
