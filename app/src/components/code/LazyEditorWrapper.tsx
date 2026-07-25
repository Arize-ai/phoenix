import { css } from "@emotion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

type LazyEditorWrapperProps = {
  /**
   * The minimum height of the container for the JSON editor prior to initialization.
   * After initialization, the height will be set to auto and grow to fit the editor.
   * This allows for the editor to properly get its dimensions when it is rendered outside of the viewport.
   */
  preInitializationMinHeight: number;
  /** Lightweight content to show before the editor enters the viewport. */
  fallback?: ReactNode;
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
  children,
  ...rest
}: LazyEditorWrapperProps) {
  const [isInitialized, setIsInitialized] = useState(
    () => typeof IntersectionObserver === "undefined"
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
      { rootMargin: "200px 0px" }
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
