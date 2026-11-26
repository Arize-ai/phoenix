import { assertUnreachable } from "@phoenix/typeUtils";
import { clampNumber } from "@phoenix/utils/numberUtils";

/**
 * The run fields the lane logic reads, so it can be exercised without the
 * GraphQL types.
 */
type CompareLaneRunLike = {
  readonly repetitionNumber: number;
  readonly error: string | null;
};

type CompareLanePendingRunLike = {
  readonly repetitionNumber: number;
  readonly partialOutput: string | null;
};

export type CompareLaneRunState<TRun extends CompareLaneRunLike> =
  /** The repetition shown is being generated and has no run record yet */
  | { type: "pending"; partialOutput: string | null }
  /** The experiment has no run at all for the example */
  | { type: "no-runs" }
  /** Other repetitions ran, but not the one shown */
  | { type: "missing-repetition" }
  | { type: "errored"; run: TRun }
  | { type: "completed"; run: TRun };

/**
 * The repetition a lane shows: the requested one, held inside the
 * experiment's own repetition count.
 */
export function resolveShownRepetitionNumber({
  requestedRepetitionNumber,
  repetitionCount,
}: {
  requestedRepetitionNumber: number;
  repetitionCount: number;
}): number {
  return clampNumber({
    value: requestedRepetitionNumber,
    min: 1,
    max: Math.max(repetitionCount, 1),
  });
}

/**
 * What a lane has to show for the repetition it is on.
 * @param params.runs - the experiment's runs for the example
 * @param params.shownRepetitionNumber - the repetition the lane is on
 * @param params.pendingRuns - the runs still being generated, when the experiment is running
 */
export function getCompareLaneRunState<TRun extends CompareLaneRunLike>({
  runs,
  shownRepetitionNumber,
  pendingRuns = [],
}: {
  runs: readonly TRun[];
  shownRepetitionNumber: number;
  pendingRuns?: readonly CompareLanePendingRunLike[];
}): CompareLaneRunState<TRun> {
  const run = runs.find(
    (candidate) => candidate.repetitionNumber === shownRepetitionNumber
  );
  if (run != null) {
    return run.error != null
      ? { type: "errored", run }
      : { type: "completed", run };
  }
  const pendingRun = pendingRuns.find(
    (candidate) => candidate.repetitionNumber === shownRepetitionNumber
  );
  if (pendingRun != null) {
    return { type: "pending", partialOutput: pendingRun.partialOutput };
  }
  return runs.length === 0
    ? { type: "no-runs" }
    : { type: "missing-repetition" };
}

/**
 * What a lane cell says in place of a run it does not have.
 */
export function getMissingRunMessage(
  runStateType: "pending" | "no-runs" | "missing-repetition"
): string {
  switch (runStateType) {
    case "pending":
      return "Run in progress";
    case "no-runs":
      return "No run for this example";
    case "missing-repetition":
      return "No run for this repetition";
    default:
      return assertUnreachable(runStateType);
  }
}

/**
 * The run a lane's stats, output and deltas read from, or null when the lane
 * has no run for the repetition shown.
 */
export function getShownRun<TRun extends CompareLaneRunLike>(
  state: CompareLaneRunState<TRun>
): TRun | null {
  return state.type === "errored" || state.type === "completed"
    ? state.run
    : null;
}
