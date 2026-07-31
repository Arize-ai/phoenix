import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Button,
  Flex,
  Icon,
  Icons,
  KeyboardToken,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { beginOptimisticTraceNavigation } from "@phoenix/components/trace/spanDetailsNavigation";
import {
  getNeighbors,
  useTracePagination,
} from "@phoenix/pages/trace/TracePaginationContext";
import { classNames } from "@phoenix/utils/classNames";

export const NEXT_TRACE_HOTKEY = "j";
export const PREVIOUS_TRACE_HOTKEY = "k";

export const TraceDetailsPaginator = ({
  currentId,
  className,
  isCollapsed,
}: {
  currentId?: string;
  className?: string;
  isCollapsed: boolean;
}) => {
  const pagination = useTracePagination();
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const previousButtonRef = useRef<HTMLButtonElement>(null);

  const beginNextNavigation = (navigationRoot: Element) => {
    if (!pagination) return;
    const { nextTraceId, nextSpanId } = getNeighbors(
      pagination.traceSequence,
      currentId
    );
    if (!nextTraceId || !nextSpanId) return;

    beginOptimisticTraceNavigation({
      navigationRoot,
      onNavigate: () => pagination.next(currentId),
      spanNodeId: nextSpanId,
      traceId: nextTraceId,
    });
  };

  const beginPreviousNavigation = (navigationRoot: Element) => {
    if (!pagination) return;
    const { previousTraceId, previousSpanId } = getNeighbors(
      pagination.traceSequence,
      currentId
    );
    if (!previousTraceId || !previousSpanId) return;

    beginOptimisticTraceNavigation({
      navigationRoot,
      onNavigate: () => pagination.previous(currentId),
      spanNodeId: previousSpanId,
      traceId: previousTraceId,
    });
  };

  useHotkeys(NEXT_TRACE_HOTKEY, () => {
    beginNextNavigation(nextButtonRef.current ?? document.body);
  });

  useHotkeys(PREVIOUS_TRACE_HOTKEY, () => {
    beginPreviousNavigation(previousButtonRef.current ?? document.body);
  });

  if (!pagination || !pagination.traceSequence.length) {
    return null;
  }

  const { traceSequence } = pagination;
  const { nextTraceId, previousTraceId } = getNeighbors(
    traceSequence,
    currentId
  );
  const hasPrevious = !!previousTraceId;
  const hasNext = !!nextTraceId;
  const nextButton = (
    <TooltipTrigger key="next" delay={100}>
      <Button
        ref={nextButtonRef}
        size="S"
        variant="quiet"
        id="next"
        leadingVisual={<Icon svg={<Icons.ArrowDown />} />}
        aria-label="Next trace"
        isDisabled={!hasNext}
        onPress={(event) => beginNextNavigation(event.target)}
      />
      <Tooltip placement={isCollapsed ? "right" : undefined} offset={4}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <span>Next trace</span>
          <KeyboardToken>{NEXT_TRACE_HOTKEY}</KeyboardToken>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );
  const previousButton = (
    <TooltipTrigger key="previous" delay={100}>
      <Button
        ref={previousButtonRef}
        size="S"
        variant="quiet"
        id="previous"
        leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
        aria-label="Previous trace"
        isDisabled={!hasPrevious}
        onPress={(event) => beginPreviousNavigation(event.target)}
      />
      <Tooltip placement={isCollapsed ? "right" : undefined} offset={4}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <span>Previous trace</span>
          <KeyboardToken>{PREVIOUS_TRACE_HOTKEY}</KeyboardToken>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );

  return (
    <Flex
      className={classNames("trace-details-paginator", className)}
      gap="size-50"
    >
      <Flex
        className="trace-details-paginator__buttons"
        gap="size-50"
        alignItems="center"
      >
        {isCollapsed ? (
          <>
            {previousButton}
            {nextButton}
          </>
        ) : (
          <>
            {nextButton}
            {previousButton}
          </>
        )}
      </Flex>
    </Flex>
  );
};
