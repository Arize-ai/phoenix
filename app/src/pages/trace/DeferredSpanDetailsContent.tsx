import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

/**
 * Reserves space for an offscreen span detail region and mounts its contents
 * as non-urgent work once the region enters the viewport.
 */
export function DeferredSpanDetailsContent({
  children,
  fallback = null,
  observeAfterFallback = false,
  placeholderHeight,
}: PropsWithChildren<{
  fallback?: ReactNode;
  /** Observe the point after the fallback rather than the wrapper's top edge. */
  observeAfterFallback?: boolean;
  placeholderHeight: number;
}>) {
  const [hasEnteredViewport, setHasEnteredViewport] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  const observationTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasEnteredViewport) {
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) {
        return;
      }
      observer.disconnect();
      startTransition(() => setHasEnteredViewport(true));
    });

    if (observationTargetRef.current) {
      observer.observe(observationTargetRef.current);
    }

    return () => observer.disconnect();
  }, [hasEnteredViewport]);

  return (
    <div
      ref={observeAfterFallback ? undefined : observationTargetRef}
      data-deferred-content={hasEnteredViewport ? "mounted" : "pending"}
      css={css`
        min-height: ${hasEnteredViewport ? 0 : placeholderHeight}px;
        content-visibility: auto;
        contain-intrinsic-size: auto ${placeholderHeight}px;
      `}
    >
      {hasEnteredViewport ? (
        children
      ) : (
        <>
          {fallback}
          {observeAfterFallback ? (
            <div
              ref={observationTargetRef}
              aria-hidden="true"
              data-deferred-observation-target
              css={css`
                height: 1px;
                pointer-events: none;
              `}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
