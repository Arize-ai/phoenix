import { startTransition } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import {
  Button,
  Flex,
  Icon,
  Icons,
  KeyboardToken,
  ProgressCircle,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

const NEXT_EXAMPLE_HOTKEY = "j";
const PREVIOUS_EXAMPLE_HOTKEY = "k";

export const ExampleDetailsPaginator = ({
  currentExampleIndex,
  exampleIds,
  onExampleChange,
  hasMoreExamples = false,
  isLoadingMoreExamples = false,
}: {
  currentExampleIndex: number;
  exampleIds: readonly string[];
  /**
   * Called with the index to move to. With `hasMoreExamples`, that index is
   * one past the loaded examples when next is pressed on the last of them.
   */
  onExampleChange: (exampleIndex: number) => void;
  /** Whether the server has examples past the loaded ones */
  hasMoreExamples?: boolean;
  /** Whether the next page of examples is being fetched */
  isLoadingMoreExamples?: boolean;
}) => {
  const hasPrevious = currentExampleIndex > 0;
  const isOnLastLoadedExample = currentExampleIndex >= exampleIds.length - 1;
  const isNextPending = isOnLastLoadedExample && isLoadingMoreExamples;
  const hasNext = !isNextPending && (!isOnLastLoadedExample || hasMoreExamples);

  const handleNext = () => {
    if (hasNext) {
      startTransition(() => {
        onExampleChange(currentExampleIndex + 1);
      });
    }
  };
  const handlePrevious = () => {
    if (hasPrevious) {
      startTransition(() => {
        onExampleChange(currentExampleIndex - 1);
      });
    }
  };

  useHotkeys(NEXT_EXAMPLE_HOTKEY, () => {
    handleNext();
  });

  useHotkeys(PREVIOUS_EXAMPLE_HOTKEY, () => {
    handlePrevious();
  });

  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <TooltipTrigger delay={100}>
        <Button
          size="S"
          aria-label="Next"
          isDisabled={!hasNext && !isNextPending}
          isPending={isNextPending}
          onPress={handleNext}
          leadingVisual={
            isNextPending ? (
              <ProgressCircle
                isIndeterminate
                size="S"
                aria-label="Loading more examples"
              />
            ) : (
              <Icon svg={<Icons.ArrowDown />} />
            )
          }
        ></Button>
        <Tooltip offset={4}>
          <TooltipArrow />
          <Flex direction="row" gap="size-100" alignItems="center">
            <span>Next</span>
            <KeyboardToken>{NEXT_EXAMPLE_HOTKEY}</KeyboardToken>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={100}>
        <Button
          size="S"
          aria-label="Previous"
          isDisabled={!hasPrevious}
          onPress={handlePrevious}
          leadingVisual={<Icon svg={<Icons.ArrowUp />} />}
        ></Button>
        <Tooltip offset={4}>
          <TooltipArrow />
          <Flex direction="row" gap="size-100" alignItems="center">
            <span>Previous</span>
            <KeyboardToken>{PREVIOUS_EXAMPLE_HOTKEY}</KeyboardToken>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
    </Flex>
  );
};
