import {
  getCompareLaneRunState,
  getShownRun,
  resolveShownRepetitionNumber,
} from "../experimentCompareLaneRuns";

describe("resolveShownRepetitionNumber", () => {
  it("caps a lane at its own experiment's repetition count", () => {
    expect(
      resolveShownRepetitionNumber({
        requestedRepetitionNumber: 5,
        repetitionCount: 3,
      })
    ).toBe(3);
  });

  it("does not go below the first repetition", () => {
    expect(
      resolveShownRepetitionNumber({
        requestedRepetitionNumber: 0,
        repetitionCount: 3,
      })
    ).toBe(1);
  });
});

describe("getCompareLaneRunState", () => {
  const completedRun = { repetitionNumber: 1, error: null };
  const erroredRun = { repetitionNumber: 2, error: "TimeoutError" };

  it("has no runs when the experiment did not run the example", () => {
    const state = getCompareLaneRunState({
      runs: [],
      shownRepetitionNumber: 1,
    });
    expect(state).toEqual({ type: "no-runs" });
    expect(getShownRun(state)).toBeNull();
  });

  it("is missing a repetition that did not run while others did", () => {
    expect(
      getCompareLaneRunState({
        runs: [completedRun],
        shownRepetitionNumber: 3,
      })
    ).toEqual({ type: "missing-repetition" });
  });

  it("keeps an errored run so its trace stays reachable", () => {
    const state = getCompareLaneRunState({
      runs: [completedRun, erroredRun],
      shownRepetitionNumber: 2,
    });
    expect(state).toEqual({ type: "errored", run: erroredRun });
    expect(getShownRun(state)).toBe(erroredRun);
  });

  it("is completed for a run without an error", () => {
    expect(
      getCompareLaneRunState({
        runs: [completedRun, erroredRun],
        shownRepetitionNumber: 1,
      })
    ).toEqual({ type: "completed", run: completedRun });
  });
});
