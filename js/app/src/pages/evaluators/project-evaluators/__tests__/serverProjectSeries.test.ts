import {
  getServerProjectSeries,
  OTHER_PROJECTS_KEY,
  rankProjects,
} from "@phoenix/pages/evaluators/project-evaluators/serverProjectSeries";

function group(id: string, evaluatedCount: number, failedCount = 0) {
  return { project: { id, name: id }, evaluatedCount, failedCount };
}

describe("rankProjects", () => {
  it("puts the busiest projects first, counting failures", () => {
    const ranked = rankProjects([
      group("quiet", 10),
      group("busy", 900),
      group("failing", 5, 600),
    ]);
    expect(ranked.map((project) => project.id)).toEqual([
      "busy",
      "failing",
      "quiet",
    ]);
  });

  it("breaks ties by name", () => {
    const ranked = rankProjects([group("b", 5), group("a", 5)]);
    expect(ranked.map((project) => project.id)).toEqual(["a", "b"]);
  });
});

describe("getServerProjectSeries", () => {
  it("gives the busiest five their own series, in rank order", () => {
    const { series } = getServerProjectSeries(
      ["a", "b", "c", "d", "e", "f", "g"].map((id, index) =>
        group(id, 100 - index)
      )
    );
    expect(series.map((entry) => entry.key)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      OTHER_PROJECTS_KEY,
    ]);
    expect(series.at(-1)?.name).toBe("2 other projects");
  });

  it("colors projects by rank, as evaluator charts do, and the rest gray", () => {
    const { series } = getServerProjectSeries([
      group("second", 50),
      group("first", 90),
      group("idle", 0),
    ]);
    expect(series.map(({ key, colorIndex }) => [key, colorIndex])).toEqual([
      ["first", 0],
      ["second", 1],
      [OTHER_PROJECTS_KEY, null],
    ]);
  });

  it("folds projects with nothing completed into the other series", () => {
    const { series, getKey } = getServerProjectSeries([
      group("busy", 10),
      group("idle", 0),
    ]);
    expect(series.at(-1)?.name).toBe("1 other project");
    expect(getKey("busy")).toBe("busy");
    expect(getKey("idle")).toBe(OTHER_PROJECTS_KEY);
  });

  it("has no other series when every project has its own", () => {
    const { series } = getServerProjectSeries([group("a", 1), group("b", 1)]);
    expect(series.map((entry) => entry.key)).toEqual(["a", "b"]);
  });
});
