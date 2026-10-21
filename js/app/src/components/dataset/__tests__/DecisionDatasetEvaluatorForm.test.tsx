import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { Dialog } from "@phoenix/components/core/dialog";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { createDecisionQuestion } from "@phoenix/pages/playground/decisionUtils";
import { DEFAULT_STORE_VALUES } from "@phoenix/store/evaluatorStore";
import { createDecisionTaskInstance } from "@phoenix/store/playground";

import { DecisionDatasetEvaluatorForm } from "../DecisionDatasetEvaluatorForm";
import type { DecisionEvaluatorData } from "../decisionDatasetEvaluatorUtils";

const { commit, notifySuccess, loadVersion } = vi.hoisted(() => ({
  commit: vi.fn(),
  notifySuccess: vi.fn(),
  loadVersion: vi.fn(),
}));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: (node: { params: { name: string } }) => [
    (config: object) => commit(node.params.name, config),
    false,
  ],
}));
vi.mock("@phoenix/contexts/NotificationContext", () => ({
  useNotifySuccess: () => notifySuccess,
}));
vi.mock("@phoenix/contexts/CredentialsContext", () => ({
  useCredentialsContext: (selector: (state: object) => unknown) => selector({}),
}));
vi.mock("@phoenix/pages/playground/fetchPlaygroundDecision", () => ({
  fetchPlaygroundDecisionAsInstance: (...args: unknown[]) =>
    loadVersion(...args),
}));
vi.mock("@phoenix/components/generative", () => ({
  ModelMenu: () => <span>Decision model</span>,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorExampleDataset", () => ({
  EvaluatorExampleDataset: () => null,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorInputPreview", () => ({
  EvaluatorInputPreview: () => null,
}));
vi.mock(
  "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields",
  () => ({ EvaluatorNameAndDescriptionFields: () => null })
);
vi.mock("@phoenix/components/evaluators/EvaluatorInputMapping", () => ({
  EvaluatorInputMapping: () => {
    const variables = useEvaluatorInputVariables();
    const store = useEvaluatorStoreInstance();
    return (
      <>
        <span data-testid="variables">{variables.join(",")}</span>
        <button
          onClick={() => store.getState().setPathMapping({ answer: "output" })}
        >
          Map answer
        </button>
      </>
    );
  },
}));
vi.mock("@phoenix/pages/playground/DecisionRequestEditor", () => ({
  DecisionRequestEditor: () => {
    const store = usePlaygroundStore();
    return (
      <button
        onClick={() => {
          const instance = store.getState().instances[0];
          store.getState().updateInstance({
            instanceId: 1,
            patch: {
              model: {
                ...instance.model,
                modelName: "tev1",
                provider: "TYPESAFE",
                modelType: "DECISION",
              },
              decisionRequest: {
                state: "answer",
                stateEditorMode: "inputs",
                questions: [
                  createDecisionQuestion({
                    type: "predicate",
                    name: "relevant",
                    instructions: "Evaluate this revised question",
                  }),
                ],
              },
            },
            dirty: true,
          });
        }}
      >
        Author revised Decision
      </button>
    );
  },
}));
vi.mock(
  "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor",
  () => ({
    DecisionScoringPolicyEditor: ({
      onChange,
    }: {
      onChange: (value: object) => void;
    }) => (
      <button
        onClick={() =>
          onChange({
            questions: [
              {
                predicate: {
                  name: "relevant",
                  threshold: 0.9,
                  optimizationDirection: "MAXIMIZE",
                },
              },
            ],
          })
        }
      >
        Change threshold
      </button>
    ),
  })
);
vi.mock(
  "@phoenix/components/evaluators/decision/DecisionVersionPicker",
  () => ({
    DecisionVersionPicker: ({
      onChange,
    }: {
      onChange: (selection: object) => void;
    }) => (
      <button
        onClick={() =>
          onChange({
            decisionId: "decision-1",
            decisionName: "saved-decision",
            versionId: "version-2",
            tagName: null,
            inputs: [],
            questions: [],
          })
        }
      >
        Pick saved version
      </button>
    ),
  })
);
vi.mock("@phoenix/pages/playground/DecisionVersionSelector", () => ({
  DecisionVersionSelector: ({
    onSelectVersion,
  }: {
    onSelectVersion: (id: string) => void;
  }) => (
    <button onClick={() => onSelectVersion("version-2")}>Pick version 2</button>
  ),
}));

installTestStorage();
const saved: DecisionEvaluatorData = {
  id: "evaluator-1",
  name: "saved-evaluator",
  inputSchema: { properties: { answer: {} } },
  scoringPolicy: {
    questions: [
      {
        __typename: "DecisionPredicateScoring",
        name: "relevant",
        threshold: 0.5,
        optimizationDirection: "NONE",
      },
    ],
  },
  decisionVersion: {
    id: "version-1",
    decision: { id: "decision-1", name: "saved-decision" },
    questions: [{ __typename: "DecisionPredicateQuestion", name: "relevant" }],
  },
};
const CREATE = "DecisionDatasetEvaluatorForm_createMutation";
const UPDATE = "DecisionDatasetEvaluatorForm_updateMutation";
const PREVIEW = "DecisionDatasetEvaluatorForm_previewMutation";

describe("Decision dataset evaluator authoring", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onClose = vi.fn();
  const onSaved = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    loadVersion.mockImplementation(
      ({ decisionVersionId }: { decisionVersionId: string }) =>
        Promise.resolve({
          templateFormat: "MUSTACHE",
          instance: {
            ...createDecisionTaskInstance(),
            model: {
              provider: "TYPESAFE",
              modelName: "tev1",
              modelType: "DECISION",
              invocationParameters: [],
            },
            decision: {
              id: "decision-1",
              name: "saved-decision",
              versionId: decisionVersionId,
              tag: null,
            },
            decisionRequest: {
              state: "answer",
              stateEditorMode: "inputs",
              questions: [
                createDecisionQuestion({
                  type: "predicate",
                  name: "relevant",
                  instructions: "Original instruction",
                }),
              ],
            },
          },
        })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  async function render(isEditing = false) {
    await act(async () =>
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            themeMode: "light",
            systemTheme: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <Dialog aria-label="Decision evaluator">
            <EvaluatorStoreProvider
              initialState={{
                ...DEFAULT_STORE_VALUES,
                evaluator: {
                  ...DEFAULT_STORE_VALUES.evaluator,
                  kind: "DECISION",
                  isBuiltin: false,
                  name: "quality",
                  globalName: "quality",
                  description: "",
                  inputMapping: {
                    pathMapping: { answer: "input.answer" },
                    literalMapping: {},
                  },
                },
                datasetEvaluator: isEditing ? { id: "binding-1" } : undefined,
              }}
            >
              <DecisionDatasetEvaluatorForm
                datasetId="dataset-1"
                datasetEvaluatorId={isEditing ? "binding-1" : undefined}
                initialEvaluator={isEditing ? saved : undefined}
                onClose={onClose}
                onSaved={onSaved}
              />
            </EvaluatorStoreProvider>
          </Dialog>
        </ThemeContext.Provider>
      )
    );
  }
  async function click(label: string) {
    const button = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === label
    );
    expect(button, label).toBeDefined();
    await act(async () => button?.click());
  }
  const calls = (name: string) =>
    commit.mock.calls.filter(([operation]) => operation === name);

  it("starts from a state the selected example can fill", async () => {
    await render();
    expect(document.querySelector("[data-testid=variables]")?.textContent).toBe(
      "output"
    );
    expect(document.body.textContent).not.toContain("Saved evaluator name");
  });
  it("asks for a decision model when a test has none", async () => {
    await render();
    await click("Test");
    expect(calls(PREVIEW)).toHaveLength(0);
    expect(document.body.textContent).toContain(
      "Pick a decision model to test."
    );
    expect(document.body.textContent).not.toContain(
      "Pick a decision model to save."
    );
  });
  it("previews the unsaved definition, scoring and current mapping without saving", async () => {
    await render();
    await click("Author revised Decision");
    await click("Change threshold");
    await click("Map answer");
    await click("Test");
    expect(calls(CREATE)).toHaveLength(0);
    expect(calls(PREVIEW)).toHaveLength(1);
    expect(calls(PREVIEW)[0][1].variables.input.previews[0]).toMatchObject({
      evaluator: {
        inlineDecisionEvaluator: {
          name: "quality",
          decisionVersion: {
            modelName: "tev1",
            questions: [
              {
                predicate: {
                  name: "relevant",
                  instructions: "Evaluate this revised question",
                },
              },
            ],
          },
          scoringPolicy: { questions: [{ predicate: { threshold: 0.9 } }] },
        },
      },
      inputMapping: { pathMapping: { answer: "output" } },
    });
  });
  it("creates the Decision and evaluator with the binding in one request", async () => {
    await render();
    await click("Author revised Decision");
    await click("Create");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(calls(CREATE)[0][1].variables.input).toMatchObject({
      datasetId: "dataset-1",
      name: "quality",
      evaluatorName: "quality",
      decisionVersion: { modelName: "tev1" },
      inputMapping: { pathMapping: { answer: "input.answer" } },
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () =>
      calls(CREATE)[0][1].onCompleted(
        {
          createDatasetDecisionEvaluator: { evaluator: { id: "binding-new" } },
        },
        null
      )
    );
    expect(onSaved).toHaveBeenCalledWith("binding-new");
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("keeps the draft after a failed save and retries the same atomic operation", async () => {
    await render();
    await click("Author revised Decision");
    await click("Create");
    await act(async () =>
      calls(CREATE)[0][1].onCompleted(null, [
        { message: "Name already exists" },
      ])
    );
    expect(document.body.textContent).toContain("Name already exists");
    expect(onClose).not.toHaveBeenCalled();
    await click("Create");
    expect(calls(CREATE)).toHaveLength(2);
    expect(calls(CREATE)[1][1].variables).toEqual(
      calls(CREATE)[0][1].variables
    );
  });
  it("uses the selected saved version without creating a duplicate Decision version", async () => {
    await render();
    await click("Pick saved version");
    await click("Create");
    const input = calls(CREATE)[0][1].variables.input;
    expect(input.decisionVersionId).toBe("version-2");
    expect(input.decisionVersion).toBeUndefined();
  });
  it("saves edits to a selected Decision as another version of that Decision", async () => {
    await render();
    await click("Pick saved version");
    await click("Author revised Decision");
    await click("Create");
    expect(calls(CREATE)[0][1].variables.input).toMatchObject({
      decisionId: "decision-1",
      decisionVersion: {
        questions: [
          { predicate: { instructions: "Evaluate this revised question" } },
        ],
      },
    });
  });
  it("does not create a new Decision version for a mapping-only edit", async () => {
    await render(true);
    await click("Map answer");
    await click("Update");
    expect(commit).toHaveBeenCalledTimes(1);
    const input = calls(UPDATE)[0][1].variables.input;
    expect(input.decisionVersion).toBeUndefined();
    expect(input.decisionVersionId).toBeUndefined();
    expect(input.inputMapping.pathMapping).toEqual({ answer: "output" });
  });
  it("saves definition, scoring and mapping edits together", async () => {
    await render(true);
    await click("Author revised Decision");
    await click("Change threshold");
    await click("Map answer");
    await click("Update");
    expect(commit).toHaveBeenCalledTimes(1);
    expect(calls(UPDATE)[0][1].variables.input).toMatchObject({
      datasetEvaluatorId: "binding-1",
      decisionVersion: {
        questions: [
          { predicate: { instructions: "Evaluate this revised question" } },
        ],
      },
      scoringPolicy: { questions: [{ predicate: { threshold: 0.9 } }] },
      inputMapping: { pathMapping: { answer: "output" } },
    });
  });
  it("can repin an evaluator to another saved version without creating a version", async () => {
    await render(true);
    await click("Pick version 2");
    await click("Update");
    const input = calls(UPDATE)[0][1].variables.input;
    expect(input.decisionVersionId).toBe("version-2");
    expect(input.decisionVersion).toBeUndefined();
  });
});
