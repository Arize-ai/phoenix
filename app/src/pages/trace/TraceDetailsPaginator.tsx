import { startTransition } from "react";
import { Tooltip, TooltipTrigger } from "react-aria-components";
import { useHotkeys } from "react-hotkeys-hook";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  KeyboardToken,
  View,
} from "@phoenix/components";
import {
  getNeighbors,
  useTracePagination,
} from "@phoenix/pages/trace/TracePaginationContext";

export const NEXT_TRACE_HOTKEY = "j";
export const PREVIOUS_TRACE_HOTKEY = "k";

export const TraceDetailsPaginator = ({
  currentId,
}: {
  currentId?: string;
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

  return (
    <Flex
      gap="size-50"
      css={css`
        button {
          // either the icons or the trigger wrap are making the buttons slightly too small
          // so just spot adjust the min height here
          min-height: 31px;
        }
      `}
    >
      <Flex direction="row" gap="size-50" alignItems="center">
        <TooltipTrigger delay={100}>
          <Button
            size="S"
            id="next"
            leadingVisual={<Icon svg={<Icons.ArrowDownwardOutline />} />}
            aria-label="Next trace"
            isDisabled={!hasNext}
            onPress={() => {
              startTransition(() => {
                next(currentId);
              });
            }}
          />
          <Tooltip offset={4}>
            <View
              backgroundColor="dark"
              borderWidth="thin"
              borderColor="dark"
              borderRadius="medium"
              padding="size-100"
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <span>Next trace</span>
                <KeyboardToken>{NEXT_TRACE_HOTKEY}</KeyboardToken>
              </Flex>
            </View>
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={100}>
          <Button
            size="S"
            id="previous"
            leadingVisual={<Icon svg={<Icons.ArrowUpwardOutline />} />}
            aria-label="Previous trace"
            isDisabled={!hasPrevious}
            onPress={() => {
              startTransition(() => {
                previous(currentId);
              });
            }}
          />
          <Tooltip offset={4}>
            <View
              backgroundColor="dark"
              borderWidth="thin"
              borderColor="dark"
              borderRadius="medium"
              padding="size-100"
            >
              <Flex direction="row" gap="size-100" alignItems="center">
                <span>Previous trace</span>
                <KeyboardToken>{PREVIOUS_TRACE_HOTKEY}</KeyboardToken>
              </Flex>
            </View>
          </Tooltip>
        </TooltipTrigger>
      </Flex>
    </Flex>
  );
};
