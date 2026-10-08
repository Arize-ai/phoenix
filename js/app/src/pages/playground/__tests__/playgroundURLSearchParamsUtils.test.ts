import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";
import type { PlaygroundInstance } from "@phoenix/store/playground";

import type {
  PlaygroundTaskParams,
  PromptParam,
} from "../playgroundURLSearchParamsUtils";
import {
  arePlaygroundTaskParamsEqual,
  getPlaygroundTaskParams,
  parseEvaluatorTaskParams,
  parsePromptParams,
  resolvePlaygroundDatasetId,
  setPlaygroundTaskParams,
  setPromptParams,
} from "../playgroundURLSearchParamsUtils";

type TaskInstance = Pick<PlaygroundInstance, "task" | "prompt">;

const promptInstance = (id: string | null): TaskInstance => ({
  task: { kind: "prompt" },
  prompt: id ? { id, name: id, version: `${id}-v`, tag: null } : null,
});

const evaluatorInstance = (
  source: {
    evaluatorId?: string;
    datasetEvaluatorId?: string;
    projectEvaluatorId?: string;
  } = {}
): TaskInstance => ({
  task: {
    kind: "evaluator",
    evaluator: createPlaygroundEvaluatorTask({
      kind: "CODE",
      source: {
        evaluatorId: source.evaluatorId ?? null,
        datasetEvaluatorId: source.datasetEvaluatorId ?? null,
        projectEvaluatorId: source.projectEvaluatorId ?? null,
      },
    }),
  },
  prompt: null,
});

describe("parsePromptParams", () => {
  it("returns an empty array when no promptId params are present", () => {
    const searchParams = new URLSearchParams();
    expect(parsePromptParams(searchParams)).toEqual([]);
  });

  it("returns an empty array for an unrelated query string", () => {
    const searchParams = new URLSearchParams("datasetId=abc&splitId=s1");
    expect(parsePromptParams(searchParams)).toEqual([]);
  });

  it("parses a single prompt with all three params", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=V1&promptTagName=production"
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: "V1", tagName: "production" },
    ]);
  });

  it("parses a single prompt with only promptId", () => {
    const searchParams = new URLSearchParams("promptId=P1");
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: null, tagName: null },
    ]);
  });

  it("parses multiple prompts in order (compare mode)", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptId=P2&promptVersionId=V1&promptVersionId=V2&promptTagName=prod&promptTagName=staging"
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
      { promptId: "P2", promptVersionId: "V2", tagName: "staging" },
    ]);
  });

  it("treats empty string version/tag as null", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=&promptTagName="
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: null, tagName: null },
    ]);
  });

  it("handles missing version/tag arrays for later positions", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptId=P2&promptVersionId=V1"
    );
    expect(parsePromptParams(searchParams)).toEqual([
      { promptId: "P1", promptVersionId: "V1", tagName: null },
      { promptId: "P2", promptVersionId: null, tagName: null },
    ]);
  });

  it("preserves other search params (does not consume them)", () => {
    const searchParams = new URLSearchParams(
      "datasetId=DS1&promptId=P1&splitId=S1"
    );
    const result = parsePromptParams(searchParams);
    expect(result).toEqual([
      { promptId: "P1", promptVersionId: null, tagName: null },
    ]);
    // Original params are not modified
    expect(searchParams.get("datasetId")).toBe("DS1");
    expect(searchParams.get("splitId")).toBe("S1");
  });
});

describe("setPromptParams", () => {
  it("returns false and makes no changes when params already match", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=V1&promptTagName=prod"
    );
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
    ];
    const changed = setPromptParams({ searchParams, prompts });
    expect(changed).toBe(false);
    expect(searchParams.getAll("promptId")).toEqual(["P1"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V1"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["prod"]);
  });

  it("returns true and sets params when they differ", () => {
    const searchParams = new URLSearchParams();
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
    ];
    const changed = setPromptParams({ searchParams, prompts });
    expect(changed).toBe(true);
    expect(searchParams.getAll("promptId")).toEqual(["P1"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V1"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["prod"]);
  });

  it("clears existing prompt params when given an empty array", () => {
    const searchParams = new URLSearchParams(
      "promptId=P1&promptVersionId=V1&promptTagName=prod"
    );
    const changed = setPromptParams({ searchParams, prompts: [] });
    expect(changed).toBe(true);
    expect(searchParams.getAll("promptId")).toEqual([]);
    expect(searchParams.getAll("promptVersionId")).toEqual([]);
    expect(searchParams.getAll("promptTagName")).toEqual([]);
  });

  it("preserves non-prompt search params", () => {
    const searchParams = new URLSearchParams("datasetId=DS1&splitId=S1");
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: null },
    ];
    setPromptParams({ searchParams, prompts });
    expect(searchParams.get("datasetId")).toBe("DS1");
    expect(searchParams.get("splitId")).toBe("S1");
    expect(searchParams.getAll("promptId")).toEqual(["P1"]);
  });

  it("sets multiple prompts in order", () => {
    const searchParams = new URLSearchParams();
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: "V1", tagName: "prod" },
      { promptId: "P2", promptVersionId: "V2", tagName: null },
    ];
    setPromptParams({ searchParams, prompts });
    expect(searchParams.getAll("promptId")).toEqual(["P1", "P2"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V1", "V2"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["prod", ""]);
  });

  it("converts null version/tag to empty string", () => {
    const searchParams = new URLSearchParams();
    const prompts: PromptParam[] = [
      { promptId: "P1", promptVersionId: null, tagName: null },
    ];
    setPromptParams({ searchParams, prompts });
    expect(searchParams.getAll("promptVersionId")).toEqual([""]);
    expect(searchParams.getAll("promptTagName")).toEqual([""]);
  });

  it("replaces existing prompts when the set changes", () => {
    const searchParams = new URLSearchParams(
      "promptId=OLD&promptVersionId=V_OLD&promptTagName=old_tag"
    );
    const prompts: PromptParam[] = [
      { promptId: "NEW", promptVersionId: "V_NEW", tagName: "new_tag" },
    ];
    const changed = setPromptParams({ searchParams, prompts });
    expect(changed).toBe(true);
    expect(searchParams.getAll("promptId")).toEqual(["NEW"]);
    expect(searchParams.getAll("promptVersionId")).toEqual(["V_NEW"]);
    expect(searchParams.getAll("promptTagName")).toEqual(["new_tag"]);
  });

  it("returns false when clearing already-empty params", () => {
    const searchParams = new URLSearchParams("datasetId=DS1");
    const changed = setPromptParams({ searchParams, prompts: [] });
    expect(changed).toBe(false);
  });
});

describe("resolvePlaygroundDatasetId", () => {
  it("outside experiment mode: prefers the URL datasetId over the store copy", () => {
    const searchParams = new URLSearchParams("datasetId=ds-url");
    expect(
      resolvePlaygroundDatasetId({ searchParams, storeDatasetId: null })
    ).toBe("ds-url");
  });

  it("outside experiment mode: is URL-primary — returns null when the URL has no datasetId even if the store has one", () => {
    // The page store is never re-synced from the URL, so the helper must NOT fall
    // back to a (possibly stale) store value here; that would keep the page wrongly
    // in dataset mode after a back/forward nav that clears the URL datasetId. The
    // post-load_dataset race fallback lives at the imperative tool call site instead.
    const searchParams = new URLSearchParams();
    expect(
      resolvePlaygroundDatasetId({ searchParams, storeDatasetId: "ds-store" })
    ).toBeNull();
  });

  it("in experiment mode: resolves from the store, ignoring the URL datasetId", () => {
    const searchParams = new URLSearchParams(
      "experimentId=exp-1&datasetId=ds-url"
    );
    expect(
      resolvePlaygroundDatasetId({ searchParams, storeDatasetId: "ds-store" })
    ).toBe("ds-store");
  });

  it("in experiment mode: returns null when the store datasetId is null", () => {
    const searchParams = new URLSearchParams("experimentId=exp-1");
    expect(
      resolvePlaygroundDatasetId({ searchParams, storeDatasetId: null })
    ).toBeNull();
  });
});

describe("parseEvaluatorTaskParams", () => {
  it("is a prompt page when nothing names an evaluator", () => {
    expect(
      parseEvaluatorTaskParams(new URLSearchParams("promptId=P1&datasetId=D"))
    ).toEqual({ isEvaluatorKind: false, evaluators: [] });
  });

  it("orders tasks by position and compacts gaps", () => {
    expect(
      parseEvaluatorTaskParams(
        new URLSearchParams("evaluator2=E2&datasetEvaluator0=DE0")
      )
    ).toEqual({
      isEvaluatorKind: true,
      evaluators: [
        {
          evaluatorId: null,
          datasetEvaluatorId: "DE0",
          projectEvaluatorId: null,
        },
        {
          evaluatorId: "E2",
          datasetEvaluatorId: null,
          projectEvaluatorId: null,
        },
      ],
    });
  });

  it("marks a fresh draft page with taskKind=evaluator alone", () => {
    expect(
      parseEvaluatorTaskParams(new URLSearchParams("taskKind=evaluator"))
    ).toEqual({ isEvaluatorKind: true, evaluators: [] });
  });

  it("ignores empty values and unrelated params", () => {
    expect(
      parseEvaluatorTaskParams(
        new URLSearchParams("evaluator0=&evaluatorSlot=A&evaluatorA=old")
      )
    ).toEqual({ isEvaluatorKind: false, evaluators: [] });
  });
});

describe("getPlaygroundTaskParams", () => {
  it("names saved prompts and leaves out prompt tasks without one", () => {
    expect(
      getPlaygroundTaskParams([promptInstance("P1"), promptInstance(null)])
    ).toEqual({
      kind: "prompt",
      prompts: [{ promptId: "P1", promptVersionId: "P1-v", tagName: null }],
    });
  });

  it("keeps evaluator positions, with null for drafts", () => {
    expect(
      getPlaygroundTaskParams([
        evaluatorInstance(),
        evaluatorInstance({
          evaluatorId: "E1",
          datasetEvaluatorId: "DE1",
        }),
      ])
    ).toEqual({
      kind: "evaluator",
      evaluators: [
        null,
        {
          evaluatorId: "E1",
          datasetEvaluatorId: "DE1",
          projectEvaluatorId: null,
        },
      ],
    });
  });
});

describe("arePlaygroundTaskParamsEqual", () => {
  it("compares within a kind and never across kinds", () => {
    const prompts: PlaygroundTaskParams = {
      kind: "prompt",
      prompts: [{ promptId: "P1", promptVersionId: null, tagName: null }],
    };

    const evaluators: PlaygroundTaskParams = {
      kind: "evaluator",
      evaluators: [
        {
          evaluatorId: "E1",
          datasetEvaluatorId: null,
          projectEvaluatorId: null,
        },
      ],
    };

    expect(arePlaygroundTaskParamsEqual(prompts, { ...prompts })).toBe(true);
    expect(arePlaygroundTaskParamsEqual(prompts, evaluators)).toBe(false);
    expect(
      arePlaygroundTaskParamsEqual(evaluators, {
        kind: "evaluator",
        evaluators: [
          {
            evaluatorId: "E1",
            datasetEvaluatorId: null,
            projectEvaluatorId: null,
          },
        ],
      })
    ).toBe(true);
    expect(
      arePlaygroundTaskParamsEqual(evaluators, {
        kind: "evaluator",
        evaluators: [null],
      })
    ).toBe(false);
  });
});

describe("setPlaygroundTaskParams", () => {
  it("writes evaluator tasks by position, preferring the dataset evaluator, and clears prompt params", () => {
    const searchParams = new URLSearchParams(
      "datasetId=D&promptId=P1&promptVersionId=V1&promptTagName="
    );

    const changed = setPlaygroundTaskParams({
      searchParams,
      tasks: {
        kind: "evaluator",
        evaluators: [
          null,
          {
            evaluatorId: "E1",
            datasetEvaluatorId: "DE1",
            projectEvaluatorId: null,
          },
          {
            evaluatorId: "E2",
            datasetEvaluatorId: null,
            projectEvaluatorId: null,
          },
        ],
      },
    });

    expect(changed).toBe(true);
    expect(searchParams.toString()).toBe(
      "datasetId=D&taskKind=evaluator&datasetEvaluator1=DE1&evaluator2=E2"
    );
  });

  it("round-trips through parseEvaluatorTaskParams", () => {
    const searchParams = new URLSearchParams();
    setPlaygroundTaskParams({
      searchParams,
      tasks: {
        kind: "evaluator",
        evaluators: [
          {
            evaluatorId: "E0",
            datasetEvaluatorId: null,
            projectEvaluatorId: null,
          },
          null,
        ],
      },
    });
    expect(parseEvaluatorTaskParams(searchParams)).toEqual({
      isEvaluatorKind: true,
      evaluators: [
        {
          evaluatorId: "E0",
          datasetEvaluatorId: null,
          projectEvaluatorId: null,
        },
      ],
    });
  });

  it("reports no change when the evaluator params are already in sync", () => {
    const searchParams = new URLSearchParams(
      "taskKind=evaluator&evaluator0=E0"
    );

    expect(
      setPlaygroundTaskParams({
        searchParams,
        tasks: {
          kind: "evaluator",
          evaluators: [
            {
              evaluatorId: "E0",
              datasetEvaluatorId: null,
              projectEvaluatorId: null,
            },
          ],
        },
      })
    ).toBe(false);
  });

  it("clears evaluator params when the page holds prompts", () => {
    const searchParams = new URLSearchParams(
      "taskKind=evaluator&evaluator0=E0&datasetId=D"
    );

    const changed = setPlaygroundTaskParams({
      searchParams,
      tasks: {
        kind: "prompt",
        prompts: [{ promptId: "P1", promptVersionId: "V1", tagName: null }],
      },
    });

    expect(changed).toBe(true);
    expect(searchParams.toString()).toBe(
      "datasetId=D&promptId=P1&promptVersionId=V1&promptTagName="
    );
  });

  it("reports no change for an unsaved prompt draft on a clean URL", () => {
    const searchParams = new URLSearchParams("datasetId=D");
    expect(
      setPlaygroundTaskParams({
        searchParams,
        tasks: { kind: "prompt", prompts: [] },
      })
    ).toBe(false);
  });
});
