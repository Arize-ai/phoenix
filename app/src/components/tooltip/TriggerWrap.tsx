import React from "react";
import { Pressable } from "react-aria";

/**
 * TriggerWrap
 *
 * This component is used to wrap non-focusable elements (such as text or
 * graphics) so that they can be used as a trigger for tooltips. It ensures
 * the wrapped element is focusable and accessible for keyboard and mouse
 * interactions, which is required for tooltip triggers.
 */
export function TriggerWrap({
  children,
  ...props
}: { children: React.ReactNode } & Omit<
  React.ComponentProps<typeof Pressable>,
  "children"
>) {
  return (
    <Pressable {...props}>
      <div>{children}</div>
    </Pressable>
  );
}
