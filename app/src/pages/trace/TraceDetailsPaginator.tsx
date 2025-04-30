import React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { css } from "@emotion/react";

import { Tooltip, TooltipTrigger, TriggerWrap } from "@arizeai/components";

import { Button, Flex, Icon, Icons, Keyboard } from "@phoenix/components";
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
      <TooltipTrigger>
        <TriggerWrap>
          <Button
            size="S"
            onPress={() => next(currentId)}
            isDisabled={!hasNext}
          >
            <Icon svg={<Icons.ArrowIosDownwardOutline />} />
          </Button>
        </TriggerWrap>
        <Tooltip>
          <Flex direction="row" gap="size-100" alignItems="center">
            <span>Next trace</span>
            <Keyboard variant="primary">{NEXT_TRACE_HOTKEY}</Keyboard>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger>
        <TriggerWrap>
          <Button
            size="S"
            onPress={() => previous(currentId)}
            isDisabled={!hasPrevious}
          >
            <Icon svg={<Icons.ArrowIosUpwardOutline />} />
          </Button>
        </TriggerWrap>
        <Tooltip>
          <Flex direction="row" gap="size-100" alignItems="center">
            <span>Previous trace</span>
            <Keyboard variant="primary">{PREVIOUS_TRACE_HOTKEY}</Keyboard>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
    </Flex>
  );
};
