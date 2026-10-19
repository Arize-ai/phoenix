import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import type { DecisionProjectionPolicyValue } from "@phoenix/components/evaluators/decision/decisionPolicyUtils";
import type { DecisionVersionSelection } from "@phoenix/components/evaluators/decision/DecisionVersionPicker";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";
import { useEvaluatorStoreInstance } from "@phoenix/contexts/EvaluatorContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { CreateDecisionDatasetEvaluatorSlideover } from "../CreateDecisionDatasetEvaluatorSlideover";

const { commit, notifySuccess, queryData } = vi.hoisted(() => ({
  commit: vi.fn(),
  notifySuccess: vi.fn(),
  queryData: { current: { evaluators: { edges: [] as unknown[] } } },
}));

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useLazyLoadQuery: () => queryData.current,
  useMutation: (node: { params: { name: string } }) => [
    (config: object) => commit(node.params.name, config),
    false,
  ],
}));
vi.mock("@phoenix/contexts/NotificationContext", () => ({
  useNotifySuccess: () => notifySuccess,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorExampleDataset", () => ({
  EvaluatorExampleDataset: () => null,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorInputPreview", () => ({
  EvaluatorInputPreview: () => null,
}));
vi.mock("@phoenix/components/evaluators/EvaluatorInputMapping", () => ({
  EvaluatorInputMapping: function EvaluatorInputMappingStub() {
    const store = useEvaluatorStoreInstance();
    const variables = useEvaluatorInputVariables();
    return (
      <div>
        <span data-testid="mapping-variables">{variables.join(",")}</span>
        <button
          onClick={() =>
            store.getState().setPathMapping({ question: "input.question" })
          }
        >
          Map question
        </button>
      </div>
    );
  },
}));

const selection: DecisionVersionSelection = {
  decisionId: "decision-1",
  decisionName: "answer_quality",
  versionId: "version-1",
  sequenceNumber: 1,
  tagName: null,
  questions: [{ type: "predicate", name: "accurate" }],
  inputs: [{ name: "question", description: null }],
};
vi.mock(
  "@phoenix/components/evaluators/decision/DecisionVersionPicker",
  () => ({
    DecisionVersionPicker: ({
      onChange,
    }: {
      onChange: (value: DecisionVersionSelection) => void;
    }) => <button onClick={() => onChange(selection)}>Pick version</button>,
  })
);

const overridePolicy: DecisionProjectionPolicyValue = {
  questions: [
    {
      predicate: {
        name: "accurate",
        threshold: 0.9,
        optimizationDirection: "MAXIMIZE",
      },
    },
  ],
};
vi.mock(
  "@phoenix/components/evaluators/decision/DecisionProjectionPolicyEditor",
  () => ({
    DecisionProjectionPolicyEditor: ({
      inheritedPolicy,
      onChange,
    }: {
      inheritedPolicy?: unknown;
      onChange: (value: unknown) => void;
    }) => (
      <button
        onClick={() =>
          onChange(inheritedPolicy ? overridePolicy : { questions: [] })
        }
      >
        {inheritedPolicy ? "Override scoring" : "Edit judge scoring"}
      </button>
    ),
  })
);

const createdJudge = {
  id: "judge-new",
  name: "quality_judge",
  inputSchema: { properties: { question: {} } },
  projectionPolicy: { questions: [] },
  decisionVersion: {
    id: "version-1",
    sequenceNumber: 1,
    decision: { id: "decision-1", name: "answer_quality" },
    questions: [{ __typename: "DecisionPredicateQuestion", name: "accurate" }],
  },
};
const existingJudge = {
  ...createdJudge,
  __typename: "DecisionEvaluator",
  id: "judge-1",
  name: "saved_judge",
};

describe("CreateDecisionDatasetEvaluatorSlideover", () => {
  let container: HTMLDivElement;
  let root: Root;
  const onEvaluatorCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryData.current = { evaluators: { edges: [] } };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(children?: ReactNode) {
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
          {children ?? (
            <CreateDecisionDatasetEvaluatorSlideover
              isOpen
              datasetId="dataset-1"
              updateConnectionIds={["connection-1"]}
              onEvaluatorCreated={onEvaluatorCreated}
            />
          )}
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
  const type = async (selector: string, text: string) => {
    const input = document.querySelector<HTMLInputElement>(selector);
    expect(input, `${selector} should be present`).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, text);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
  };
  const submit = () => click("Create");
  const fillBindingName = () =>
    type('input[placeholder="e.g. decision_eval"]', "quality");
  const mutationCalls = (name: string) =>
    commit.mock.calls.filter(([mutation]) => mutation === name);
  const JUDGE = "CreateDecisionDatasetEvaluatorSlideover_createJudgeMutation";
  const BINDING =
    "CreateDecisionDatasetEvaluatorSlideover_createBindingMutation";

  it("creates a new judge from a version, then binds it with the input mapping", async () => {
    await render();
    await type(
      '[data-testid="decision-evaluator-judge-name-input"] input, input[data-testid="decision-evaluator-judge-name-input"]',
      "quality_judge"
    );
    await click("Pick version");
    expect(
      document.querySelector('[data-testid="mapping-variables"]')?.textContent
    ).toBe("question");
    await fillBindingName();
    await click("Map question");
    await click("Override scoring");
    await submit();
    expect(mutationCalls(JUDGE)).toHaveLength(1);
    expect(mutationCalls(JUDGE)[0][1]).toMatchObject({
      variables: {
        input: {
          name: "quality_judge",
          decisionVersionId: "version-1",
          description: null,
          projectionPolicy: null,
        },
      },
    });
    // The binding waits for the judge.
    expect(mutationCalls(BINDING)).toHaveLength(0);
    await act(async () =>
      mutationCalls(JUDGE)[0][1].onCompleted(
        { createDecisionEvaluator: { evaluator: createdJudge } },
        null
      )
    );
    expect(mutationCalls(BINDING)).toHaveLength(1);
    expect(mutationCalls(BINDING)[0][1].variables).toEqual({
      input: {
        datasetId: "dataset-1",
        evaluatorId: "judge-new",
        name: "quality",
        description: null,
        inputMapping: {
          literalMapping: {},
          pathMapping: { question: "input.question" },
        },
        projectionPolicy: overridePolicy,
      },
      connectionIds: ["connection-1"],
    });
    await act(async () =>
      mutationCalls(BINDING)[0][1].onCompleted(
        {
          createDatasetDecisionEvaluator: { evaluator: { id: "binding-1" } },
        },
        null
      )
    );
    expect(onEvaluatorCreated).toHaveBeenCalledWith("binding-1");
    expect(notifySuccess).toHaveBeenCalledWith({ title: "Evaluator created" });
  });

  it("binds an existing judge without creating one and sends a null override when inheriting", async () => {
    queryData.current = { evaluators: { edges: [{ judge: existingJudge }] } };
    await render();
    await click("Select a decision judge");
    const option = document.querySelector<HTMLElement>('[role="option"]');
    expect(option?.textContent).toContain("saved_judge");
    await act(async () => option?.click());
    await fillBindingName();
    await click("Map question");
    await submit();

    expect(mutationCalls(JUDGE)).toHaveLength(0);
    expect(mutationCalls(BINDING)).toHaveLength(1);
    expect(mutationCalls(BINDING)[0][1].variables.input).toMatchObject({
      evaluatorId: "judge-1",
      name: "quality",
      projectionPolicy: null,
    });
  });

  it("keeps a created judge selected when the binding fails, so a retry does not duplicate it", async () => {
    await render();
    await type(
      '[data-testid="decision-evaluator-judge-name-input"] input, input[data-testid="decision-evaluator-judge-name-input"]',
      "quality_judge"
    );
    await click("Pick version");
    await fillBindingName();
    await click("Map question");
    await submit();
    await act(async () =>
      mutationCalls(JUDGE)[0][1].onCompleted(
        { createDecisionEvaluator: { evaluator: createdJudge } },
        null
      )
    );
    await act(async () =>
      mutationCalls(BINDING)[0][1].onCompleted({}, [
        { message: "Input mapping is missing question" },
      ])
    );
    expect(document.body.textContent).toContain(
      "Input mapping is missing question"
    );
    expect(document.body.textContent).toContain("was created");
    expect(onEvaluatorCreated).not.toHaveBeenCalled();

    await submit();
    expect(mutationCalls(JUDGE)).toHaveLength(1);
    expect(mutationCalls(BINDING)).toHaveLength(2);
    expect(mutationCalls(BINDING)[1][1].variables.input.evaluatorId).toBe(
      "judge-new"
    );
  });
});
