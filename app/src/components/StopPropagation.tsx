import { PropsWithChildren } from "react";

/**
 * A component that stops the propagation of events.
 *
 * This is useful for preventing events from bubbling up to the parent component.
 * Such as when buttons are nested, like inside of a DisclosureTrigger.
 */
export function StopPropagation({ children }: PropsWithChildren) {
  return (
    <div
      style={{ display: "contents" }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
