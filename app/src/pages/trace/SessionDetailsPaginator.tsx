import { css } from "@emotion/react";
import { startTransition } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Button,
  Flex,
  Icon,
  Icons,
  KeyboardToken,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import {
  getNeighbors,
  useSessionPagination,
} from "@phoenix/pages/trace/SessionPaginationContext";

export const NEXT_SESSION_HOTKEY = "j";
export const PREVIOUS_SESSION_HOTKEY = "k";

export const SessionDetailsPaginator = ({
  currentId,
}: {
  currentId?: string;
}) => {
  const pagination = useSessionPagination();

  useHotkeys(NEXT_SESSION_HOTKEY, () => {
    if (pagination) {
      pagination.next(currentId);
    }
  });

  useHotkeys(PREVIOUS_SESSION_HOTKEY, () => {
    if (pagination) {
      pagination.previous(currentId);
    }
  });

  if (!pagination || !pagination.sessionSequence.length) {
    return null;
  }

  const { previous, next, sessionSequence } = pagination;
  const { nextSessionId, previousSessionId } = getNeighbors(
    sessionSequence,
    currentId
  );
  const hasPrevious = !!previousSessionId;
  const hasNext = !!nextSessionId;

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
            aria-label="Next session"
            isDisabled={!hasNext}
            onPress={() => {
              startTransition(() => {
                next(currentId);
              });
            }}
          />
          <Tooltip offset={4}>
            <TooltipArrow />
            <Flex direction="row" gap="size-100" alignItems="center">
              <span>Next session</span>
              <KeyboardToken>{NEXT_SESSION_HOTKEY}</KeyboardToken>
            </Flex>
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={100}>
          <Button
            size="S"
            id="previous"
            leadingVisual={<Icon svg={<Icons.ArrowUpwardOutline />} />}
            aria-label="Previous session"
            isDisabled={!hasPrevious}
            onPress={() => {
              startTransition(() => {
                previous(currentId);
              });
            }}
          />
          <Tooltip offset={4}>
            <TooltipArrow />
            <Flex direction="row" gap="size-100" alignItems="center">
              <span>Previous session</span>
              <KeyboardToken>{PREVIOUS_SESSION_HOTKEY}</KeyboardToken>
            </Flex>
          </Tooltip>
        </TooltipTrigger>
      </Flex>
    </Flex>
  );
};
