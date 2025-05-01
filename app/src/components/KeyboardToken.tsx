import React, { forwardRef, Ref } from "react";
import { css } from "@emotion/react";

import { Keyboard, KeyboardProps } from "./content/Keyboard";

const keyboardTokenCSS = css`
  background-color: var(--ac-global-color-primary-100);
  color: var(--ac-global-color-primary-700);
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100);
  border-radius: var(--ac-global-dimension-static-size-100);
`;

/**
 * Keyboard Token represents text that specifies a keyboard command,
 * and is styled to look like a keyboard key.
 */
export const KeyboardToken = forwardRef(function KeyboardToken(
  { children, ...props }: KeyboardProps,
  ref: Ref<HTMLElement>
) {
  return (
    <Keyboard ref={ref} css={keyboardTokenCSS} {...props}>
      {children}
    </Keyboard>
  );
});
