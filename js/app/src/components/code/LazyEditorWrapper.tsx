import { css } from "@emotion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { useDeferredVisibility } from "@phoenix/hooks/useDeferredVisibility";

type LazyEditorWrapperProps = {
  /**
   * Minimum container height before the editor initializes; afterwards the
   * height grows to fit the editor.
   */
  preInitializationMinHeight: number;
  children: ReactNode;
} & ComponentPropsWithoutRef<"div">;

/**
 * Holds a minimum height for a CodeMirror editor until it first scrolls into
 * view. Editors rendered offscreen can miscalculate their dimensions and
 * render invisible or cut off; deferring to first visibility lets them
 * initialize with real dimensions.
 * @see https://github.com/codemirror/dev/issues/1076
 */
export function LazyEditorWrapper({
  preInitializationMinHeight,
  children,
  ...rest
}: LazyEditorWrapperProps) {
  const { ref, hasBeenVisible: isInitialized } =
    useDeferredVisibility<HTMLDivElement>({ once: true });

  return (
    <div
      ref={ref}
      {...rest}
      css={css`
        min-height: ${!isInitialized
          ? `${preInitializationMinHeight}px`
          : "auto"};
      `}
    >
      {children}
    </div>
  );
}
