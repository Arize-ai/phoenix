import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
import { SPAN_DETAILS_CONDENSED_WIDTH_PIXELS } from "@phoenix/constants";
import { useDimensions } from "@phoenix/hooks";

import { SpanDetails } from "./SpanDetails";
import { SpanDetailsSkeleton } from "./TraceDetailsSkeleton";

const MAX_CACHED_SPAN_DETAILS = 2;

type CachedSpanDetails = {
  content: ReactNode;
  spanNodeId: string;
};

function createCachedSpanDetails({
  spanNodeId,
  spanPreview,
  initialIsCondensedView,
}: {
  spanNodeId: string;
  spanPreview?: SpanDetailsPreview;
  initialIsCondensedView: boolean;
}): CachedSpanDetails {
  return {
    content: (
      <Suspense
        fallback={
          <SpanDetailsSkeleton
            spanPreview={spanPreview}
            isCondensedView={initialIsCondensedView}
          />
        }
      >
        <SpanDetails
          key={spanNodeId}
          spanNodeId={spanNodeId}
          spanPreview={spanPreview}
          initialIsCondensedView={initialIsCondensedView}
        />
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
export function SpanDetailsPaintGate({
  spanNodeId,
  spanPreview,
  onSpanDetailsReady,
}: {
  spanNodeId: string;
  spanPreview?: SpanDetailsPreview;
  onSpanDetailsReady?: (spanNodeId: string) => void;
}) {
  const [cachedSpanDetails, setCachedSpanDetails] = useState<
    CachedSpanDetails[]
  >([]);
  const gateRef = useRef<HTMLDivElement>(null);
  const gateDimensions = useDimensions(gateRef);
  const onSpanDetailsReadyRef = useRef(onSpanDetailsReady);
  onSpanDetailsReadyRef.current = onSpanDetailsReady;
  const recentlyViewedSpanNodeIdsRef = useRef<string[]>([]);
  const isTargetCached = cachedSpanDetails.some(
    (cachedDetails) => cachedDetails.spanNodeId === spanNodeId
  );
  const isCondensedView = gateDimensions?.width
    ? gateDimensions.width < SPAN_DETAILS_CONDENSED_WIDTH_PIXELS
    : true;

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
              (cachedDetails) => cachedDetails.spanNodeId === spanNodeIdToEvict
            );
            if (evictionIndex >= 0) nextCache.splice(evictionIndex, 1);
          }
          nextCache.push(
            createCachedSpanDetails({
              spanNodeId,
              spanPreview,
              initialIsCondensedView: isCondensedView,
            })
          );
          return nextCache;
        });
        markSpanAsRecentlyViewed();
      });
    });

    return () => {
      cancelAnimationFrame(paintFrameId);
      if (hydrationFrameId != null) {
        cancelAnimationFrame(hydrationFrameId);
      }
    };
  }, [isCondensedView, isTargetCached, spanNodeId, spanPreview]);

  useLayoutEffect(() => {
    const gate = gateRef.current;
    if (!gate || !onSpanDetailsReadyRef.current) return undefined;

    let firstPaintFrameId: number | null = null;
    let secondPaintFrameId: number | null = null;
    let hasReportedReady = false;
    const reportWhenReady = () => {
      if (hasReportedReady) return;
      const escapedSpanNodeId = CSS.escape(spanNodeId);
      const visibleDetailsBody = gate.querySelector(
        `[data-span-details-retained-id="${escapedSpanNodeId}"]:not([hidden]) [data-span-details-body-id="${escapedSpanNodeId}"]`
      );
      if (!visibleDetailsBody) return;

      const deferredMessages = visibleDetailsBody.querySelectorAll(
        "[data-llm-message-state]"
      );
      if (
        deferredMessages.length > 0 &&
        !visibleDetailsBody.querySelector('[data-llm-message-state="mounted"]')
      ) {
        return;
      }

      hasReportedReady = true;
      firstPaintFrameId = requestAnimationFrame(() => {
        secondPaintFrameId = requestAnimationFrame(() => {
          onSpanDetailsReadyRef.current?.(spanNodeId);
        });
      });
    };

    const observer = new MutationObserver(reportWhenReady);
    observer.observe(gate, {
      attributeFilter: ["data-llm-message-state", "hidden"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    reportWhenReady();

    return () => {
      observer.disconnect();
      if (firstPaintFrameId != null) cancelAnimationFrame(firstPaintFrameId);
      if (secondPaintFrameId != null) cancelAnimationFrame(secondPaintFrameId);
    };
  }, [spanNodeId]);

  const isHydrationPending = !isTargetCached;

  return (
    <div
      ref={gateRef}
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
        <SpanDetailsSkeleton
          spanPreview={spanPreview?.id === spanNodeId ? spanPreview : undefined}
          isCondensedView={isCondensedView}
        />
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
