import type { CompareLaneLiveRuns } from "@phoenix/pages/experiment/compareSlideover";

import type {
  ExampleRunData,
  RepetitionNumber,
} from "./PlaygroundDatasetExamplesTableContext";

/**
 * What the compare slideover needs to know about one instance's runs for an
 * example while the Playground is still producing them: which repetitions
 * have no run record yet, and a key that changes each time a run or an
 * evaluation is recorded.
 * @param params.responsesByRepetitionNumber - what the instance has received for the example so far
 * @param params.repetitionCount - how many repetitions the run makes of each example
 * @param params.isRunning - whether the instance is running this example
 */
export function getPlaygroundCompareLaneLiveRuns({
  responsesByRepetitionNumber = {},
  repetitionCount,
  isRunning,
}: {
  responsesByRepetitionNumber?: Record<
    RepetitionNumber,
    ExampleRunData | undefined
  >;
  repetitionCount: number;
  isRunning: boolean;
}): CompareLaneLiveRuns {
  const allResponses = Object.values(responsesByRepetitionNumber);
  const numRecordedRuns = allResponses.filter(isRunRecorded).length;
  const numEvaluations = allResponses.reduce(
    (sum, response) => sum + (response?.evaluations?.length ?? 0),
    0
  );
  const repetitionNumbers = Array.from(
    { length: repetitionCount },
    (_, index) => index + 1
  );
  return {
    pendingRuns: isRunning
      ? repetitionNumbers
          .filter(
            (repetitionNumber) =>
              !isRunRecorded(responsesByRepetitionNumber[repetitionNumber])
          )
          .map((repetitionNumber) => ({
            repetitionNumber,
            partialOutput:
              responsesByRepetitionNumber[repetitionNumber]?.content ?? null,
          }))
      : [],
    fetchKey: `${numRecordedRuns}:${numEvaluations}`,
  };
}

function isRunRecorded(response: ExampleRunData | undefined): boolean {
  return (
    response?.experimentRunId != null ||
    response?.errorMessage != null ||
    response?.span != null
  );
}
