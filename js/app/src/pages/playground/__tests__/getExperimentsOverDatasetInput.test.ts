import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { getExperimentsOverDatasetInput } from "@phoenix/pages/playground/experimentsOverDatasetInput";
import { createCredentialsStore, createPlaygroundStore } from "@phoenix/store";
import type { PlaygroundEvaluatorTaskKind } from "@phoenix/store/playground";
import { createPlaygroundEvaluatorTask } from "@phoenix/store/playground";

installTestStorage();

const DATASET_ID = "RGF0YXNldDox";

const EVALUATOR_MAPPINGS = {
  RGF0YXNldEV2YWx1YXRvcjox: {
    name: "correctness",
    inputMapping: { literalMapping: {}, pathMapping: { output: "output" } },
  },
};

function createStore() {
  const playgroundStore = createPlaygroundStore({
    datasetId: DATASET_ID,
    defaultModelName: "gpt-4o",
    defaultModelProvider: "OPENAI",
    modelConfigByProvider: {},
  });

  const credentials = createCredentialsStore({}).getState();

  return { playgroundStore, credentials };
}

/** Adds an evaluator draft of `kind`, named `name` when given, and returns its id. */
function addEvaluatorInstance(
  playgroundStore: ReturnType<typeof createStore>["playgroundStore"],
  kind: PlaygroundEvaluatorTaskKind,
  name?: string
) {
  const instanceId = playgroundStore.getState().addInstance({
    type: "new",
    kind,
  });

  if (instanceId == null) {
    throw new Error("Could not add an evaluator instance");
  }

  if (name != null) {
    const instance = playgroundStore
      .getState()
      .instances.find((candidate) => candidate.id === instanceId);

    if (instance?.task.kind !== "evaluator") {
      throw new Error("Expected an evaluator instance");
    }

    playgroundStore.getState().updateInstance({
      instanceId,
      patch: {
        task: {
          kind: "evaluator",
          evaluator: { ...instance.task.evaluator, name },
        },
      },
      dirty: null,
    });
  }

  return instanceId;
}

function buildInput(
  store: ReturnType<typeof createStore>,
  instanceIds?: number[]
) {
  return getExperimentsOverDatasetInput({
    ...store,
    datasetId: DATASET_ID,
    splitIds: ["split-1"],
    evaluatorMappings: EVALUATOR_MAPPINGS,
    instanceIds,
  });
}

describe("getExperimentsOverDatasetInput", () => {
  it("sends a prompt instance as a prompt task with the dataset evaluators attached", () => {
    const store = createStore();
    store.playgroundStore.getState().setRecordExperiments(false);

    const input = buildInput(store);

    expect(input).toMatchObject({
      datasetId: DATASET_ID,
      splitIds: ["split-1"],
      repetitions: 1,
      maxConcurrency: 10,
      createEphemeralExperiment: true,
    });
    expect(input.tasks).toHaveLength(1);
    const task = input.tasks[0];
    expect(task.evaluator).toBeUndefined();
    expect(task.prompt).toMatchObject({
      streamModelOutput: true,
      evaluators: [
        {
          id: "RGF0YXNldEV2YWx1YXRvcjox",
          name: "correctness",
          inputMapping:
            EVALUATOR_MAPPINGS["RGF0YXNldEV2YWx1YXRvcjox"].inputMapping,
        },
      ],
    });
    expect(task.prompt?.promptVersion.modelName).toBe("gpt-4o");
    expect(task.prompt?.promptVersion.template.messages.length).toBeGreaterThan(
      0
    );
  });

  it("sends an LLM evaluator instance inline, with its judge tool built from the output config", () => {
    const store = createStore();
    const promptInstanceId = store.playgroundStore.getState().instances[0].id;

    const instanceId = addEvaluatorInstance(
      store.playgroundStore,
      "LLM",
      "helpfulness"
    );

    store.playgroundStore.getState().deleteInstance(promptInstanceId);

    const input = buildInput(store);

    expect(input.tasks).toHaveLength(1);
    const evaluatorTask = input.tasks[0].evaluator;
    expect(evaluatorTask?.inputMapping).toEqual({
      literalMapping: {},
      pathMapping: {},
    });
    const llm = evaluatorTask?.evaluator.inlineLlmEvaluator;
    expect(llm?.name).toBe("helpfulness");
    expect(llm?.outputConfigs).toEqual([
      {
        categorical: {
          name: "result",
          optimizationDirection: "MAXIMIZE",
          values: [
            { label: "pass", score: 1 },
            { label: "fail", score: 0 },
          ],
        },
      },
    ]);
    expect(llm?.promptVersion.tools?.tools[0]?.function?.name).toBe("result");
    expect(llm?.promptVersion.template.messages.length).toBeGreaterThan(0);
    expect(
      store.playgroundStore
        .getState()
        .instances.find((instance) => instance.id === instanceId)
    ).toBeDefined();
  });

  it("sends a code evaluator instance inline with its code and sandbox", () => {
    const store = createStore();
    const promptInstanceId = store.playgroundStore.getState().instances[0].id;
    const instanceId = addEvaluatorInstance(store.playgroundStore, "CODE");
    store.playgroundStore.getState().deleteInstance(promptInstanceId);
    store.playgroundStore.getState().updateInstance({
      instanceId,
      patch: {
        task: {
          kind: "evaluator",
          evaluator: createPlaygroundEvaluatorTask({
            kind: "CODE",
            name: "no_sql_in_output",
            description: "Flags SQL in the answer",
            inputMapping: {
              literalMapping: {},
              pathMapping: { output: "output.answer" },
            },
            code: {
              language: "TYPESCRIPT",
              sourceCode:
                "export function evaluate() { return { label: 'pass' }; }",
              sandboxConfigId: "sandbox-1",
            },
          }),
        },
      },
      dirty: null,
    });

    const input = buildInput(store);

    expect(input.tasks).toHaveLength(1);
    const evaluatorTask = input.tasks[0].evaluator;
    expect(evaluatorTask?.inputMapping).toEqual({
      literalMapping: {},
      pathMapping: { output: "output.answer" },
    });
    expect(evaluatorTask?.evaluator.inlineLlmEvaluator).toBeUndefined();
    expect(evaluatorTask?.evaluator.inlineCodeEvaluator).toMatchObject({
      name: "no_sql_in_output",
      description: "Flags SQL in the answer",
      language: "TYPESCRIPT",
      sourceCode: "export function evaluate() { return { label: 'pass' }; }",
      sandboxConfigId: "sandbox-1",
    });
  });

  it("keeps the instance order, names unnamed evaluators by position, and can run a subset", () => {
    const store = createStore();
    addEvaluatorInstance(store.playgroundStore, "CODE");
    const llmInstanceId = addEvaluatorInstance(store.playgroundStore, "LLM");

    const input = buildInput(store);

    expect(input.tasks.map((task) => Object.keys(task)[0])).toEqual([
      "prompt",
      "evaluator",
      "evaluator",
    ]);
    expect(input.tasks[1].evaluator?.evaluator.inlineCodeEvaluator?.name).toBe(
      "evaluator_2"
    );
    expect(input.tasks[2].evaluator?.evaluator.inlineLlmEvaluator?.name).toBe(
      "evaluator_3"
    );

    const partial = buildInput(store, [llmInstanceId]);

    expect(partial.tasks).toHaveLength(1);
    // The evaluator keeps the name its column gives it even when run alone.
    expect(partial.tasks[0].evaluator?.evaluator.inlineLlmEvaluator?.name).toBe(
      "evaluator_3"
    );
  });

  it("scopes a row run to its examples and never records it", () => {
    const store = createStore();
    store.playgroundStore.getState().setRecordExperiments(true);
    store.playgroundStore
      .getState()
      .runPlaygroundInstances(undefined, { exampleIds: ["example-1"] });

    const input = buildInput(store);

    expect(input.exampleIds).toEqual(["example-1"]);
    expect(input.createEphemeralExperiment).toBe(true);
    expect(buildInput(createStore()).exampleIds).toBeNull();
  });

  it("refuses to build a run with no task", () => {
    const store = createStore();

    expect(() => buildInput(store, [])).toThrow("Select a task to run.");
  });
});

describe("getExperimentsOverDatasetInput experiment identity", () => {
  function getInput(
    playgroundStore: ReturnType<typeof createStore>["playgroundStore"]
  ) {
    return getExperimentsOverDatasetInput({
      playgroundStore,
      credentials: createCredentialsStore({}).getState(),
      datasetId: DATASET_ID,
      evaluatorMappings: {},
    });
  }

  it("uses persisted UI name and description when the scaffold is empty", () => {
    const { playgroundStore } = createStore();
    playgroundStore.getState().setExperimentName({
      experimentName: "  ui-name  ",
      datasetId: DATASET_ID,
    });
    playgroundStore.getState().setExperimentDescription({
      experimentDescription: "  ui-description  ",
      datasetId: DATASET_ID,
    });

    const input = getInput(playgroundStore);

    expect(input.experimentName).toBe("ui-name");
    expect(input.experimentDescription).toBe("ui-description");
  });

  it("lets the agent scaffold override UI name and description for that run", () => {
    const { playgroundStore } = createStore();
    playgroundStore.getState().setExperimentName({
      experimentName: "ui-name",
      datasetId: DATASET_ID,
    });
    playgroundStore.getState().setExperimentDescription({
      experimentDescription: "ui-description",
      datasetId: DATASET_ID,
    });
    playgroundStore.getState().setNextExperimentScaffold({
      name: "agent-name",
      description: "agent-description",
    });

    const input = getInput(playgroundStore);

    expect(input.experimentName).toBe("agent-name");
    expect(input.experimentDescription).toBe("agent-description");
  });

  it("sends null when both scaffold and UI identity are unset", () => {
    const { playgroundStore } = createStore();

    const input = getInput(playgroundStore);

    expect(input.experimentName).toBeNull();
    expect(input.experimentDescription).toBeNull();
  });
});
