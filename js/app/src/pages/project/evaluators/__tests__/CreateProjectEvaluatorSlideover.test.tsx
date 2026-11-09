import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type * as ReactRelay from "react-relay";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import type { EvaluatorPlaygroundProviderQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorPlaygroundProviderQuery.graphql";
import { createDefaultFreeformOutputConfig } from "@phoenix/components/evaluators/CodeEvaluatorAnnotationSection";
import { getSpanEvaluatorDefaultMessages } from "@phoenix/components/evaluators/EvaluatorChatTemplate/utils";
import { TemplateFormats } from "@phoenix/components/templateEditor/constants";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import type { CreateProjectCodeEvaluatorDialogContentQuery } from "@phoenix/pages/project/evaluators/__generated__/CreateProjectCodeEvaluatorDialogContentQuery.graphql";
import {
  CreateProjectEvaluatorSlideover,
  type ProjectEvaluatorCreationMode,
} from "@phoenix/pages/project/evaluators/CreateProjectEvaluatorSlideover";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

const { failure } = vi.hoisted(() => ({
  failure: { error: new Error("unset") },
}));
vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  useMutation: () => [
    (config: { onError: (error: Error) => void }) =>
      config.onError(failure.error),
    false,
  ],
  useLazyLoadQuery: (node: { params: { name: string } }) =>
    queryData[node.params.name],
  useRelayEnvironment: () => ({}),
}));
vi.mock("@phoenix/pages/project/evaluators/createProjectLlmEvaluator", () => ({
  createProjectLlmEvaluator: () => Promise.reject(failure.error),
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
const llmTemplate: ProjectEvaluatorCreationMode = {
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
