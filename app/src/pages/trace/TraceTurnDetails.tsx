import { css } from "@emotion/react";
import { useReducedMotion } from "motion/react";
import { Suspense, useEffect, useEffectEvent, useRef } from "react";

import { Flex, View } from "@phoenix/components";
import { TraceDetailPanelAnnotationBar } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import type { TraceTurnContent_rootSpan$key } from "@phoenix/pages/trace/__generated__/TraceTurnContent_rootSpan.graphql";

import { SpanDetailsPaintGate } from "./SpanDetailsPaintGate";
import {
  TraceDetailsHeader,
  TraceDetailsHeaderSkeleton,
} from "./TraceDetailsHeader";
import {
  DetailPanelAnnotationBarSkeleton,
  DetailPanelBodySkeleton,
} from "./TraceDetailsSkeleton";
import { TraceTurnContent, type RootSpanMessageRole } from "./TraceTurnContent";

type TraceTurnRootSpan = TraceTurnContent_rootSpan$key & {
  readonly id: string;
  readonly cumulativeTokenCountTotal: number | null;
  readonly latencyMs: number | null;
  readonly startTime: string;
  readonly trace: {
    readonly costSummary: {
      readonly total: {
        readonly cost: number | null;
      };
    };
  };
};

const ROOT_SPAN_ALIGNMENT_TOLERANCE_PIXELS = 1;
const ROOT_SPAN_REVERSE_PULL_MAX_PIXELS = 20;
const ROOT_SPAN_REVERSE_PULL_DETENT_RESISTANCE = 0.2;
const ROOT_SPAN_REVERSE_PULL_VISUAL_RESISTANCE = 0.1;
const ROOT_SPAN_REVERSE_PULL_THRESHOLD_PIXELS = 120;
const ROOT_SPAN_REVERSE_PULL_EVENT_CAP_PIXELS = 60;
const ROOT_SPAN_REVERSE_PULL_MINIMUM_EVENTS = 3;
const ROOT_SPAN_REVERSE_PULL_DETENT_MILLISECONDS = 120;
const ROOT_SPAN_REVERSE_PULL_IDLE_MILLISECONDS = 220;
const ROOT_SPAN_REVERSE_PULL_CONTINUATION_RATIO = 0.65;
const ROOT_SPAN_REVERSE_PULL_MINIMUM_CONTINUATION_PIXELS = 8;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_LINE_HEIGHT_PIXELS = 16;

function getWheelDeltaPixels({
  event,
  pageHeight,
}: {
  event: WheelEvent;
  pageHeight: number;
}) {
  if (event.deltaMode === WHEEL_DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_LINE_HEIGHT_PIXELS;
  }
  if (event.deltaMode === WHEEL_DELTA_MODE_PAGE) {
    return event.deltaY * pageHeight;
  }
  return event.deltaY;
}

function hasScrollableAncestorWithUpwardRange({
  boundary,
  target,
}: {
  boundary: HTMLElement;
  target: EventTarget | null;
}) {
  if (!(target instanceof Element) || !boundary.contains(target)) {
    return false;
  }
  let currentElement: Element | null = target;
  while (currentElement != null) {
    if (
      currentElement instanceof HTMLElement &&
      currentElement.scrollTop > ROOT_SPAN_ALIGNMENT_TOLERANCE_PIXELS &&
      currentElement.scrollHeight > currentElement.clientHeight
    ) {
      const overflowY = getComputedStyle(currentElement).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        return true;
      }
    }
    if (currentElement === boundary) {
      return false;
    }
    currentElement = currentElement.parentElement;
  }
  return false;
}

const traceRootSpanDetailsCSS = css`
  width: 100%;
  height: 100%;
  overflow: hidden;

  &[data-trace-selected="true"] {
    overflow-y: auto;
  }

  .trace-root-span-details__root-span {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 100%;
  }

  .trace-root-span-details__root-span:not(:first-of-type) {
    border-top-width: var(--global-border-size-thin);
    border-top-style: solid;
    border-top-color: var(--global-border-color-default);
  }

  .trace-root-span-details__root-span[data-preview="true"] {
    pointer-events: none;

    [data-span-details-sections] {
      overflow: hidden;
    }
  }
`;

/**
 * Joins the trace turn to its root-span details so scrolling through the trace
 * becomes root-span selection without replacing the already-rendered span.
 */
export function TraceTurnDetails({
  isTraceSelected = true,
  onRootSpanDetailsReady,
  onRootSpanMessageDoubleClick,
  onRootSpanSelect,
  onTraceSelect,
  rootSpan,
  traceId,
  traceNodeId,
}: {
  isTraceSelected?: boolean;
  onRootSpanDetailsReady?: (spanNodeId: string) => void;
  onRootSpanMessageDoubleClick?: (role: RootSpanMessageRole) => void;
  onRootSpanSelect?: () => void;
  onTraceSelect?: () => void;
  rootSpan: TraceTurnRootSpan;
  traceId: string;
  traceNodeId: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rootSpanDetailsRef = useRef<HTMLDivElement>(null);
  const isRootSpanSelectionPendingRef = useRef(false);
  const isTraceSelectionPendingRef = useRef(false);
  const reversePullDistanceRef = useRef(0);
  const reversePullEventCountRef = useRef(0);
  const reversePullPeakDeltaRef = useRef(0);
  const reversePullDetentReachedAtRef = useRef<number | null>(null);
  const reversePullResetTimerRef = useRef<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const resetReversePull = useEffectEvent(() => {
    reversePullDistanceRef.current = 0;
    reversePullEventCountRef.current = 0;
    reversePullPeakDeltaRef.current = 0;
    reversePullDetentReachedAtRef.current = null;
    if (reversePullResetTimerRef.current != null) {
      window.clearTimeout(reversePullResetTimerRef.current);
      reversePullResetTimerRef.current = null;
    }
    rootSpanDetailsRef.current?.style.removeProperty("transform");
  });

  const handleWheel = useEffectEvent((event: WheelEvent) => {
    if (
      isTraceSelected ||
      isTraceSelectionPendingRef.current ||
      onTraceSelect == null
    ) {
      return;
    }
    const scrollContainer = scrollContainerRef.current;
    const rootSpanDetails = rootSpanDetailsRef.current;
    const spanDetailsSections = rootSpanDetails?.querySelector<HTMLElement>(
      "[data-span-details-sections]"
    );
    if (
      scrollContainer == null ||
      rootSpanDetails == null ||
      spanDetailsSections == null
    ) {
      return;
    }
    const deltaPixels = getWheelDeltaPixels({
      event,
      pageHeight: scrollContainer.clientHeight,
    });
    const hasUpwardScrollRange =
      spanDetailsSections.scrollTop > ROOT_SPAN_ALIGNMENT_TOLERANCE_PIXELS ||
      hasScrollableAncestorWithUpwardRange({
        boundary: spanDetailsSections,
        target: event.target,
      });
    if (deltaPixels >= 0 || hasUpwardScrollRange) {
      resetReversePull();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const upwardDeltaPixels = Math.abs(deltaPixels);
    const cappedDeltaPixels = Math.min(
      upwardDeltaPixels,
      ROOT_SPAN_REVERSE_PULL_EVENT_CAP_PIXELS
    );
    reversePullDistanceRef.current += cappedDeltaPixels;
    reversePullEventCountRef.current += 1;
    reversePullPeakDeltaRef.current = Math.max(
      reversePullPeakDeltaRef.current,
      cappedDeltaPixels
    );
    const detentPullDistance = Math.min(
      reversePullDistanceRef.current * ROOT_SPAN_REVERSE_PULL_DETENT_RESISTANCE,
      ROOT_SPAN_REVERSE_PULL_MAX_PIXELS
    );
    const visualPullRatio =
      (reversePullDistanceRef.current *
        ROOT_SPAN_REVERSE_PULL_VISUAL_RESISTANCE) /
      ROOT_SPAN_REVERSE_PULL_MAX_PIXELS;
    const resistedDistance = Number(
      (
        ROOT_SPAN_REVERSE_PULL_MAX_PIXELS *
        (1 - 1 / (visualPullRatio + 1))
      ).toFixed(2)
    );
    rootSpanDetails.style.transform = shouldReduceMotion
      ? ""
      : `translateY(${resistedDistance}px)`;

    if (
      detentPullDistance === ROOT_SPAN_REVERSE_PULL_MAX_PIXELS &&
      reversePullDetentReachedAtRef.current == null
    ) {
      reversePullDetentReachedAtRef.current = Date.now();
    }

    if (reversePullResetTimerRef.current != null) {
      window.clearTimeout(reversePullResetTimerRef.current);
    }
    reversePullResetTimerRef.current = window.setTimeout(
      resetReversePull,
      ROOT_SPAN_REVERSE_PULL_IDLE_MILLISECONDS
    );

    const detentReachedAt = reversePullDetentReachedAtRef.current;
    const hasReachedTransitionDistance =
      reversePullDistanceRef.current >= ROOT_SPAN_REVERSE_PULL_THRESHOLD_PIXELS;
    const hasEnoughGestureSamples =
      reversePullEventCountRef.current >= ROOT_SPAN_REVERSE_PULL_MINIMUM_EVENTS;
    const hasWaitedAtDetent =
      detentReachedAt != null &&
      Date.now() - detentReachedAt >=
        ROOT_SPAN_REVERSE_PULL_DETENT_MILLISECONDS;
    const minimumContinuationDelta = Math.max(
      ROOT_SPAN_REVERSE_PULL_MINIMUM_CONTINUATION_PIXELS,
      reversePullPeakDeltaRef.current *
        ROOT_SPAN_REVERSE_PULL_CONTINUATION_RATIO
    );
    const hasContinuedForce = cappedDeltaPixels >= minimumContinuationDelta;
    if (
      !hasReachedTransitionDistance ||
      !hasEnoughGestureSamples ||
      !hasWaitedAtDetent ||
      !hasContinuedForce
    ) {
      return;
    }
    isTraceSelectionPendingRef.current = true;
    resetReversePull();
    onTraceSelect();
  });

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const rootSpanDetails = rootSpanDetailsRef.current;
    if (scrollContainer == null) return undefined;
    scrollContainer.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      scrollContainer.removeEventListener("wheel", handleWheel);
      resetReversePull();
      rootSpanDetails?.style.removeProperty("transform");
    };
  }, []);

  useEffect(() => {
    if (isTraceSelected) {
      isRootSpanSelectionPendingRef.current = false;
    } else {
      isTraceSelectionPendingRef.current = false;
    }
    resetReversePull();
  }, [isTraceSelected]);

  const handleScroll = () => {
    if (
      !isTraceSelected ||
      isRootSpanSelectionPendingRef.current ||
      onRootSpanSelect == null
    ) {
      return;
    }
    const scrollContainer = scrollContainerRef.current;
    const rootSpanDetails = rootSpanDetailsRef.current;
    if (scrollContainer == null || rootSpanDetails == null) {
      return;
    }
    const distanceFromTop =
      rootSpanDetails.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top;
    if (distanceFromTop > ROOT_SPAN_ALIGNMENT_TOLERANCE_PIXELS) {
      return;
    }
    isRootSpanSelectionPendingRef.current = true;
    onRootSpanSelect();
  };

  return (
    <div
      ref={scrollContainerRef}
      className="trace-root-span-details"
      css={traceRootSpanDetailsCSS}
      data-trace-selected={isTraceSelected}
      data-trace-root-span-scroll-container
      onScroll={handleScroll}
    >
      {isTraceSelected ? (
        <>
          <TraceDetailsHeader
            annotationBar={
              <Suspense
                fallback={
                  <DetailPanelAnnotationBarSkeleton variant="detail-header" />
                }
              >
                <TraceDetailPanelAnnotationBar traceNodeId={traceNodeId} />
              </Suspense>
            }
            trace={{
              id: traceNodeId,
              traceId,
              latencyMs: rootSpan.latencyMs,
              startTime: rootSpan.startTime,
              tokenCountTotal: rootSpan.cumulativeTokenCountTotal,
              totalCost: rootSpan.trace.costSummary.total.cost,
            }}
          />
          <View padding="var(--global-grid-margin-xsmall)">
            <TraceTurnContent
              onMessageDoubleClick={onRootSpanMessageDoubleClick}
              rootSpan={rootSpan}
            />
          </View>
        </>
      ) : null}
      <div
        key="root-span-details"
        ref={rootSpanDetailsRef}
        className="trace-root-span-details__root-span"
        aria-hidden={isTraceSelected || undefined}
        data-preview={isTraceSelected}
        inert={isTraceSelected || undefined}
      >
        <SpanDetailsPaintGate
          isHotkeyEnabled={!isTraceSelected}
          onSpanDetailsReady={onRootSpanDetailsReady}
          spanNodeId={rootSpan.id}
        />
      </div>
    </div>
  );
}

export function TraceTurnDetailsSkeleton() {
  return (
    <Flex direction="column" height="100%" aria-busy="true">
      <TraceDetailsHeaderSkeleton
        annotationBar={
          <DetailPanelAnnotationBarSkeleton variant="detail-header" />
        }
      />
      <DetailPanelBodySkeleton />
    </Flex>
  );
}
