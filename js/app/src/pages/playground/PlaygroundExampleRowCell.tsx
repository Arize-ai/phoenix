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

import { usePlaygroundDatasetExamplesTableContext } from "./PlaygroundDatasetExamplesTableContext";

/**
 * The leading cell of a row: its number, and a play button that runs every
 * task on this one example. Together with the play in each task's column
 * header this makes the direction of a run visible: down a column, or across
 * a row. A row run is a spot check and is never recorded as an experiment.
 */
export function PlaygroundExampleRowCell({
  exampleId,
  position,
  runningInstanceIds,
  canRun,
  onRun,
}: {
  exampleId: string;
  /** The row's number in the table, from 1. */
  position: number;
  /** The instances a run is in progress for. */
  runningInstanceIds: readonly number[];
  canRun: boolean;
  onRun: () => void;
}) {
  // A running instance without a result for this example yet is still
  // working on this row.
  const isPending = usePlaygroundDatasetExamplesTableContext((state) =>
    runningInstanceIds.some(
      (instanceId) => state.exampleResponsesMap[instanceId]?.[exampleId] == null
    )
  );

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
        <TooltipTrigger>
          <IconButton
            size="S"
            aria-label={`Run all tasks on row ${position}`}
            isDisabled={!canRun}
            onPress={onRun}
          >
            <Icon svg={<Icons.Play />} />
          </IconButton>
          <Tooltip>
            <TooltipArrow />
            Run every task for this example. Not recorded.
          </Tooltip>
        </TooltipTrigger>
      )}
    </Flex>
  );
}

const rowCellCSS = css`
  padding-top: var(--global-dimension-size-100);
`;
