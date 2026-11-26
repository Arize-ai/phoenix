import {
  formatElapsedShort,
  formatEvaluatorUsage,
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

describe("formatEvaluatorUsage", () => {
  const projects = [
    { id: "project-a", name: "support-bot" },
    { id: "project-b", name: "checkout-agent" },
    { id: "project-c", name: "search" },
  ];

  it("names the current project first as this project", () => {
    expect(
      formatEvaluatorUsage({
        projects: [projects[0], projects[1]],
        currentProjectId: "project-b",
        numDatasets: 0,
      })
    ).toBe("Used in this project, support-bot");
  });

  it("names two projects and counts the rest, then the datasets", () => {
    expect(
      formatEvaluatorUsage({
        projects,
        currentProjectId: "project-z",
        numDatasets: 2,
      })
    ).toBe("Used in support-bot, checkout-agent +1 · 2 datasets");
  });

  it("counts datasets alone when no project runs the evaluator", () => {
    expect(
      formatEvaluatorUsage({
        projects: [],
        currentProjectId: "project-a",
        numDatasets: 1,
      })
    ).toBe("Used in 1 dataset");
  });

  it("says when the evaluator is used nowhere", () => {
    expect(
      formatEvaluatorUsage({
        projects: [],
        currentProjectId: "project-a",
        numDatasets: 0,
      })
    ).toBe("Not used yet");
  });
});
