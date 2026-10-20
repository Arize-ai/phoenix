import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import type { DecisionScoringPolicyValue } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { EditDecisionDatasetEvaluatorSlideover } from "../EditDecisionDatasetEvaluatorSlideover";

const { commit, notifySuccess, queryData, versionData } = vi.hoisted(() => ({
  commit: vi.fn(),
  notifySuccess: vi.fn(),
  queryData: { current: {} as unknown },
  versionData: { current: {} as unknown },
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useLazyLoadQuery: () => queryData.current,
  useRelayEnvironment: () => ({}),
  fetchQuery: () => ({
    toPromise: () => Promise.resolve(versionData.current),
  }),
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
vi.mock("@phoenix/components/evaluators/EvaluatorExampleDataset", () => ({
  EvaluatorExampleDataset: () => null,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorInputPreview", () => ({
  EvaluatorInputPreview: () => null,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorInputMapping", () => ({
  EvaluatorInputMapping: () => null,
}));
vi.mock("@phoenix/pages/playground/DecisionVersionSelector", () => ({
  DecisionVersionSelector: ({
    onSelectVersion,
  }: {
    onSelectVersion: (versionId: string) => void;
  }) => (
    <button onClick={() => onSelectVersion("version-2")}>Pin version 2</button>
  ),
}));

const evaluatorEdit: DecisionScoringPolicyValue = {
  questions: [
    {
      predicate: {
        name: "accurate",
        threshold: 0.8,
        optimizationDirection: "NONE",
      },
    },
  ],
};
vi.mock(
  "@phoenix/components/evaluators/decision/DecisionScoringPolicyEditor",
  () => ({
    DecisionScoringPolicyEditor: ({
      onChange,
    }: {
      onChange: (value: unknown) => void;
    }) => (
      <button onClick={() => onChange(evaluatorEdit)}>
        Edit evaluator scoring
      </button>
    ),
  })
);

const predicateScoring = {
  __typename: "DecisionPredicateScoring",
  name: "accurate",
  optimizationDirection: "NONE",
  threshold: 0.5,
};
const versionQuestions = [
  { __typename: "DecisionPredicateQuestion", name: "accurate" },
];

function buildQueryData() {
  return {
    dataset: {
      datasetEvaluator: {
        id: "binding-1",
        name: "quality",
        description: "Is it good",
        inputMapping: {
          literalMapping: {},
          pathMapping: { question: "input.question" },
        },
        evaluator: {
          __typename: "DecisionEvaluator",
          id: "evaluator-1",
          name: "saved_evaluator",
          inputSchema: { properties: { question: {} } },
          datasetEvaluators: [{ id: "binding-1" }, { id: "binding-2" }],
          scoringPolicy: { questions: [predicateScoring] },
          decisionVersion: {
            id: "version-1",
            sequenceNumber: 1,
            decision: { id: "decision-1", name: "answer_quality" },
            questions: versionQuestions,
          },
        },
      },
    },
  };
}

const PATCH = "EditDecisionDatasetEvaluatorSlideover_patchEvaluatorMutation";
const BINDING = "EditDecisionDatasetEvaluatorSlideover_updateBindingMutation";
const PREVIEW = "EditDecisionDatasetEvaluatorSlideover_previewMutation";

describe("EditDecisionDatasetEvaluatorSlideover", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryData.current = buildQueryData();
    versionData.current = {
      decision: {
        version: {
          id: "version-2",
          sequenceNumber: 2,
          inputs: [{ name: "question" }],
          questions: versionQuestions,
        },
      },
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render() {
    await act(async () => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "dark",
            themeMode: "dark",
            systemTheme: "dark",
            setThemeMode: vi.fn(),
          }}
        >
          <EditDecisionDatasetEvaluatorSlideover
            isOpen
            datasetId="dataset-1"
            datasetEvaluatorId="binding-1"
            updateConnectionIds={["connection-1"]}
            onUpdate={onUpdate}
          />
        </ThemeContext.Provider>
      );
    });
  }
  const click = async (label: string) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === label
    );
    expect(button, `Button ${label} should be present`).toBeDefined();
    await act(async () => button?.click());
  };
  const calls = (name: string) =>
    commit.mock.calls.filter(([mutation]) => mutation === name);

  it("updates only the binding when the evaluator is unchanged", async () => {
    await render();
    await click("Update");

    expect(calls(PATCH)).toHaveLength(0);
    expect(calls(BINDING)).toHaveLength(1);
    expect(calls(BINDING)[0][1].variables).toEqual({
      input: {
        datasetEvaluatorId: "binding-1",
        name: "quality",
        description: "Is it good",
        inputMapping: {
          literalMapping: {},
          pathMapping: { question: "input.question" },
        },
      },
      connectionIds: ["connection-1"],
    });
    await act(async () =>
      calls(BINDING)[0][1].onCompleted(
        { updateDatasetDecisionEvaluator: { evaluator: { id: "binding-1" } } },
        null
      )
    );
    expect(notifySuccess).toHaveBeenCalledWith({ title: "Evaluator updated" });
    expect(onUpdate).toHaveBeenCalled();
  });

  it("warns that evaluator changes affect every dataset using the evaluator", async () => {
    await render();
    const warning = document.querySelector(
      '[data-testid="decision-evaluator-evaluator-warning"]'
    );
    expect(warning?.textContent).toContain(
      "every dataset using this evaluator"
    );
    expect(warning?.textContent).toContain("1 other dataset evaluator uses");
    expect(warning?.textContent).toContain("refused");
  });

  it("patches the evaluator before the binding when the version is repinned", async () => {
    await render();
    await click("Pin version 2");
    await click("Update");

    expect(calls(PATCH)).toHaveLength(1);
    expect(calls(PATCH)[0][1].variables.input).toMatchObject({
      evaluatorId: "evaluator-1",
      decisionVersionId: "version-2",
    });
    expect(calls(BINDING)).toHaveLength(0);
    await act(async () =>
      calls(PATCH)[0][1].onCompleted({ patchDecisionEvaluator: {} }, null)
    );
    expect(calls(BINDING)).toHaveLength(1);
  });

  it("drops removed input paths and literals when selecting another version", async () => {
    const data = buildQueryData();
    queryData.current = {
      ...data,
      dataset: {
        ...data.dataset,
        datasetEvaluator: {
          ...data.dataset.datasetEvaluator,
          inputMapping: {
            pathMapping: {
              question: "input.question",
              removed: "input.removed",
            },
            literalMapping: { removedLiteral: "obsolete" },
          },
        },
      },
    };
    await render();
    await click("Pin version 2");
    await click("Update");
    await act(async () =>
      calls(PATCH)[0][1].onCompleted({ patchDecisionEvaluator: {} }, null)
    );
    expect(calls(BINDING)[0][1].variables.input.inputMapping).toEqual({
      pathMapping: { question: "input.question" },
      literalMapping: {},
    });
  });

  it("shows the server's refusal and saves nothing else when the evaluator change is refused", async () => {
    await render();
    await click("Edit evaluator scoring");
    await click("Update");
    expect(calls(PATCH)[0][1].variables.input).toEqual({
      evaluatorId: "evaluator-1",
      scoringPolicy: evaluatorEdit,
    });
    await act(async () =>
      calls(PATCH)[0][1].onCompleted({}, [
        { message: "Breaks dataset evaluator other_binding" },
      ])
    );
    expect(document.body.textContent).toContain(
      "Breaks dataset evaluator other_binding"
    );
    expect(calls(BINDING)).toHaveLength(0);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("previews the saved evaluator as this dataset's evaluator", async () => {
    await render();
    await click("Test");
    expect(calls(PREVIEW)).toHaveLength(1);
    const [item] = calls(PREVIEW)[0][1].variables.input.previews;
    expect(item.evaluator).toEqual({ decisionEvaluatorId: "evaluator-1" });
    expect(item.datasetEvaluatorId).toBe("binding-1");
    expect(document.body.textContent).toContain(
      "runs the evaluator as this dataset's evaluator"
    );
  });
});
