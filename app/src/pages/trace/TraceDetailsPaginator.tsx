import { css } from "@emotion/react";
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

  useHotkeys(NEXT_TRACE_HOTKEY, () => {
    if (pagination) {
      pagination.next(currentId);
    }
  });

  useHotkeys(PREVIOUS_TRACE_HOTKEY, () => {
    if (pagination) {
      pagination.previous(currentId);
    }
  });

  if (!pagination || !pagination.traceSequence.length) {
    return null;
  }

  const { previous, next, traceSequence } = pagination;
  const { nextTraceId, previousTraceId } = getNeighbors(
    traceSequence,
    currentId
  );
  const hasPrevious = !!previousTraceId;
  const hasNext = !!nextTraceId;
  const nextButton = (
    <TooltipTrigger key="next" delay={100}>
      <Button
        size="S"
        variant="quiet"
        id="next"
        leadingVisual={<Icon svg={<Icons.ArrowDown />} />}
        aria-label="Next trace"
        isDisabled={!hasNext}
        onPress={() => {
          next(currentId);
        }}
      />
      <Tooltip placement={isCollapsed ? "left" : undefined} offset={4}>
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
        size="S"
        variant="quiet"
        id="previous"
        leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
        aria-label="Previous trace"
        isDisabled={!hasPrevious}
        onPress={() => {
          previous(currentId);
        }}
      />
      <Tooltip placement={isCollapsed ? "left" : undefined} offset={4}>
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
      css={css`
        button {
          // either the icons or the trigger wrap are making the buttons slightly too small
          // so just spot adjust the min height here
          min-height: 31px;
        }
      `}
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
