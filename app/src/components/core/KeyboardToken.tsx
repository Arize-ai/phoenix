import { css } from "@emotion/react";
import type { Ref } from "react";

import type { KeyboardProps } from "./content/Keyboard";
import { Keyboard } from "./content/Keyboard";

const keyboardTokenCSS = css`
  background-color: var(--global-color-primary-100);
  color: var(--global-color-primary-700);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-100);
  font-size: var(--global-dimension-font-size-50);
  border-radius: var(--global-dimension-size-100);
  border: 1px solid var(--global-color-primary-200);
  box-shadow: 0 2px 0 0 var(--global-color-primary-200);
  // Offset the shadow to make it look like it's on the key
  margin-top: -1px;
  text-transform: uppercase;
`;

// A subdued variant that drops the raised-key chrome (border, shadow, fill) in
// favor of a faint outline, so the token recedes into dense surfaces like the
// side navigation instead of competing with adjacent labels.
const quietKeyboardTokenCSS = css`
  background-color: transparent;
  color: var(--ac-global-text-color-500);
  padding: 0 var(--global-dimension-size-75);
  font-size: var(--global-dimension-font-size-50);
  border-radius: var(--global-rounding-small);
  border: 1px solid var(--ac-global-border-color-default);
  text-transform: uppercase;
`;

/**
 * Keyboard Token represents text that specifies a keyboard command,
 * and is styled to look like a keyboard key.
 *
 * Use the `quiet` variant when the token sits inside busy chrome (e.g. the
 * side navigation) and the raised-key styling would be too loud.
 */
export function KeyboardToken({
  ref,
  children,
  variant = "default",
  ...props
}: KeyboardProps & {
  ref?: Ref<HTMLElement>;
  variant?: "default" | "quiet";
}) {
  return (
    <Keyboard
      ref={ref}
      css={variant === "quiet" ? quietKeyboardTokenCSS : keyboardTokenCSS}
      {...props}
    >
      {children}
    </Keyboard>
  );
}
