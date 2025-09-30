import { startTransition } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  KeyboardToken,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

const NEXT_EXAMPLE_HOTKEY = "j";
const PREVIOUS_EXAMPLE_HOTKEY = "k";

export const ExampleDetailsPaginator = ({
  currentId,
  exampleIds,
  onNext,
  onPrevious,
}: {
  currentId: string;
  exampleIds: string[];
  onNext: (nextId: string) => void;
  onPrevious: (previousId: string) => void;
}) => {
  const { nextExampleId, previousExampleId } = getExampleNeighbors(
    exampleIds,
    currentId
  );
  const hasPrevious = !!previousExampleId;
  const hasNext = !!nextExampleId;

  const handleNext = () => {
    if (hasNext) {
      startTransition(() => {
        onNext(nextExampleId);
      });
    }
  };
  const handlePrevious = () => {
    if (hasPrevious) {
      startTransition(() => {
        onPrevious(previousExampleId);
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
          aria-label="Next example"
          isDisabled={!hasNext}
          onPress={handleNext}
          leadingVisual={<Icon svg={<Icons.ArrowDownwardOutline />} />}
        ></Button>
        <Tooltip
          offset={4}
          css={css`
            background-color: var(--ac-global-background-color-dark);
            border-color: var(--ac-global-border-color-dark);
            border-radius: var(--ac-global-rounding-medium);
            padding: var(--ac-global-dimension-static-size-100);
          `}
        >
          <Flex direction="row" gap="size-100" alignItems="center">
            <span>Next example</span>
            <KeyboardToken>{NEXT_EXAMPLE_HOTKEY}</KeyboardToken>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={100}>
        <Button
          size="S"
          aria-label="Previous example"
          isDisabled={!hasPrevious}
          onPress={handlePrevious}
          leadingVisual={<Icon svg={<Icons.ArrowUpwardOutline />} />}
        ></Button>
        <Tooltip
          offset={4}
          css={css`
            background-color: var(--ac-global-background-color-dark);
            border-color: var(--ac-global-border-color-dark);
            border-radius: var(--ac-global-rounding-medium);
            padding: var(--ac-global-dimension-static-size-100);
          `}
        >
          <Flex direction="row" gap="size-100" alignItems="center">
            <span>Previous example</span>
            <KeyboardToken>{PREVIOUS_EXAMPLE_HOTKEY}</KeyboardToken>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
    </Flex>
  );
};

const getExampleNeighbors = (exampleIds: string[], currentId: string) => {
  const currentIndex = exampleIds.findIndex(
    (exampleId) => exampleId === currentId
  );

  if (currentIndex === -1) {
    return {
      nextExampleId: undefined,
      previousExampleId: undefined,
    };
  }

  const previousIndex = currentIndex - 1;
  const nextIndex = currentIndex + 1;

  let previousExampleId;
  let nextExampleId;

  if (previousIndex >= 0) {
    previousExampleId = exampleIds[previousIndex];
  }
  if (nextIndex < exampleIds.length) {
    nextExampleId = exampleIds[nextIndex];
  }

  return {
    nextExampleId,
    previousExampleId,
  };
};
