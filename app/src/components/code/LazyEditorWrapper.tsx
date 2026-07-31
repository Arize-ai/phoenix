import { css } from "@emotion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

// Begin mounting editors well before they become visible. This keeps the
// lightweight fallback for distant content without letting syntax highlighting
// visibly snap into place during ordinary scrolling.
const EDITOR_PRELOAD_MARGIN = "1200px 0px";

type LazyEditorWrapperProps = {
  /**
   * The minimum height of the container for the JSON editor prior to initialization.
   * After initialization, the height will be set to auto and grow to fit the editor.
   * This allows for the editor to properly get its dimensions when it is rendered outside of the viewport.
   */
  preInitializationMinHeight: number;
  /** Lightweight content to show before the editor enters the viewport. */
  fallback?: ReactNode;
  /** Mounts the editor on the initial render instead of waiting for visibility. */
  initializeImmediately?: boolean;
  children: ReactNode;
} & ComponentPropsWithoutRef<"div">;

/**
 * A wrapper for code mirror editors that lazily initializes the editor when it is scrolled into view.
 * This is necessary in some cases where a code mirror editor is rendered outside of the viewport.
 * In those cases, the editor may not be initialized properly and may be invisible or cut off when it is scrolled into view.
 * @param preInitializationMinHeight The minimum height of the container for the JSON editor prior to initialization.
 */
export function LazyEditorWrapper({
  preInitializationMinHeight,
  fallback = null,
  initializeImmediately = false,
  children,
  ...rest
}: LazyEditorWrapperProps) {
  const [isInitialized, setIsInitialized] = useState(
    () => initializeImmediately || typeof IntersectionObserver === "undefined"
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isInitialized) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }
        observer.disconnect();
        startTransition(() => setIsInitialized(true));
      },
      {
        rootMargin: EDITOR_PRELOAD_MARGIN,
        // Span details and similar surfaces scroll inside nested containers.
        // Expand those scrollports too, otherwise their clipping can defeat
        // the viewport root margin and delay initialization until visibility.
        scrollMargin: EDITOR_PRELOAD_MARGIN,
      }
    );

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => observer.disconnect();
  }, [isInitialized]);

  return (
    <div
      ref={wrapperRef}
      {...rest}
      css={css`
        min-height: ${!isInitialized
          ? `${preInitializationMinHeight}px`
          : "auto"};
      `}
    >
      {isInitialized ? children : fallback}
    </div>
  );
}
