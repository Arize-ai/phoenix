import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { css } from "@emotion/react";

/**
 * A wrapper for code mirror editors that lazily initializes the editor when it is scrolled into view.
 * This is necessary in some cases where a code mirror editor is rendered outside of the viewport.
 * In those cases, the editor may not be initialized properly and may be invisible or cut off when it is scrolled into view.
 * @param preInitializationMinHeight The minimum height of the container for the JSON editor prior to initialization.
 */
export function LazyEditorWrapper({
  preInitializationMinHeight,
  children,
}: {
  /**
   * The minimum height of the container for the JSON editor prior to initialization.
   * After initialization, the height will be set to auto and grow to fit the editor.
   * This allows for the editor to properly get its dimensions when it is rendered outside of the viewport.
   */
  preInitializationMinHeight: number;
  children: ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /**
   * The two useEffect hooks below are used to initialize the JSON editor.
   * This is necessary because code mirror needs to calculate its dimensions to initialize properly.
   * When it is rendered outside of the viewport, the dimensions may not always be calculated correctly,
   * resulting in the editor being invisible or cut off when it is scrolled into view.
   * Below we use a combination of an intersection observer and a delay to ensure that the editor is initialized correctly.
   * For a related issue @see https://github.com/codemirror/dev/issues/1076
   */
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
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

  useLayoutEffect(() => {
    if (isVisible && !isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized, isVisible]);

  return (
    <div
      ref={wrapperRef}
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
