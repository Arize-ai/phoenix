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
  currentExampleIndex,
  exampleIds,
  onExampleChange,
}: {
  currentExampleIndex: number;
  exampleIds: string[];
  onExampleChange: (exampleIndex: number) => void;
}) => {
  const hasPrevious = currentExampleIndex > 0;
  const hasNext = currentExampleIndex < exampleIds.length - 1;

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
            <span>Previous</span>
            <KeyboardToken>{PREVIOUS_EXAMPLE_HOTKEY}</KeyboardToken>
          </Flex>
        </Tooltip>
      </TooltipTrigger>
    </Flex>
  );
};
