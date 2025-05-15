import { forwardRef } from "react";
import { PressEvent } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";

import { Flex, Keyboard, VisuallyHidden } from "@phoenix/components";
import { Button, ButtonProps } from "@phoenix/components/button";
import { useModifierKey } from "@phoenix/hooks/useModifierKey";

type AnnotationSaveButtonProps = ButtonProps;

export const AnnotationSaveButton = forwardRef<
  HTMLButtonElement,
  AnnotationSaveButtonProps
>(({ ...props }, ref) => {
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
    <Flex justifyContent="end" width="100%">
      <Button
        variant="primary"
        {...props}
        ref={ref}
        trailingVisual={
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
        }
      />
    </Flex>
  );
});

AnnotationSaveButton.displayName = "AnnotationSaveButton";
