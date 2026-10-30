import {
  getServerProjectSeries,
  getShownProjectIds,
  MAX_PICKED_PROJECTS,
  normalizePickedProjectIds,
  OTHER_PROJECTS_KEY,
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

describe("normalizePickedProjectIds", () => {
  it("drops empty and repeated ids and caps the picks", () => {
    const ids = [
      "a",
      "",
      "a",
      ...Array.from({ length: 20 }, (_, i) => `p${i}`),
    ];
    const normalized = normalizePickedProjectIds(ids);
    expect(normalized[0]).toBe("a");
    expect(new Set(normalized).size).toBe(normalized.length);
    expect(normalized).not.toContain("");
    expect(normalized).toHaveLength(MAX_PICKED_PROJECTS);
  });
});

describe("getServerProjectSeries", () => {
  const groups = ["a", "b", "c", "d", "e", "f", "g"].map((id, index) =>
    group(id, 100 - index)
  );
  const palette = ["c1", "c2", "c3", "c4", "c5"];

  it("groups the projects past the heaviest five", () => {
    const { series } = getServerProjectSeries({
      groups,
      queued: [],
      pickedProjectIds: [],
      palette,
      otherColor: "gray",
    });
    expect(series.map(({ key }) => key)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      OTHER_PROJECTS_KEY,
    ]);
    expect(series.at(-1)?.name).toBe("2 other projects");
  });

  it("shows only picked projects that still exist, with no other series", () => {
    const projectSeries = getServerProjectSeries({
      groups,
      queued: [],
      pickedProjectIds: ["deleted", "f"],
      palette,
      otherColor: "gray",
    });
    expect(projectSeries.pickedIds).toEqual(["f"]);
    expect(projectSeries.series.map(({ key }) => key)).toEqual(["f"]);
    expect(projectSeries.getKey("a")).toBe(OTHER_PROJECTS_KEY);
  });
});
