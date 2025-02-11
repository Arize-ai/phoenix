import React, { forwardRef, PropsWithChildren, Ref } from "react";

export interface KeyboardProps extends PropsWithChildren {}

/**
 * Keyboard represents text that specifies a keyboard command.
 */
export const Keyboard = forwardRef(function Keyboard(
  props: KeyboardProps,
  ref: Ref<HTMLElement>
) {
  return (
    <kbd ref={ref} className="ac-keyboard">
      {props.children}
    </kbd>
  );
});
