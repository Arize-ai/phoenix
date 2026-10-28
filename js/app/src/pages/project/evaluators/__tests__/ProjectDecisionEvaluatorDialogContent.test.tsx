import { act, type ReactNode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";
import { createMockEnvironment } from "relay-test-utils";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { Dialog } from "@phoenix/components/core/dialog";
import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { CreateProjectDecisionEvaluatorDialogContent } from "@phoenix/pages/project/evaluators/ProjectDecisionEvaluatorDialogContent";
import {
  DEFAULT_EVALUATION_DELAY_SECONDS,
  type ProjectEvaluatorScope,
} from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { DEFAULT_STORE_VALUES } from "@phoenix/store/evaluatorStore";

const { commit, onSuccess, relay } = vi.hoisted(() => ({
  commit: vi.fn(),
  onSuccess: vi.fn(),
  relay: { environment: {} as unknown },
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
vi.mock("@phoenix/components/generative", () => ({
  ModelMenu: () => null,
}));
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
vi.mock("@phoenix/pages/playground/DecisionPromptEditor", () => ({
  DecisionPromptEditor: () => {
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
                modelName: "jev-latest",
                provider: "TYPESAFE",
                modelType: "DECISION",
              },
            },
            dirty: true,
          });
        }}
      >
        Pick model
      </button>
    );
  },
}));

installTestStorage();

const scope: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "span_kind == 'LLM'",
  samplingRate: 0.5,
  evaluationDelaySeconds: DEFAULT_EVALUATION_DELAY_SECONDS,
};

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
    await click("Pick model");
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
    await click("Pick model");
    await click("Create");

    expect(commit).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Fix the highlighted fields before saving."
    );
  });
});
