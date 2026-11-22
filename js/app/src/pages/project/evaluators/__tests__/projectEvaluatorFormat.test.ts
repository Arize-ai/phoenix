import {
  formatElapsedShort,
  formatEvaluationDelayHelp,
  formatRetainedOutcomeCounts,
} from "../projectEvaluatorFormat";

const runSummary = {
  queuedCount: 3,
  evaluatedCount: 118,
  failedCount: 2,
  clearedCount: 0,
};

describe("formatRetainedOutcomeCounts", () => {
  it("omits the parts of the funnel that are empty", () => {
    expect(formatRetainedOutcomeCounts(runSummary)).toBe(
      "118 evaluated · 2 failed · 3 in queue"
    );
    expect(formatRetainedOutcomeCounts({ ...runSummary, failedCount: 0 })).toBe(
      "118 evaluated · 3 in queue"
    );
    expect(
      formatRetainedOutcomeCounts({ ...runSummary, clearedCount: 4 })
    ).toBe("118 evaluated · 2 failed · 4 cleared · 3 in queue");
  });
});

describe("formatElapsedShort", () => {
  it("shows the largest whole unit elapsed", () => {
    const now = Date.parse("2026-10-01T12:00:00Z");
    expect(formatElapsedShort("2026-10-01T11:59:30Z", now)).toBe("<1m");
    expect(formatElapsedShort("2026-10-01T11:48:00Z", now)).toBe("12m");
    expect(formatElapsedShort("2026-10-01T09:00:00Z", now)).toBe("3h");
    expect(formatElapsedShort("2026-09-29T11:00:00Z", now)).toBe("2d");
  });
});

describe("formatEvaluationDelayHelp", () => {
  it("says when a target is evaluated and when the first results appear", () => {
    expect(
      formatEvaluationDelayHelp({ targetType: "TRACE", delaySeconds: 300 })
    ).toBe(
      "Traces are evaluated 5 minutes after their last activity, so a new evaluator shows no results for at least 5 minutes."
    );
  });

  it("keeps raw seconds when the delay is not a whole number of minutes", () => {
    expect(
      formatEvaluationDelayHelp({ targetType: "SESSION", delaySeconds: 90 })
    ).toBe(
      "Sessions are evaluated 90 seconds after their last activity, so a new evaluator shows no results for at least 90 seconds."
    );
  });
});
