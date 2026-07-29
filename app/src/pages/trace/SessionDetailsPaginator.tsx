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
  useSessionPagination,
} from "@phoenix/pages/trace/SessionPaginationContext";
import { classNames } from "@phoenix/utils/classNames";

export const NEXT_SESSION_HOTKEY = "j";
export const PREVIOUS_SESSION_HOTKEY = "k";

export const SessionDetailsPaginator = ({
  currentId,
  className,
  isCollapsed,
}: {
  currentId?: string;
  className?: string;
  isCollapsed: boolean;
}) => {
  const pagination = useSessionPagination();
  const handleNext = () => pagination?.next(currentId);
  const handlePrevious = () => pagination?.previous(currentId);

  useHotkeys(NEXT_SESSION_HOTKEY, handleNext);

  useHotkeys(PREVIOUS_SESSION_HOTKEY, handlePrevious);

  if (!pagination || !pagination.sessionSequence.length) {
    return null;
  }

  const { sessionSequence } = pagination;
  const { nextSessionId, previousSessionId } = getNeighbors(
    sessionSequence,
    currentId
  );
  const hasPrevious = !!previousSessionId;
  const hasNext = !!nextSessionId;
  const nextButton = (
    <TooltipTrigger key="next" delay={100}>
      <Button
        size="S"
        variant="quiet"
        id="next"
        leadingVisual={<Icon svg={<Icons.ArrowDown />} />}
        aria-label="Next session"
        isDisabled={!hasNext}
        onPress={handleNext}
      />
      <Tooltip placement={isCollapsed ? "right" : undefined} offset={4}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <span>Next session</span>
          <KeyboardToken>{NEXT_SESSION_HOTKEY}</KeyboardToken>
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
        aria-label="Previous session"
        isDisabled={!hasPrevious}
        onPress={handlePrevious}
      />
      <Tooltip placement={isCollapsed ? "right" : undefined} offset={4}>
        <Flex direction="row" gap="size-100" alignItems="center">
          <span>Previous session</span>
          <KeyboardToken>{PREVIOUS_SESSION_HOTKEY}</KeyboardToken>
        </Flex>
      </Tooltip>
    </TooltipTrigger>
  );

  return (
    <Flex
      className={classNames("session-details-paginator", className)}
      gap="size-50"
    >
      <Flex
        className="session-details-paginator__buttons"
        direction={isCollapsed ? "column" : "row"}
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
