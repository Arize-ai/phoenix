import React, { forwardRef, PropsWithChildren, Ref } from "react";
import { css } from "@emotion/react";

export interface KeyboardProps extends PropsWithChildren {
  variant?: "default" | "primary";
}

const keyboardCSS = css`
  font-family: -apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  &[data-variant="primary"] {
    background-color: var(--ac-global-color-primary-100);
    color: var(--ac-global-color-primary-700);
    padding: var(--ac-global-dimension-static-size-50)
      var(--ac-global-dimension-static-size-100);
    border-radius: var(--ac-global-dimension-static-size-100);
  }
`;

/**
 * Keyboard represents text that specifies a keyboard command.
 */
export const Keyboard = forwardRef(function Keyboard(
  { variant = "default", children }: KeyboardProps,
  ref: Ref<HTMLElement>
) {
  return (
    <kbd
      ref={ref}
      css={keyboardCSS}
      className="ac-keyboard"
      data-variant={variant}
    >
      {children}
    </kbd>
  );
});
