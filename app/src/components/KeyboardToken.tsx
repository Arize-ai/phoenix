import { forwardRef, Ref } from "react";
import { css } from "@emotion/react";

import { Keyboard, KeyboardProps } from "./content/Keyboard";

const keyboardTokenCSS = css`
  background-color: var(--global-color-primary-100);
  color: var(--global-color-primary-700);
  padding: var(--global-dimension-static-size-50)
    var(--global-dimension-static-size-100);
  font-size: var(--global-dimension-static-font-size-50);
  border-radius: var(--global-dimension-static-size-100);
  border: 1px solid var(--global-color-primary-200);
  box-shadow: 0 2px 0 0 var(--global-color-primary-200);
  // Offset the shadow to make it look like it's on the key
  margin-top: -1px;
  text-transform: uppercase;
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
