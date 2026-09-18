import { memo, useCallback, useState } from "react";

import {
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipArrow,
  TooltipTrigger,
} from "@phoenix/components";

import { ExperimentRepetitionSelector } from "../../experiment/ExperimentRepetitionSelector";
import type {
  EvaluatorOutput,
  ExpectedOutput,
} from "../evaluators/evaluatorResults";
import { usePlaygroundDatasetExamplesTableContext } from "../PlaygroundDatasetExamplesTableContext";
import {
  type ExpectedOutputExample,
  getEvaluatorCellResult,
  getExpectedOutput,
} from "./evaluatorCellResults";
import { PlaygroundEvaluatorCell } from "./PlaygroundEvaluatorCell";
import { usePlaygroundExpectedOutputs } from "./PlaygroundExpectedOutputsContext";

/**
 * The dataset table's cell for an evaluator task and one example: reads the
 * task's run for the example from the table store and the example's expected
 * output from the dataset and the write queue, and hands both to the cell.
 */
export const PlaygroundEvaluatorExampleCell = memo(
  function PlaygroundEvaluatorExampleCell({
    instanceId,
    label,
    evaluatorName,
    annotationName,
    output,
    exampleId,
    position,
    expectedOutputs,
    isRunning,
    onViewTracePress,
  }: {
    instanceId: number;
    /** The evaluator's column letter. */
    label: string;
    evaluatorName: string;
    annotationName: string;
    output: EvaluatorOutput | undefined;
    exampleId: string;
    position: number;
    expectedOutputs: ExpectedOutputExample["expectedOutputs"];
    isRunning: boolean;
    onViewTracePress: (
      traceId: string,
      projectId: string,
      evaluatorName: string
    ) => void;
  }) {
    const [repetitionNumber, setRepetitionNumber] = useState(1);

    const totalRepetitions = usePlaygroundDatasetExamplesTableContext(
      (state) => state.repetitions
    );

    const runData = usePlaygroundDatasetExamplesTableContext(
      (state) =>
        state.exampleResponsesMap[instanceId]?.[exampleId]?.[repetitionNumber]
    );

    const { overlay, save } = usePlaygroundExpectedOutputs();
    const result = getEvaluatorCellResult({ runData, annotationName });

    const expected = getExpectedOutput({
      pending: overlay[exampleId],
      expectedOutputs,
      annotationName,
    });

    const onSave = useCallback(
      (next: ExpectedOutput | null) => save(exampleId, annotationName, next),
      [save, exampleId, annotationName]
    );

    const trace = result?.trace ?? null;

    return (
      <PlaygroundEvaluatorCell
        label={label}
        name={evaluatorName}
        position={position}
        prediction={result?.prediction}
        isPending={isRunning && result == null}
        expected={expected}
        output={output}
        isDisabled={output == null}
        onSave={onSave}
        extra={
          <>
            {totalRepetitions > 1 ? (
              <ExperimentRepetitionSelector
                repetitionNumber={repetitionNumber}
                totalRepetitions={totalRepetitions}
                setRepetitionNumber={setRepetitionNumber}
              />
            ) : null}
            <TooltipTrigger isDisabled={trace == null}>
              <IconButton
                size="S"
                aria-label="View evaluator trace"
                isDisabled={trace == null}
                onPress={() => {
                  if (trace) {
                    onViewTracePress(
                      trace.traceId,
                      trace.projectId,
                      evaluatorName
                    );
                  }
                }}
              >
                <Icon svg={<Icons.Trace />} />
              </IconButton>
              <Tooltip>
                <TooltipArrow />
                view evaluator trace
              </Tooltip>
            </TooltipTrigger>
          </>
        }
      />
    );
  }
);
