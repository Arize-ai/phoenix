import React from "react";
import { Focusable } from "react-aria";

/**
 * TriggerWrap
 *
 * This component is used to wrap non-focusable elements (such as text or
 * graphics) so that they can be used as a trigger for tooltips. It ensures
 * the wrapped element is focusable and accessible for keyboard and mouse
 * interactions, which is required for tooltip triggers.
 *
 * It does not handle presses, so a click on the wrapped content still reaches
 * an enclosing clickable surface such as a table row.
 */
export function TriggerWrap({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Focusable>, "children">) {
  return (
    <Focusable {...props}>
      <div role="button" className={className}>
        {children}
      </div>
    </Focusable>
  );
}
