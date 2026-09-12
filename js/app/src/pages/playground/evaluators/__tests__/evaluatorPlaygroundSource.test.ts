import { describe, expect, it } from "vitest";

import {
  clearSlotBindingParams,
  getConfiguredSource,
  readEvaluatorPlaygroundSource,
  resolveProjectScope,
  toEvaluatorSlotSource,
  writeEvaluatorPlaygroundSource,
} from "../evaluatorPlaygroundSource";
import type { EvaluatorPlaygroundSource } from "../evaluatorPlaygroundSource";

const dataset: EvaluatorPlaygroundSource = {
  kind: "dataset",
  datasetId: "d1",
  splitIds: ["s1"],
  versionId: null,
};

const project: EvaluatorPlaygroundSource = {
  kind: "project",
  projectId: "p1",
  filterCondition: "span_kind == 'LLM'",
};

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

  it("reads a project, defaulting the filter", () => {
    expect(
      readEvaluatorPlaygroundSource(new URLSearchParams("projectId=p1"))
    ).toEqual({ kind: "project", projectId: "p1", filterCondition: "" });
    expect(
      readEvaluatorPlaygroundSource(
        new URLSearchParams(
          "projectId=p1&filterCondition=span_kind+%3D%3D+'LLM'"
        )
      )
    ).toEqual({
      kind: "project",
      projectId: "p1",
      filterCondition: "span_kind == 'LLM'",
    });
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
      { kind: "project", projectId: "p1", filterCondition: "" },
      readEvaluatorPlaygroundSource(params)
    );
    expect(params.toString()).toBe(
      "mode=evaluators&evaluatorC=e3&sampleSize=5&projectId=p1"
    );
  });

  it("omits an empty filter", () => {
    const params = new URLSearchParams();
    writeEvaluatorPlaygroundSource(
      params,
      { kind: "project", projectId: "p1", filterCondition: "name == 'x'" },
      null
    );
    expect(Object.fromEntries(params)).toEqual({
      projectId: "p1",
      filterCondition: "name == 'x'",
    });
    writeEvaluatorPlaygroundSource(
      params,
      { kind: "project", projectId: "p1", filterCondition: "" },
      readEvaluatorPlaygroundSource(params)
    );
    expect(Object.fromEntries(params)).toEqual({ projectId: "p1" });
  });

  it("keeps slot bindings when only the filter changes", () => {
    const params = new URLSearchParams("projectId=p1&projectEvaluatorA=pe1");
    const previous = readEvaluatorPlaygroundSource(params);
    writeEvaluatorPlaygroundSource(
      params,
      {
        kind: "project",
        projectId: "p1",
        filterCondition: "span_kind == 'LLM'",
      },
      previous
    );
    expect(params.get("projectEvaluatorA")).toBe("pe1");
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
      })
    ).toEqual({ kind: "project", projectId: "p1" });
    expect(toEvaluatorSlotSource(null)).toBeNull();
  });
});

describe("getConfiguredSource", () => {
  it("replaces a dataset with a project and a project with a dataset", () => {
    expect(getConfiguredSource(dataset, { projectId: "p1" })).toEqual({
      ok: true,
      source: {
        kind: "project",
        projectId: "p1",
        filterCondition: "",
      },
    });
    expect(getConfiguredSource(project, { datasetId: "d2" })).toEqual({
      ok: true,
      source: {
        kind: "dataset",
        datasetId: "d2",
        splitIds: [],
        versionId: null,
      },
    });
    expect(getConfiguredSource(project, { projectId: null })).toEqual({
      ok: true,
      source: null,
    });
  });

  it("keeps the filter when the same project is named again", () => {
    expect(getConfiguredSource(project, { projectId: "p1" })).toEqual({
      ok: true,
      source: project,
    });
    expect(getConfiguredSource(dataset, { datasetId: "d1" })).toEqual({
      ok: true,
      source: dataset,
    });
  });

  it("refines the current source when no root is named", () => {
    expect(getConfiguredSource(dataset, { splitIds: ["s2"] })).toEqual({
      ok: true,
      source: { ...dataset, splitIds: ["s2"] },
    });
    expect(getConfiguredSource(project, { filterCondition: "" })).toEqual({
      ok: true,
      source: { ...project, filterCondition: "" },
    });
  });

  it("rejects fields of the other kind", () => {
    expect(getConfiguredSource(project, { splitIds: ["s1"] })).toMatchObject({
      ok: false,
    });
    expect(
      getConfiguredSource(dataset, { filterCondition: "name == 'x'" })
    ).toMatchObject({ ok: false });
    expect(getConfiguredSource(null, { filterCondition: "" })).toMatchObject({
      ok: false,
    });
  });
});

describe("resolveProjectScope", () => {
  const loaded = {
    filterCondition: "stored",
    samplingRate: 0.25,
    evaluationTarget: "SPAN",
  } as const;

  it("prefers the options, then the loaded scope, then the strip at 100%", () => {
    expect(
      resolveProjectScope({
        filterCondition: "typed",
        loaded,
        sourceFilterCondition: "strip",
      })
    ).toEqual({
      filterCondition: "typed",
      samplingRate: 0.25,
      evaluationTarget: "SPAN",
    });
    expect(
      resolveProjectScope({ loaded, sourceFilterCondition: "strip" })
    ).toEqual({
      filterCondition: "stored",
      samplingRate: 0.25,
      evaluationTarget: "SPAN",
    });
    expect(
      resolveProjectScope({ loaded: null, sourceFilterCondition: "strip" })
    ).toEqual({
      filterCondition: "strip",
      samplingRate: 1,
      evaluationTarget: "SPAN",
    });
  });
});
