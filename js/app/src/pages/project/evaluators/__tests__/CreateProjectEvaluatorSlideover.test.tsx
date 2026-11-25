import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { EvaluatorPlaygroundProviderQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorPlaygroundProviderQuery.graphql";
import { createDefaultFreeformOutputConfig } from "@phoenix/components/evaluators/CodeEvaluatorAnnotationSection";
import { getSpanEvaluatorDefaultMessages } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { AgentContext, AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import type { CreateProjectCodeEvaluatorDialogContentQuery } from "@phoenix/pages/project/evaluators/__generated__/CreateProjectCodeEvaluatorDialogContentQuery.graphql";
import {
  CreateProjectEvaluatorSlideover,
  type ProjectEvaluatorCreationMode,
} from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { createAgentStore } from "@phoenix/store/agentStore";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

const { failure, commitMutation, createLlmEvaluator } = vi.hoisted(() => ({
  failure: { error: new Error("unset") },
  commitMutation: vi.fn(),
  createLlmEvaluator: vi.fn(),
}));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: () => [
    (config: { onError: (error: Error) => void }) => {
      commitMutation();
      config.onError(failure.error);
    },
    false,
  ],
  useLazyLoadQuery: (node: { params: { name: string } }) =>
    queryData[node.params.name],
  useRelayEnvironment: () => ({}),
}));
vi.mock("@phoenix/pages/project/evaluators/createProjectLlmEvaluator", () => ({
  createProjectLlmEvaluator: () => {
    createLlmEvaluator();
    return Promise.reject(failure.error);
  },
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
  "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    ProjectLlmEvaluatorFormSections: () => null,
    ProjectCodeEvaluatorFormSections: () => null,
    ProjectEvaluatorInputMappingDock: () => null,
  })
);
vi.mock("@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel", () => ({
  ProjectEvaluatorScopePanel: () => null,
}));

installTestStorage();

const queryData: Record<string, unknown> = {
  EvaluatorPlaygroundProviderQuery: {
    modelProviders: [
      { name: "OpenAI", dependenciesInstalled: true, dependencies: [] },
    ],
  } satisfies EvaluatorPlaygroundProviderQuery["response"],
  CreateProjectCodeEvaluatorDialogContentQuery: {
    sandboxProviders: [
      {
        backendType: "WASM",
        supportedLanguages: ["PYTHON"],
        enabled: true,
        configs: [
          {
            id: "sandbox-1",
            name: "Local",
            description: null,
            language: "PYTHON",
            timeout: 30,
            config: { envVars: [], internetAccess: null, dependencies: null },
          },
        ],
      },
    ],
    sandboxBackends: [
      {
        backendType: "WASM",
        status: "AVAILABLE",
        supportsEnvVars: false,
        internetAccess: "NONE",
        supportsDependencies: false,
      },
    ],
  } satisfies CreateProjectCodeEvaluatorDialogContentQuery["response"],
};

const SERVER_MESSAGE =
  "A project evaluator with this name already exists for this project";

/** What the Relay network layer throws for a response with GraphQL errors. */
function relayGraphQLError(operation: string, field: string) {
  const errors = [
    {
      message: SERVER_MESSAGE,
      locations: [{ line: 4, column: 3 }],
      path: [field],
    },
  ];
  return new Error(
    `Error fetching GraphQL query '${operation}': ${JSON.stringify(errors)}`
  );
}

// Seeded modes, so the form is valid without typing into the stubbed fields.
const llmTemplate: Extract<ProjectEvaluatorCreationMode, { kind: "template" }> =
  {
    kind: "template",
    initialState: {
      name: "correctness",
      description: "",
      outputConfigs: DEFAULT_LLM_EVALUATOR_STORE_VALUES.outputConfigs,
      defaultMessages: getSpanEvaluatorDefaultMessages(),
      templateFormat: TemplateFormats.Mustache,
      includeExplanation: true,
      inputDescriptions: {},
      targetType: "SPAN",
      filterCondition: "",
      inputMapping: { pathMapping: {}, literalMapping: {} },
    },
  };
const codeCopy: ProjectEvaluatorCreationMode = {
  kind: "copyCode",
  initialState: {
    name: "exact_match",
    copyName: "exact_match_copy",
    description: "",
    outputConfigs: [createDefaultFreeformOutputConfig("score")],
    language: "PYTHON",
    sourceCode: "def evaluate():\n    return 1.0\n",
    sandboxConfigId: "sandbox-1",
    inputMapping: { pathMapping: {}, literalMapping: {} },
    inputDescriptions: {},
  },
};

describe("Creating a project evaluator that fails", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function submit(creationMode: ProjectEvaluatorCreationMode) {
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
          <PreferencesProvider>
            <AgentProvider>
              <CreateProjectEvaluatorSlideover
                isOpen
                projectId="project-1"
                creationMode={creationMode}
                onCreated={vi.fn()}
              />
            </AgentProvider>
          </PreferencesProvider>
        </ThemeContext.Provider>
      )
    );
    const create = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Create"
    );
    expect(create, "Create button").toBeDefined();
    await act(async () => create?.click());
  }

  /** The text under the "Failed to create evaluator" banner title. */
  function failureBannerText() {
    const title = Array.from(document.querySelectorAll("h5")).find(
      (heading) => heading.textContent === "Failed to create evaluator"
    );
    return title?.nextElementSibling?.textContent;
  }

  it.each([
    {
      name: "an LLM evaluator whose name is taken shows only the server's message",
      creationMode: llmTemplate,
      error: relayGraphQLError(
        "createProjectLlmEvaluatorMutation",
        "createProjectLlmEvaluator"
      ),
      banner: SERVER_MESSAGE,
    },
    {
      name: "a code evaluator whose name is taken shows only the server's message",
      creationMode: codeCopy,
      error: relayGraphQLError(
        "CreateProjectCodeEvaluatorDialogContentMutation",
        "createProjectCodeEvaluator"
      ),
      banner: SERVER_MESSAGE,
    },
    {
      name: "an LLM evaluator that cannot reach the server shows the network error",
      creationMode: llmTemplate,
      error: new Error("Failed to fetch"),
      banner: "Failed to fetch",
    },
    {
      name: "a code evaluator that cannot reach the server shows the network error",
      creationMode: codeCopy,
      error: new Error("Failed to fetch"),
      banner: "Failed to fetch",
    },
  ])("$name", async ({ creationMode, error, banner }) => {
    failure.error = error;
    await submit(creationMode);
    expect(failureBannerText()).toBe(banner);
  });
});

/**
 * PXI submits through the form's own submit, so it must be held by the same
 * gate as the button: a required input with nothing mapped disables the
 * button, and PXI's submit must refuse rather than save it unmapped.
 */
describe("PXI submitting a project evaluator form whose save button is disabled", () => {
  let container: HTMLDivElement;
  let root: Root;
  const agentStore = createAgentStore();
  agentStore.getState().setPermissions({ edits: "bypass" });
  const callOperation = (name: string, input: unknown = {}) => {
    const action = agentStore.getState().registeredClientActions[name];
    expect(action, name).toBeDefined();
    return act(() => action(input, { callId: "call-1", sessionId: null }));
  };
  beforeEach(() => {
    vi.clearAllMocks();
    failure.error = new Error("Failed to fetch");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  const render = (creationMode: ProjectEvaluatorCreationMode) =>
    act(async () =>
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            themeMode: "light",
            systemTheme: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <PreferencesProvider>
            <AgentContext.Provider value={agentStore}>
              <CreateProjectEvaluatorSlideover
                isOpen
                projectId="project-1"
                creationMode={creationMode}
                onCreated={vi.fn()}
              />
            </AgentContext.Provider>
          </PreferencesProvider>
        </ThemeContext.Provider>
      )
    );

  it("refuses an LLM create while a prompt variable is unmapped, then saves once PXI maps it", async () => {
    const messages = getSpanEvaluatorDefaultMessages();
    const last = messages[messages.length - 1];
    await render({
      ...llmTemplate,
      initialState: {
        ...llmTemplate.initialState,
        name: "faithfulness",
        defaultMessages: [
          ...messages.slice(0, -1),
          { ...last, content: `${last.content}\n{{context}}` },
        ],
      },
    });

    const refused = await callOperation("evaluators.llm.submit");
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok ? "" : refused.error).toContain(
      "context has no input mapping"
    );
    expect(createLlmEvaluator).not.toHaveBeenCalled();

    await callOperation("evaluators.llm.edit", {
      operations: [
        {
          type: "set_input_mapping",
          inputMapping: {
            pathMapping: { context: "attributes.retrieval.documents" },
            literalMapping: {},
          },
        },
      ],
    });
    await callOperation("evaluators.llm.submit");
    expect(createLlmEvaluator).toHaveBeenCalledTimes(1);
  });

  it("refuses to attach a code evaluator while a required input is unmapped", async () => {
    await render({
      kind: "code",
      evaluatorId: "evaluator-1",
      name: "exact_match",
      description: "",
      outputConfigs: [createDefaultFreeformOutputConfig("score")],
      variables: ["output", "reference"],
      requiredVariables: ["output", "reference"],
      inputMapping: { pathMapping: {}, literalMapping: {} },
      inputDescriptions: {},
    });

    const refused = await callOperation("evaluators.project.attach.submit");
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok ? "" : refused.error).toContain(
      "reference has no input mapping"
    );
    expect(refused.ok ? "" : refused.error).toContain(
      "evaluators.project.attach.edit"
    );
    expect(commitMutation).not.toHaveBeenCalled();

    await callOperation("evaluators.project.attach.edit", {
      inputMapping: { pathMapping: { reference: "attributes.metadata" } },
    });
    await callOperation("evaluators.project.attach.submit");
    expect(commitMutation).toHaveBeenCalledTimes(1);
  });
});
