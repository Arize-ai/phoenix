import { css } from "@emotion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { useDeferredVisibility } from "@phoenix/hooks/useDeferredVisibility";

type LazyEditorWrapperProps = {
  /**
   * The minimum height of the container for the JSON editor prior to initialization.
   * After initialization, the height will be set to auto and grow to fit the editor.
   * This allows for the editor to properly get its dimensions when it is rendered outside of the viewport.
   */
  preInitializationMinHeight: number;
  children: ReactNode;
} & ComponentPropsWithoutRef<"div">;

/**
 * A wrapper for code mirror editors that holds a minimum height until the
 * editor is scrolled into view. This is necessary in some cases where a code
 * mirror editor is rendered outside of the viewport: the editor may not
 * calculate its dimensions correctly and be invisible or cut off when it is
 * scrolled into view. Holding a minimum height until first visibility lets it
 * initialize with real dimensions.
 * For a related issue @see https://github.com/codemirror/dev/issues/1076
 * @param preInitializationMinHeight The minimum height of the container for the JSON editor prior to initialization.
 */
export function LazyEditorWrapper({
  preInitializationMinHeight,
  children,
  ...rest
}: LazyEditorWrapperProps) {
  // once: only the first reveal matters here, so observation stops after it
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
