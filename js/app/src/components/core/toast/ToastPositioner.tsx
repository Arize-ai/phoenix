import type { PropsWithChildren } from "react";

import { toastPositionerCSS } from "@phoenix/components/core/toast/styles";

/**
 * Wraps a single toast and owns its position within the stack.
 *
 * @param stackIndex Position of the toast in the visible stack (0 = front / newest).
 */
export function ToastPositioner({
  stackIndex,
  children,
}: PropsWithChildren<{ stackIndex: number }>) {
  return (
    <div
      className="toast-positioner"
      css={toastPositionerCSS}
      style={{
        // @ts-expect-error custom css property
        "--toast-index": stackIndex,
        zIndex: 100 - stackIndex,
      }}
    >
      {children}
    </div>
  );
}
