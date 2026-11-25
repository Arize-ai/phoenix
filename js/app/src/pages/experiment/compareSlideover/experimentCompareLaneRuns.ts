/**
 * The run fields the lane logic reads, so it can be exercised without the
 * GraphQL types.
 */
export type CompareLaneRunLike = {
  readonly repetitionNumber: number;
  readonly error: string | null;
};

export type CompareLaneRunState<TRun extends CompareLaneRunLike> =
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
  return Math.min(
    Math.max(requestedRepetitionNumber, 1),
    Math.max(repetitionCount, 1)
  );
}

/**
 * What a lane has to show for the repetition it is on.
 * @param params.runs - the experiment's runs for the example
 * @param params.shownRepetitionNumber - the repetition the lane is on
 */
export function getCompareLaneRunState<TRun extends CompareLaneRunLike>({
  runs,
  shownRepetitionNumber,
}: {
  runs: readonly TRun[];
  shownRepetitionNumber: number;
}): CompareLaneRunState<TRun> {
  if (runs.length === 0) {
    return { type: "no-runs" };
  }
  const run = runs.find(
    (candidate) => candidate.repetitionNumber === shownRepetitionNumber
  );
  if (run == null) {
    return { type: "missing-repetition" };
  }
  return run.error != null
    ? { type: "errored", run }
    : { type: "completed", run };
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
