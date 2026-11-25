import { act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import { createMockEnvironment } from "relay-test-utils";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { Dialog } from "@phoenix/components/core/dialog";
import type { DecisionEvaluatorData } from "@phoenix/components/evaluators/decision/decisionEvaluatorUtils";
import {
  createDecisionQuestion,
  createDecisionStateDraft,
} from "@phoenix/components/playground/decisionUtils";
import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { CreateProjectDecisionEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectDecisionEvaluatorDialogContent";
import {
  DEFAULT_EVALUATION_DELAY_SECONDS,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { DEFAULT_STORE_VALUES } from "@phoenix/store/evaluatorStore";
import { createDecisionTaskInstance } from "@phoenix/store/playground";

const { commit, onSuccess, relay, loadVersion } = vi.hoisted(() => ({
  commit: vi.fn(),
  onSuccess: vi.fn(),
  relay: { environment: {} as unknown },
  loadVersion: vi.fn(),
}));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: (node: { params: { name: string } }) => [
    (config: { onCompleted: (response: object, errors: null) => void }) => {
      commit(node.params.name, config);
      config.onCompleted({}, null);
    },
    false,
  ],
  useRelayEnvironment: () => relay.environment,
}));
vi.mock("@phoenix/components/datetime", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useTimeRange: () => ({ timeRangeISOStrings: {} }),
}));
vi.mock("@phoenix/pages/project/evaluators/refetchProjectEvaluators", () => ({
  refetchProjectEvaluators: () => Promise.resolve(),
}));
vi.mock("@phoenix/contexts/NotificationContext", () => ({
  useNotifySuccess: () => vi.fn(),
}));
vi.mock(
  "@phoenix/components/playground/model/PlaygroundInstanceModelControls",
  () => ({
    PlaygroundInstanceModelControls: () => null,
  })
);
vi.mock(
  "@phoenix/components/evaluators/EvaluatorNameAndDescriptionFields",
  () => ({ EvaluatorNameAndDescriptionFields: () => null })
);
vi.mock(
  "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ProjectEvaluatorInputMappingDock: () => null,
  })
);
vi.mock(
  "@phoenix/pages/project/evaluators/ProjectEvaluatorScopeFields",
  () => ({
    ProjectEvaluatorScopeFieldGroup: () => null,
  })
);
vi.mock("@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel", () => ({
  ProjectEvaluatorScopePanel: () => null,
}));
vi.mock(
  "@phoenix/components/evaluators/decision/DecisionVersionPicker",
  () => ({ DecisionVersionPicker: () => null })
);
vi.mock("@phoenix/components/decision/DecisionPromptEditor", () => ({
  DecisionPromptEditor: () => null,
}));
vi.mock("@phoenix/components/playground/fetchPlaygroundDecision", () => ({
  fetchPlaygroundDecisionAsInstance: (...args: unknown[]) =>
    loadVersion(...args),
}));

installTestStorage();

const scope: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "span_kind == 'LLM'",
  samplingRate: 0.5,
  evaluationDelaySeconds: DEFAULT_EVALUATION_DELAY_SECONDS,
  tracingEnabled: true,
};

const savedEvaluator: DecisionEvaluatorData = {
  id: "evaluator-1",
  name: "saved_relevance",
  inputSchema: { properties: { output: {} } },
  scoringPolicy: {
    questions: [
      {
        __typename: "DecisionPredicateScoring",
        name: "relevant",
        threshold: 0.8,
        optimizationDirection: "MAXIMIZE",
      },
    ],
  },
  decisionVersion: {
    id: "version-1",
    decision: { id: "decision-1", name: "saved-decision" },
    questions: [{ __typename: "DecisionPredicateQuestion", name: "relevant" }],
  },
};

/** The saved version as the playground loads it. */
const loadSavedVersion = ({
  decisionVersionId,
}: {
  decisionVersionId: string;
}) =>
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
      decisionPrompt: {
        state: createDecisionStateDraft({ text: "{{output}}" }),
        questions: [
          createDecisionQuestion({
            type: "predicate",
            name: "relevant",
            instructions: "Is the output relevant?",
          }),
        ],
      },
    },
  });

function RejectAllFields() {
  const store = useEvaluatorStoreInstance();
  useEffect(
    () =>
      store
        .getState()
        .registerValidator("rejected", () => Promise.resolve(false)),
    [store]
  );
  return null;
}

describe("Project decision evaluator forms", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.clearAllMocks();
    relay.environment = createMockEnvironment();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(children: ReactNode) {
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
                  globalName: "relevance",
                  description: "",
                  inputMapping: { pathMapping: {}, literalMapping: {} },
                },
              }}
            >
              {children}
            </EvaluatorStoreProvider>
          </Dialog>
        </ThemeContext.Provider>
      )
    );
  }
  const click = async (label: string) => {
    const button = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.trim() === label
    );
    expect(button, label).toBeDefined();
    await act(async () => button?.click());
  };
  const renderCreate = (extra?: ReactNode) =>
    render(
      <>
        {extra}
        <CreateProjectDecisionEvaluatorDialogContent
          title="Create new decision evaluator"
          projectId="project-1"
          scope={scope}
          onScopeChange={vi.fn()}
          onSuccess={onSuccess}
          registerDirtyCheck={vi.fn()}
        />
      </>
    );

  it("creates the evaluator and binds it to the project's spans", async () => {
    await renderCreate();
    await click("Create");

    const [[operation, { variables }]] = commit.mock.calls;
    expect(operation).toBe(
      "ProjectDecisionEvaluatorDialogContentCreateMutation"
    );
    expect(variables.input).toMatchObject({
      projectId: "project-1",
      name: "relevance",
      evaluatorName: "relevance",
      evaluationTarget: "SPAN",
      filterCondition: "span_kind == 'LLM'",
      samplingRate: 0.5,
      enabled: true,
      decisionVersion: expect.objectContaining({ modelName: "jev-latest" }),
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("sends nothing while a field fails validation", async () => {
    await renderCreate(<RejectAllFields />);
    await click("Create");

    expect(commit).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Please fix the highlighted errors before submitting."
    );
  });

  it("copies a saved evaluator as a new one on the same decision version", async () => {
    loadVersion.mockImplementation(loadSavedVersion);
    await render(
      <CreateProjectDecisionEvaluatorDialogContent
        title="Copy decision evaluator"
        projectId="project-1"
        scope={scope}
        onScopeChange={vi.fn()}
        onSuccess={onSuccess}
        registerDirtyCheck={vi.fn()}
        sourceEvaluator={savedEvaluator}
      />
    );
    expect(loadVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionId: "decision-1",
        decisionVersionId: "version-1",
      })
    );
    await click("Create");

    const [[operation, { variables }]] = commit.mock.calls;
    expect(operation).toBe(
      "ProjectDecisionEvaluatorDialogContentCreateMutation"
    );
    expect(variables.input).toMatchObject({
      projectId: "project-1",
      name: "relevance",
      evaluatorName: "relevance",
      decisionVersionId: "version-1",
      scoringPolicy: {
        questions: [
          {
            predicate: {
              name: "relevant",
              threshold: 0.8,
              optimizationDirection: "MAXIMIZE",
            },
          },
        ],
      },
    });
    // A copy is a new evaluator that reuses the original's decision version.
    expect(variables.input).not.toHaveProperty("evaluatorId");
    expect(variables.input).not.toHaveProperty("decisionVersion");
    expect(onSuccess).toHaveBeenCalled();
  });
});
