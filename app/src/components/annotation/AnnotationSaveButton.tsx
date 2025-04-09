import React, { forwardRef } from "react";
import { PressEvent } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

import { Keyboard, VisuallyHidden } from "@phoenix/components";
import { Button, ButtonProps } from "@phoenix/components/button";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

type AnnotationSaveButtonProps = ButtonProps;

export const AnnotationSaveButton = forwardRef<
  HTMLButtonElement,
  AnnotationSaveButtonProps
>(({ children, ...props }, ref) => {
  const modifierKey = useModifierKey();
  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      props.onPress?.(e as unknown as PressEvent);
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    }
  );
  return (
    <Button variant="primary" {...props} ref={ref}>
      {(states) => (
        <div
          css={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "var(--ac-global-dimension-static-size-200)",
          }}
        >
          <span aria-hidden="true" />
          {typeof children === "function"
            ? children({
                ...props,
                ...states,
              })
            : children}
          <Keyboard
            css={{
              justifyContent: "end",
            }}
          >
            <VisuallyHidden>{modifierKey}</VisuallyHidden>
            <span aria-hidden="true">
              {modifierKey === "Cmd" ? "⌘" : "Ctrl"}
            </span>
            <VisuallyHidden>enter</VisuallyHidden>
            <span aria-hidden="true">⏎</span>
          </Keyboard>
        </div>
      )}
    </Button>
  );
});

AnnotationSaveButton.displayName = "AnnotationSaveButton";
