import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { startTransition, Suspense, useEffect, useRef, useState } from "react";

import { SpanDetails } from "./SpanDetails";
import { SpanDetailsSkeleton } from "./TraceDetailsSkeleton";

const MAX_CACHED_SPAN_DETAILS = 2;

type CachedSpanDetails = {
  content: ReactNode;
  spanNodeId: string;
};

function createCachedSpanDetails(spanNodeId: string): CachedSpanDetails {
  return {
    content: (
      <Suspense fallback={<SpanDetailsSkeleton />}>
        <SpanDetails key={spanNodeId} spanNodeId={spanNodeId} />
      </Suspense>
    ),
    spanNodeId,
  };
}

/**
 * Commits the new tree selection and a dehydrated details shell, allows the
 * browser to paint them, and only then renders the selected span. Without this
 * gate, a Relay cache hit renders large cached LLM content synchronously and
 * delays the selection paint.
 */
export function SpanDetailsPaintGate({ spanNodeId }: { spanNodeId: string }) {
  const [cachedSpanDetails, setCachedSpanDetails] = useState<
    CachedSpanDetails[]
  >([]);
  const recentlyViewedSpanNodeIdsRef = useRef<string[]>([]);
  const isTargetCached = cachedSpanDetails.some(
    (cachedDetails) => cachedDetails.spanNodeId === spanNodeId
  );

  useEffect(() => {
    const markSpanAsRecentlyViewed = () => {
      recentlyViewedSpanNodeIdsRef.current = [
        spanNodeId,
        ...recentlyViewedSpanNodeIdsRef.current.filter(
          (cachedSpanNodeId) => cachedSpanNodeId !== spanNodeId
        ),
      ].slice(0, MAX_CACHED_SPAN_DETAILS);
    };

    if (isTargetCached) {
      markSpanAsRecentlyViewed();
      return undefined;
    }

    let hydrationFrameId: number | null = null;
    const paintFrameId = requestAnimationFrame(() => {
      hydrationFrameId = requestAnimationFrame(() => {
        startTransition(() => {
          setCachedSpanDetails((currentCache) => {
            const cachedSpanNodeIds = new Set(
              currentCache.map((cachedDetails) => cachedDetails.spanNodeId)
            );
            if (cachedSpanNodeIds.has(spanNodeId)) return currentCache;

            const nextCache = [...currentCache];
            if (nextCache.length >= MAX_CACHED_SPAN_DETAILS) {
              const spanNodeIdToEvict =
                recentlyViewedSpanNodeIdsRef.current.at(-1) ??
                nextCache[0]?.spanNodeId;
              const evictionIndex = nextCache.findIndex(
                (cachedDetails) =>
                  cachedDetails.spanNodeId === spanNodeIdToEvict
              );
              if (evictionIndex >= 0) nextCache.splice(evictionIndex, 1);
            }
            nextCache.push(createCachedSpanDetails(spanNodeId));
            return nextCache;
          });
          markSpanAsRecentlyViewed();
        });
      });
    });

    return () => {
      cancelAnimationFrame(paintFrameId);
      if (hydrationFrameId != null) {
        cancelAnimationFrame(hydrationFrameId);
      }
    };
  }, [isTargetCached, spanNodeId]);

  const isHydrationPending = !isTargetCached;

  return (
    <div
      data-span-details-state={isHydrationPending ? "dehydrated" : "hydrating"}
      data-span-details-target-id={spanNodeId}
      css={css`
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      <div
        data-span-details-skeleton
        hidden={!isHydrationPending}
        css={css`
          width: 100%;
          height: 100%;
        `}
      >
        <SpanDetailsSkeleton />
      </div>
      {cachedSpanDetails.map((cachedDetails) => (
        <div
          key={cachedDetails.spanNodeId}
          data-span-details-retained-id={cachedDetails.spanNodeId}
          hidden={isHydrationPending || cachedDetails.spanNodeId !== spanNodeId}
          css={css`
            width: 100%;
            height: 100%;
          `}
        >
          {cachedDetails.content}
        </div>
      ))}
    </div>
  );
}
