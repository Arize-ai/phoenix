import React, { forwardRef, PropsWithChildren, Ref } from "react";
import { css } from "@emotion/react";
export interface KeyboardProps extends PropsWithChildren {}

const keyboardCSS = css`
  font-family: -apple-system, "system-ui", "Segoe UI", "Noto Sans", Helvetica,
    Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
`;
/**
 * Keyboard represents text that specifies a keyboard command.
 */
export const Keyboard = forwardRef(function Keyboard(
  props: KeyboardProps,
  ref: Ref<HTMLElement>
) {
  return (
    <kbd ref={ref} css={keyboardCSS} className="ac-keyboard">
      {props.children}
    </kbd>
  );
});
