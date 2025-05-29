import { forwardRef, PropsWithChildren, Ref } from "react";
import { css } from "@emotion/react";

import { classNames } from "@arizeai/components";

export interface KeyboardProps extends PropsWithChildren {
  className?: string;
}

const keyboardCSS = css`
  font-family: -apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
`;

/**
 * Keyboard represents text that specifies a keyboard command.
 */
export const Keyboard = forwardRef(function Keyboard(
  { children, className, ...props }: KeyboardProps,
  ref: Ref<HTMLElement>
) {
  return (
    <kbd
      ref={ref}
      css={keyboardCSS}
      className={classNames("ac-keyboard", className)}
      {...props}
    >
      {children}
    </kbd>
  );
});
