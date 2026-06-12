import { css } from "@emotion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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
 * A wrapper for code mirror editors that lazily initializes the editor when it is scrolled into view.
 * This is necessary in some cases where a code mirror editor is rendered outside of the viewport.
 * In those cases, the editor may not be initialized properly and may be invisible or cut off when it is scrolled into view.
 * @param preInitializationMinHeight The minimum height of the container for the JSON editor prior to initialization.
 */
export function LazyEditorWrapper({
  preInitializationMinHeight,
  children,
  ...rest
}: LazyEditorWrapperProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /**
   * Code mirror needs to calculate its dimensions to initialize properly. When rendered
   * outside the viewport, dimensions may not be calculated correctly, leaving the editor
   * invisible or cut off when scrolled into view. We latch `isInitialized` to true the
   * first time the wrapper intersects and never revert it.
   * For a related issue @see https://github.com/codemirror/dev/issues/1076
   */
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInitialized(true);
      }
    });

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }
    const current = wrapperRef.current;

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, []);

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
      {children}
    </div>
  );
}
