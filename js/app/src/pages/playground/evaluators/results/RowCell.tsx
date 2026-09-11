import { css } from "@emotion/react";

import {
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";
import { ProgressCircle } from "@phoenix/components/core/progress/ProgressCircle";

/**
 * The leading cell of a row: its number, and a play button — shown on hover,
 * like the row actions elsewhere in the app — that runs every evaluator on
 * this one example. Together with the play in each evaluator's column header
 * this makes the direction of a run visible: down a column, or across a row.
 */
export function RowCell({
  position,
  isPending,
  canRun,
  onRun,
}: {
  position: number;
  /** A run is still waiting on this row in at least one column. */
  isPending: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      gap="size-100"
      css={rowCellCSS}
    >
      <Text size="S" color="text-500" fontFamily="mono">
        {position}
      </Text>
      {isPending ? (
        <ProgressCircle isIndeterminate size="S" aria-label="Running" />
      ) : (
        <span className="results-table__row-play">
          <TooltipTrigger>
            <IconButton
              size="S"
              aria-label={`Run evaluators on example ${position}`}
              isDisabled={!canRun}
              onPress={onRun}
            >
              <Icon svg={<Icons.Play />} />
            </IconButton>
            <Tooltip>
              <TooltipArrow />
              Run evaluators on this example
            </Tooltip>
          </TooltipTrigger>
        </span>
      )}
    </Flex>
  );
}

const rowCellCSS = css`
  padding-top: var(--global-dimension-size-100);
`;
