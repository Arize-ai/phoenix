import { startTransition } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  KeyboardToken,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

const NEXT_EXAMPLE_HOTKEY = "j";
const PREVIOUS_EXAMPLE_HOTKEY = "k";

export const ExampleDetailsPaginator = ({
  currentId,
  exampleSequence,
  onNext,
  onPrevious,
}: {
  currentId: string;
  exampleSequence: string[];
  onNext: (nextId: string) => void;
  onPrevious: (previousId: string) => void;
}) => {
  const { nextExampleId, previousExampleId } = getExampleNeighbors(
    exampleSequence,
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
        <IconButton
          size="S"
          aria-label="Next example"
          isDisabled={!hasNext}
          onPress={handleNext}
        >
          <Icon svg={<Icons.ArrowDownwardOutline />} />
        </IconButton>
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
        <IconButton
          size="S"
          aria-label="Previous example"
          isDisabled={!hasPrevious}
          onPress={handlePrevious}
        >
          <Icon svg={<Icons.ArrowUpwardOutline />} />
        </IconButton>
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

const getExampleNeighbors = (exampleSequence: string[], currentId: string) => {
  const currentIndex = exampleSequence.findIndex(
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
    previousExampleId = exampleSequence[previousIndex];
  }
  if (nextIndex < exampleSequence.length) {
    nextExampleId = exampleSequence[nextIndex];
  }

  return {
    nextExampleId,
    previousExampleId,
  };
};
