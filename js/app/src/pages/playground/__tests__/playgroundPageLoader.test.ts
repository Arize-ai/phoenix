import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import {
  createEvaluatorTaskInstance,
  createDecisionTaskInstance,
} from "@phoenix/store/playground";

import type { PlaygroundPageLoaderFetchers } from "../playgroundPageLoader";
import {
  buildPlaygroundPropsFromLoaderData,
  createPlaygroundPageLoader,
} from "../playgroundPageLoader";

// The loader takes its fetches as a parameter, so the tests hand it these
// stand-ins and never touch the network or the modules behind it.
const fetchEvaluator =
  vi.fn<PlaygroundPageLoaderFetchers["fetchEvaluatorAsInstance"]>();

const fetchPrompt =
  vi.fn<PlaygroundPageLoaderFetchers["fetchPromptAsInstance"]>();

const fetchDecision =
  vi.fn<PlaygroundPageLoaderFetchers["fetchDecisionAsInstance"]>();

const fetchExperiment =
  vi.fn<PlaygroundPageLoaderFetchers["fetchExperimentProps"]>();

const playgroundPageLoader = createPlaygroundPageLoader({
  fetchEvaluatorAsInstance: fetchEvaluator,
  fetchPromptAsInstance: fetchPrompt,
  fetchDecisionAsInstance: fetchDecision,
  fetchExperimentProps: fetchExperiment,
});

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

  if (instance.task.type !== "evaluator") throw new Error("unreachable");

  return {
    instance: {
      ...instance,
      task: {
        type: "evaluator" as const,
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
    fetchDecision.mockReset();
  });

  it("opens a fresh decision draft from the decisions library", async () => {
    const data = await load("newDecision=true");
    expect(data?.source).toBe("task");
    if (data?.source !== "task")
      throw new Error("Expected prompt and decision tasks");
    expect(data.instances).toHaveLength(1);
    expect(data.instances[0].task.type).toBe("decision");
    expect(data.instances[0].model.modelType).toBe("DECISION");
    expect(fetchDecision).not.toHaveBeenCalled();
    expect(fetchPrompt).not.toHaveBeenCalled();
  });

  describe("experiment params", () => {
    const experiment = {
      playgroundProps: { instances: [] },
      datasetId: "dataset-1",
      splitIds: ["split-1", "split-2"],
      stateByDatasetId: {},
      selectedDatasetEvaluatorIds: [],
    };

    it("redirects to put the experiment's dataset and splits in the URL", async () => {
      fetchExperiment.mockResolvedValueOnce(experiment);
      const response = await load("experimentId=exp-1").catch(
        (thrown: unknown) => thrown
      );
      expect(response).toBeInstanceOf(Response);
      const location = new URL(
        (response as Response).headers.get("Location") ?? "",
        "http://localhost"
      );
      expect(location.pathname).toBe("/playground");
      expect(location.searchParams.get("experimentId")).toBe("exp-1");
      expect(location.searchParams.get("datasetId")).toBe("dataset-1");
      expect(location.searchParams.getAll("splitId")).toEqual([
        "split-1",
        "split-2",
      ]);
    });

    it("loads the experiment once the URL names a dataset", async () => {
      fetchExperiment.mockResolvedValueOnce(experiment);
      await expect(
        load("experimentId=exp-1&datasetId=dataset-1&splitId=split-1")
      ).resolves.toMatchObject({ source: "experiment", datasetId: "dataset-1" });
    });
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
          : source.type === "datasetEvaluator"
            ? source.datasetEvaluatorId
            : source.projectEvaluatorId
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
          instance.task.type === "evaluator" && instance.task.evaluator.name
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
      type: "evaluator",
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

  describe("decision params", () => {
    const decisionInstance = (name: string) => ({
      instance: {
        ...createDecisionTaskInstance(),
        decision: { id: name, name, versionId: `${name}-v`, tag: null },
      },
      templateFormat: TemplateFormats.FString,
    });

    const promptInstance = (name: string) =>
      ({
        instance: {
          ...createDecisionTaskInstance(),
          task: { type: "prompt" as const },
          prompt: { id: name, name, version: `${name}-v`, tag: null },
        },
        promptVersion: { templateFormat: "MUSTACHE" },
      }) as never;

    it("loads saved decisions as prompt and decision tasks, using the decision's own template format", async () => {
      fetchDecision.mockResolvedValue(decisionInstance("D1"));

      const data = await load(
        "decisionId=D1&decisionVersionId=DV1&decisionTagName="
      );

      expect(fetchDecision).toHaveBeenCalledWith({
        decisionId: "D1",
        decisionVersionId: "DV1",
        tagName: null,
        templateFormat: null,
      });
      expect(fetchPrompt).not.toHaveBeenCalled();
      if (data?.source !== "task") throw new Error("unreachable");
      expect(data.decisionParams).toEqual([
        { decisionId: "D1", decisionVersionId: "DV1", tagName: null },
      ]);
      expect(data.instances.map((i) => i.task.type)).toEqual(["decision"]);
      expect(data.templateFormat).toBe("F_STRING");
    });

    it("loads prompts then decisions on the prompts' template format, and a tag wins over the version it resolved to", async () => {
      fetchPrompt.mockResolvedValue(promptInstance("P1"));
      fetchDecision.mockResolvedValue(decisionInstance("D1"));

      const data = await load(
        "promptId=P1&promptVersionId=V1&promptTagName=&decisionId=D1&decisionVersionId=DV1&decisionTagName=prod"
      );

      expect(fetchDecision).toHaveBeenCalledWith({
        decisionId: "D1",
        decisionVersionId: null,
        tagName: "prod",
        templateFormat: "MUSTACHE",
      });
      if (data?.source !== "task") throw new Error("unreachable");
      expect(data.instances.map((i) => i.task.type)).toEqual([
        "prompt",
        "decision",
      ]);
      expect(data.templateFormat).toBe("MUSTACHE");
    });

    it("skips a decision that fails to load, and opens the default page when none loads", async () => {
      fetchDecision.mockRejectedValue(new Error("deleted"));

      expect(await load("decisionId=gone")).toBeNull();

      fetchPrompt.mockResolvedValue(promptInstance("P1"));
      const data = await load("promptId=P1&decisionId=gone");

      if (data?.source !== "task") throw new Error("unreachable");
      expect(data.instances.map((i) => i.task.type)).toEqual(["prompt"]);
    });
  });
});
