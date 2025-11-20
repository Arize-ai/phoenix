import { SetStateAction, useMemo } from "react";
import { css } from "@emotion/react";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";

export function ExperimentRepetitionSelector({
  repetitionNumber,
  totalRepetitions,
  setRepetitionNumber,
}: {
  repetitionNumber: number;
  totalRepetitions: number;
  setRepetitionNumber: (n: SetStateAction<number>) => void;
}) {
  const widthInChars = useMemo(
    () => totalRepetitions.toString().length * 2 + 2,
    [totalRepetitions]
  );
  return (
    <Flex direction="row" alignItems="center">
      <TooltipTrigger>
        <TriggerWrap>
          <Flex direction="row" alignItems="center">
            <Icon svg={<Icons.RepeatOutline />} />
            <Text
              css={css`
                margin-inline-start: var(--ac-global-dimension-size-100);
                margin-inline-end: var(--ac-global-dimension-size-100);
                width: ${widthInChars}ch;
                text-align: center;
              `}
            >
              {`${repetitionNumber} / ${totalRepetitions}`}
            </Text>
          </Flex>
        </TriggerWrap>
        <Tooltip>
          {`repetition ${repetitionNumber} of ${totalRepetitions}`}
        </Tooltip>
      </TooltipTrigger>
      <IconButton
        size="S"
        isDisabled={repetitionNumber === 1}
        onPress={() => setRepetitionNumber((prev) => prev - 1)}
        aria-label="Previous repetition"
      >
        <Icon svg={<Icons.ChevronLeft />} />
      </IconButton>
      <IconButton
        size="S"
        isDisabled={repetitionNumber === totalRepetitions}
        onPress={() => setRepetitionNumber((prev) => prev + 1)}
        aria-label="Next repetition"
      >
        <Icon svg={<Icons.ChevronRight />} />
      </IconButton>
    </Flex>
  );
}
