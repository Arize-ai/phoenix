import {
  formatElapsedShort,
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
      "118 evaluated · 2 failed · 3 queued"
    );
    expect(formatRetainedOutcomeCounts({ ...runSummary, failedCount: 0 })).toBe(
      "118 evaluated · 3 queued"
    );
    expect(
      formatRetainedOutcomeCounts({ ...runSummary, clearedCount: 4 })
    ).toBe("118 evaluated · 2 failed · 4 cleared · 3 queued");
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
