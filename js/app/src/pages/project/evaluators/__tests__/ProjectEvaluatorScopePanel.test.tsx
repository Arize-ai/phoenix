import { act, startTransition, use } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { ThemeProvider } from "@phoenix/contexts";
import { CredentialsProvider } from "@phoenix/contexts/CredentialsContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { ProjectEvaluatorScopePanel } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { ProjectEvaluatorSlideover } from "@phoenix/pages/project/evaluators/ProjectEvaluatorSlideover";
import type { ProjectEvaluatorScope } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { DEFAULT_STORE_VALUES } from "@phoenix/store/evaluatorStore";

installTestMatchMedia();

const SCOPE: ProjectEvaluatorScope = {
  targetType: "SPAN",
  filterCondition: "parent_id is None",
  samplingRate: 1,
  evaluationDelaySeconds: 0,
  tracingEnabled: true,
};

function countPreviewQueries(
  environment: ReturnType<typeof createMockEnvironment>
) {
  return environment.mock
    .getAllOperations()
    .filter(({ request }) =>
      request.node.params.name.startsWith("ProjectEvaluatorScopePanel")
    ).length;
}

async function resolvePendingPreviewQueries(
  environment: ReturnType<typeof createMockEnvironment>
) {
  await act(async () => {
    for (const operation of environment.mock.getAllOperations()) {
      environment.mock.resolve(
        operation,
        MockPayloadGenerator.generate(operation, {
          Node: () => ({ __typename: "Project" }),
        })
      );
    }
  });
}

const RECORDS_LOADING_SELECTOR = '[role="status"][aria-label="Loading spans"]';

describe("ProjectEvaluatorScopePanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T20:12:55.000Z"));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("sends its preview queries once while the form beside it is still loading", async () => {
    const environment = createMockEnvironment();
    let resolveFormQuery: () => void = () => {};
    const formQuery = new Promise<void>((resolve) => {
      resolveFormQuery = resolve;
    });
    function LoadingFormSection() {
      use(formQuery);
      return null;
    }
    await act(async () =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light">
            <ProjectEvaluatorSlideover isOpen title="Create evaluator">
              {() => (
                <>
                  <LoadingFormSection />
                  <ProjectEvaluatorScopePanel
                    projectId="project-1"
                    scope={SCOPE}
                    decision={{ blocker: "No decision" }}
                  />
                </>
              )}
            </ProjectEvaluatorSlideover>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      )
    );
    expect(countPreviewQueries(environment)).toBe(2);

    vi.setSystemTime(new Date("2026-11-10T20:13:05.000Z"));
    await act(async () => resolveFormQuery());

    expect(countPreviewQueries(environment)).toBe(2);
  });

  async function renderRevealedPanel() {
    const environment = createMockEnvironment();
    const renderPanel = (scope: ProjectEvaluatorScope) =>
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light">
            <CredentialsProvider>
              <EvaluatorStoreProvider
                initialState={{
                  ...DEFAULT_STORE_VALUES,
                  evaluator: {
                    ...DEFAULT_STORE_VALUES.evaluator,
                    kind: "DECISION",
                    isBuiltin: false,
                  },
                }}
              >
                <EvaluatorInputVariablesProvider variables={[]}>
                  <ProjectEvaluatorSlideover isOpen title="Create evaluator">
                    {() => (
                      <ProjectEvaluatorScopePanel
                        projectId="project-1"
                        scope={scope}
                        decision={{ blocker: "No decision" }}
                      />
                    )}
                  </ProjectEvaluatorSlideover>
                </EvaluatorInputVariablesProvider>
              </EvaluatorStoreProvider>
            </CredentialsProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    await act(async () => renderPanel(SCOPE));
    await resolvePendingPreviewQueries(environment);
    expect(
      document.querySelector('[data-testid="project-evaluator-test-bench"]')
    ).not.toBeNull();
    expect(document.querySelector(RECORDS_LOADING_SELECTOR)).toBeNull();
    return { renderPanel };
  }

  it("shows the records loading as soon as a filter applied in a transition changes the scope", async () => {
    const { renderPanel } = await renderRevealedPanel();

    // The filter field applies changes in a transition.
    await act(async () =>
      startTransition(() =>
        renderPanel({ ...SCOPE, filterCondition: "span_kind == 'LLM'" })
      )
    );

    expect(document.querySelector(RECORDS_LOADING_SELECTOR)).not.toBeNull();
  });

  it("shows the records loading as soon as a new time window is picked", async () => {
    await renderRevealedPanel();
    const windowPicker = document.querySelector<HTMLButtonElement>(
      'button[aria-label*="Preview window"]'
    );
    expect(windowPicker).not.toBeNull();

    await act(async () => windowPicker?.click());
    const lastHourOption = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    ).find((option) => option.textContent === "last hour");
    expect(lastHourOption).toBeDefined();
    await act(async () => lastHourOption?.click());

    const loadingRecords = document.querySelector(RECORDS_LOADING_SELECTOR);
    expect(loadingRecords).not.toBeNull();
    // The picker in the loading state shows the new window.
    expect(
      loadingRecords?.parentElement?.querySelector(
        'button[aria-label*="Preview window"]'
      )?.textContent
    ).toContain("last hour");
  });
});
