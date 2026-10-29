import {
  getShownProjectIds,
  rankProjects,
} from "@phoenix/pages/evaluators/projectEvaluators/serverProjectSeries";

function group(id: string, evaluatedCount: number, failedCount = 0) {
  return { project: { id, name: id }, evaluatedCount, failedCount };
}

describe("rankProjects", () => {
  it("puts the projects holding the most of the queue first, then the busiest", () => {
    const ranked = rankProjects({
      groups: [group("busy", 900), group("stuck", 10), group("idle", 0)],
      queued: [{ project: { id: "stuck" }, queuedCount: 5000 }],
    });
    expect(ranked.map((project) => project.id)).toEqual([
      "stuck",
      "busy",
      "idle",
    ]);
  });
});

describe("getShownProjectIds", () => {
  const ranked = rankProjects({
    groups: ["a", "b", "c", "d", "e", "f", "idle"].map((id, index) =>
      group(id, id === "idle" ? 0 : 100 - index)
    ),
    queued: [],
  });

  it("shows the heaviest five with activity when none are picked", () => {
    expect(getShownProjectIds(ranked, [])).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("shows exactly the picked projects, heaviest first", () => {
    expect(getShownProjectIds(ranked, ["idle", "c"])).toEqual(["c", "idle"]);
  });

  it("ignores picked projects that no longer have an evaluator", () => {
    expect(getShownProjectIds(ranked, ["gone", "b"])).toEqual(["b"]);
  });
});
