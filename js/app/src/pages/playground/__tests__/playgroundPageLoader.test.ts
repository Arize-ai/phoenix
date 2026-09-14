import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEvaluatorTaskInstance } from "@phoenix/store/playground";

import { fetchPlaygroundEvaluatorAsInstance } from "../fetchPlaygroundEvaluator";
import { fetchPlaygroundPromptAsInstance } from "../fetchPlaygroundPrompt";
import {
  buildPlaygroundPropsFromLoaderData,
  playgroundPageLoader,
} from "../playgroundPageLoader";

vi.mock("../fetchPlaygroundEvaluator", () => ({
  fetchPlaygroundEvaluatorAsInstance: vi.fn(),
}));
vi.mock("../fetchPlaygroundPrompt", () => ({
  fetchPlaygroundPromptAsInstance: vi.fn(),
}));
vi.mock("../experimentRehydration", () => ({
  fetchExperimentPlaygroundProps: vi.fn(),
}));

const fetchEvaluator = vi.mocked(fetchPlaygroundEvaluatorAsInstance);
const fetchPrompt = vi.mocked(fetchPlaygroundPromptAsInstance);

function load(search: string) {
  const url = new URL(`http://localhost/playground?${search}`);
  return playgroundPageLoader({
    request: new Request(url),
    url,
    pattern: "/playground",
    params: {},
    context: new RouterContextProvider(),
  });
}

function codeEvaluator(name: string) {
  const instance = createEvaluatorTaskInstance({ kind: "CODE" });
  if (instance.task.kind !== "evaluator") throw new Error("unreachable");
  return {
    instance: {
      ...instance,
      task: {
        kind: "evaluator" as const,
        evaluator: { ...instance.task.evaluator, name },
      },
    },
    templateFormat: null,
  };
}

describe("playgroundPageLoader", () => {
  beforeEach(() => {
    fetchEvaluator.mockReset();
    fetchPrompt.mockReset();
  });

  it("returns null with no task params", async () => {
    expect(await load("datasetId=D")).toBeNull();
    expect(fetchEvaluator).not.toHaveBeenCalled();
    expect(fetchPrompt).not.toHaveBeenCalled();
  });

  it("loads evaluator tasks in position order, by binding or evaluator id", async () => {
    fetchEvaluator.mockImplementation(async (source) =>
      codeEvaluator(
        source.type === "evaluator"
          ? source.evaluatorId
          : source.datasetEvaluatorId
      )
    );

    const data = await load("datasetEvaluator1=DE1&evaluator0=E0&datasetId=D");

    expect(fetchEvaluator).toHaveBeenCalledWith({
      type: "evaluator",
      evaluatorId: "E0",
    });
    expect(fetchEvaluator).toHaveBeenCalledWith({
      type: "datasetEvaluator",
      datasetEvaluatorId: "DE1",
    });
    expect(data?.source).toBe("evaluator");
    if (data?.source !== "evaluator") throw new Error("unreachable");
    expect(
      data.instances.map(
        (instance) =>
          instance.task.kind === "evaluator" && instance.task.evaluator.name
      )
    ).toEqual(["E0", "DE1"]);
    expect(data.templateFormat).toBe("MUSTACHE");
  });

  it("skips evaluators that fail to load and keeps the rest", async () => {
    fetchEvaluator
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(codeEvaluator("second"));

    const data = await load("evaluator0=gone&evaluator1=E1");

    if (data?.source !== "evaluator") throw new Error("unreachable");
    expect(data.instances).toHaveLength(1);
  });

  it("opens a fresh LLM evaluator draft for taskKind=evaluator with nothing loadable", async () => {
    fetchEvaluator.mockRejectedValue(new Error("deleted"));

    const data = await load("taskKind=evaluator&evaluator0=gone");

    if (data?.source !== "evaluator") throw new Error("unreachable");
    expect(data.instances).toHaveLength(1);
    expect(data.instances[0].task).toMatchObject({
      kind: "evaluator",
      evaluator: { kind: "LLM", source: { evaluatorId: null } },
    });
    const props = buildPlaygroundPropsFromLoaderData(data);
    expect(props.instances).toHaveLength(1);
    expect(props.instances?.[0].id).toEqual(expect.any(Number));
  });

  it("still loads prompt params when no evaluator params are present", async () => {
    fetchPrompt.mockResolvedValue(null);

    await load("promptId=P1");

    expect(fetchPrompt).toHaveBeenCalledWith({
      promptId: "P1",
      promptVersionId: null,
      tagName: null,
    });
    expect(fetchEvaluator).not.toHaveBeenCalled();
  });
});
