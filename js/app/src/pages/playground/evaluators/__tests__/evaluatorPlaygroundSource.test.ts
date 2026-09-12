import { describe, expect, it } from "vitest";

import {
  clearSlotBindingParams,
  readEvaluatorPlaygroundSource,
  toEvaluatorSlotSource,
  writeEvaluatorPlaygroundSource,
} from "../evaluatorPlaygroundSource";

describe("readEvaluatorPlaygroundSource", () => {
  it("reads a dataset with its splits and version", () => {
    const params = new URLSearchParams(
      "datasetId=d1&splitId=s1&splitId=s2&datasetVersionId=v1"
    );
    expect(readEvaluatorPlaygroundSource(params)).toEqual({
      kind: "dataset",
      datasetId: "d1",
      splitIds: ["s1", "s2"],
      versionId: "v1",
    });
  });

  it("reads a project, defaulting the window and the filter", () => {
    expect(
      readEvaluatorPlaygroundSource(new URLSearchParams("projectId=p1"))
    ).toEqual({
      kind: "project",
      projectId: "p1",
      filterCondition: "",
      window: "7d",
    });
    expect(
      readEvaluatorPlaygroundSource(
        new URLSearchParams(
          "projectId=p1&filterCondition=span_kind+%3D%3D+'LLM'&window=1h"
        )
      )
    ).toEqual({
      kind: "project",
      projectId: "p1",
      filterCondition: "span_kind == 'LLM'",
      window: "1h",
    });
  });

  it("falls back to the default window for an unknown preset", () => {
    expect(
      readEvaluatorPlaygroundSource(
        new URLSearchParams("projectId=p1&window=1y")
      )
    ).toMatchObject({ window: "7d" });
  });

  it("prefers the dataset when a URL names both, and is null for neither", () => {
    expect(
      readEvaluatorPlaygroundSource(
        new URLSearchParams("datasetId=d1&projectId=p1")
      )
    ).toMatchObject({ kind: "dataset" });
    expect(readEvaluatorPlaygroundSource(new URLSearchParams())).toBeNull();
  });
});

describe("writeEvaluatorPlaygroundSource", () => {
  it("replaces a dataset with a project and clears both kinds of slot bindings", () => {
    const params = new URLSearchParams(
      "mode=evaluators&datasetId=d1&splitId=s1&datasetEvaluatorA=b1&projectEvaluatorB=x&evaluatorC=e3&sampleSize=5"
    );
    writeEvaluatorPlaygroundSource(
      params,
      { kind: "project", projectId: "p1", filterCondition: "", window: "7d" },
      readEvaluatorPlaygroundSource(params)
    );
    expect(params.toString()).toBe(
      "mode=evaluators&evaluatorC=e3&sampleSize=5&projectId=p1"
    );
  });

  it("omits the default window and an empty filter", () => {
    const params = new URLSearchParams();
    writeEvaluatorPlaygroundSource(
      params,
      {
        kind: "project",
        projectId: "p1",
        filterCondition: "name == 'x'",
        window: "24h",
      },
      null
    );
    expect(Object.fromEntries(params)).toEqual({
      projectId: "p1",
      filterCondition: "name == 'x'",
      window: "24h",
    });
  });

  it("keeps slot bindings when only the filter or window changes", () => {
    const params = new URLSearchParams("projectId=p1&projectEvaluatorA=pe1");
    const previous = readEvaluatorPlaygroundSource(params);
    writeEvaluatorPlaygroundSource(
      params,
      {
        kind: "project",
        projectId: "p1",
        filterCondition: "span_kind == 'LLM'",
        window: "1h",
      },
      previous
    );
    expect(params.get("projectEvaluatorA")).toBe("pe1");
    expect(params.get("window")).toBe("1h");
  });

  it("clears bindings when the dataset changes, and clears everything for null", () => {
    const params = new URLSearchParams("datasetId=d1&datasetEvaluatorA=b1");
    writeEvaluatorPlaygroundSource(
      params,
      { kind: "dataset", datasetId: "d2", splitIds: [], versionId: null },
      readEvaluatorPlaygroundSource(params)
    );
    expect(params.toString()).toBe("datasetId=d2");
    writeEvaluatorPlaygroundSource(
      params,
      null,
      readEvaluatorPlaygroundSource(params)
    );
    expect(params.toString()).toBe("");
  });
});

describe("slot bindings and slot source", () => {
  it("clears one slot's bindings of every kind", () => {
    const params = new URLSearchParams(
      "datasetEvaluatorA=1&projectEvaluatorA=2&datasetEvaluatorB=3"
    );
    clearSlotBindingParams(params, "A");
    expect(params.toString()).toBe("datasetEvaluatorB=3");
  });

  it("reduces a source to what a slot saves against", () => {
    expect(
      toEvaluatorSlotSource({
        kind: "dataset",
        datasetId: "d1",
        splitIds: ["s"],
        versionId: "v",
      })
    ).toEqual({ kind: "dataset", datasetId: "d1" });
    expect(
      toEvaluatorSlotSource({
        kind: "project",
        projectId: "p1",
        filterCondition: "",
        window: "7d",
      })
    ).toEqual({ kind: "project", projectId: "p1" });
    expect(toEvaluatorSlotSource(null)).toBeNull();
  });
});
