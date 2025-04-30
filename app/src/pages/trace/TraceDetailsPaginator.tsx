import React from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Button, Flex, Icon, Icons } from "@phoenix/components";
import {
  getNeighbors,
  useTracePagination,
} from "@phoenix/pages/trace/TracePaginationContext";

export const TraceDetailsPaginator = ({
  currentId,
}: {
  currentId?: string;
}) => {
  const pagination = useTracePagination();

  useHotkeys("right", () => {
    if (pagination) {
      pagination.next(currentId);
    }
  });

  useHotkeys("left", () => {
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
    <Flex gap="size-50">
      <Button
        size="S"
        onPress={() => previous(currentId)}
        isDisabled={!hasPrevious}
      >
        <Icon svg={<Icons.ArrowIosBackOutline />} />
      </Button>
      <Button size="S" onPress={() => next(currentId)} isDisabled={!hasNext}>
        <Icon svg={<Icons.ArrowIosForwardOutline />} />
      </Button>
    </Flex>
  );
};
