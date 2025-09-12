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
  exampleSequence,
  onNext,
  onPrevious,
}: {
  currentId: string;
  exampleSequence: string[];
  onNext: (nextId: string) => void;
  onPrevious: (previousId: string) => void;
}) => {
  useHotkeys(NEXT_EXAMPLE_HOTKEY, () => {
    const { nextExampleId } = getExampleNeighbors(exampleSequence, currentId);
    if (nextExampleId) {
      onNext(nextExampleId);
    }
  });

  useHotkeys(PREVIOUS_EXAMPLE_HOTKEY, () => {
    const { previousExampleId } = getExampleNeighbors(
      exampleSequence,
      currentId
    );
    if (previousExampleId) {
      onPrevious(previousExampleId);
    }
  });

  const { nextExampleId, previousExampleId } = getExampleNeighbors(
    exampleSequence,
    currentId
  );
  const hasPrevious = !!previousExampleId;
  const hasNext = !!nextExampleId;

  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <TooltipTrigger delay={100}>
        <Button
          size="S"
          id="next"
          leadingVisual={<Icon svg={<Icons.ArrowDownwardOutline />} />}
          aria-label="Next example"
          isDisabled={!hasNext}
          onPress={() => {
            startTransition(() => {
              if (nextExampleId) {
                onNext(nextExampleId);
              }
            });
          }}
        />
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
          id="previous"
          leadingVisual={<Icon svg={<Icons.ArrowUpwardOutline />} />}
          aria-label="Previous example"
          isDisabled={!hasPrevious}
          onPress={() => {
            startTransition(() => {
              if (previousExampleId) {
                onPrevious(previousExampleId);
              }
            });
          }}
        />
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
