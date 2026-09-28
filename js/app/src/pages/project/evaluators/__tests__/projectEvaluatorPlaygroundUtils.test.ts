import {
  getDefaultExportedDatasetName,
  getProjectEvaluatorPlaygroundPath,
  isValidExportedSpanLimit,
  MAX_EXPORTED_SPANS,
} from "@phoenix/pages/project/evaluators/projectEvaluatorPlaygroundUtils";

describe("getProjectEvaluatorPlaygroundPath", () => {
  it("opens the project evaluator with the dataset selected", () => {
    const path = getProjectEvaluatorPlaygroundPath({
      projectEvaluatorId: "ProjectEvaluator:1",
      datasetId: "Dataset:2",
    });
    const url = new URL(path, "http://localhost");
    expect(url.pathname).toBe("/playground");
    expect(url.searchParams.get("projectEvaluator0")).toBe(
      "ProjectEvaluator:1"
    );
    expect(url.searchParams.get("datasetId")).toBe("Dataset:2");
    expect(url.searchParams.getAll("splitId")).toEqual([]);
  });

  it("repeats splitId for each selected split", () => {
    const path = getProjectEvaluatorPlaygroundPath({
      projectEvaluatorId: "ProjectEvaluator:1",
      datasetId: "Dataset:2",
      splitIds: ["DatasetSplit:3", "DatasetSplit:4"],
    });
    expect(
      new URL(path, "http://localhost").searchParams.getAll("splitId")
    ).toEqual(["DatasetSplit:3", "DatasetSplit:4"]);
  });
});

describe("getDefaultExportedDatasetName", () => {
  it("names the dataset after the evaluator and the local time", () => {
    expect(
      getDefaultExportedDatasetName({
        evaluatorName: "correctness",
        now: new Date(2026, 8, 4, 9, 5),
      })
    ).toBe("correctness spans 2026-09-04 09:05");
  });
});

describe("isValidExportedSpanLimit", () => {
  it.each([
    [1, true],
    [MAX_EXPORTED_SPANS, true],
    [0, false],
    [MAX_EXPORTED_SPANS + 1, false],
    [2.5, false],
    [Number.NaN, false],
  ])("%s is valid: %s", (limit, isValid) => {
    expect(isValidExportedSpanLimit(limit)).toBe(isValid);
  });
});
