import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createOperationDescriptor } from "relay-runtime";
import { createMockEnvironment } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { TopNavActionsProvider } from "@phoenix/components/nav";
import { ThemeProvider } from "@phoenix/contexts";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";

import ProjectPageQueriesOnboardingQueryNode from "../__generated__/ProjectPageQueriesOnboardingQuery.graphql";
import ProjectPageQueryNode from "../__generated__/ProjectPageQuery.graphql";
import { ProjectPageContent } from "../ProjectPage";

installTestMatchMedia();

const PROJECT_ID = "project-1";

const ONBOARDING_GUIDE_SELECTOR =
  '[aria-label="Set up tracing for this project"]';

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

describe("ProjectPageContent", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderProjectPage(
    environment: ReturnType<typeof createMockEnvironment>
  ) {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <ProjectProvider projectId={PROJECT_ID}>
                <TopNavActionsProvider>
                  <MemoryRouter
                    initialEntries={[`/projects/${PROJECT_ID}/spans`]}
                  >
                    <Routes>
                      <Route
                        path="/projects/:projectId/*"
                        element={
                          <Suspense fallback={null}>
                            <ProjectPageContent
                              projectId={PROJECT_ID}
                              timeRangeISOStrings={TIME_RANGE}
                            />
                          </Suspense>
                        }
                      />
                    </Routes>
                  </MemoryRouter>
                </TopNavActionsProvider>
              </ProjectProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  function listPendingOperationNames(
    environment: ReturnType<typeof createMockEnvironment>
  ): string[] {
    return environment.mock
      .getAllOperations()
      .map((operation) => operation.request.node.params.name);
  }

  it("requests the spans table's first page while the page query is in flight", async () => {
    const environment = createMockEnvironment();
    await renderProjectPage(environment);

    expect(listPendingOperationNames(environment)).toEqual(
      expect.arrayContaining([
        "ProjectPageQuery",
        "ProjectPageQueriesSpansQuery",
      ])
    );
  });

  it("shows the tabs while the page query is in flight, requesting it once", async () => {
    const environment = createMockEnvironment();
    await renderProjectPage(environment);

    const tabNames = Array.from(
      container.querySelectorAll('[role="tab"]'),
      (tab) => tab.textContent?.trim()
    );
    expect(tabNames).toEqual(
      expect.arrayContaining(["Spans", "Traces", "Sessions", "Config"])
    );
    expect(
      listPendingOperationNames(environment).filter(
        (name) => name === "ProjectPageQuery"
      )
    ).toHaveLength(1);
  });

  /** What an earlier visit left in the store: an empty project with 3 evaluators. */
  function commitEarlierVisit(
    environment: ReturnType<typeof createMockEnvironment>
  ) {
    environment.commitPayload(
      createOperationDescriptor(ProjectPageQueryNode, { id: PROJECT_ID }),
      {
        project: {
          __typename: "Project",
          id: PROJECT_ID,
          evaluatorCount: 3,
          streamingLastUpdatedAt: null,
        },
      }
    );
    environment.commitPayload(
      createOperationDescriptor(ProjectPageQueriesOnboardingQueryNode, {
        id: PROJECT_ID,
      }),
      {
        project: {
          __typename: "Project",
          id: PROJECT_ID,
          name: "support-chatbot",
          hasTraces: false,
        },
      }
    );
  }

  async function resolveOnboardingQuery({
    environment,
    hasTraces,
  }: {
    environment: ReturnType<typeof createMockEnvironment>;
    hasTraces: boolean;
  }) {
    const operation = environment.mock
      .getAllOperations()
      .find(
        (pendingOperation) =>
          pendingOperation.request.node.params.name ===
          "ProjectPageQueriesOnboardingQuery"
      );
    if (!operation) {
      throw new Error("Expected a pending onboarding query");
    }
    await act(async () => {
      environment.mock.resolve(operation, {
        data: {
          project: {
            __typename: "Project",
            id: PROJECT_ID,
            name: "support-chatbot",
            hasTraces,
          },
        },
      });
    });
  }

  it("renders the evaluator count from an earlier visit while the page query refreshes", async () => {
    const environment = createMockEnvironment();
    commitEarlierVisit(environment);
    await renderProjectPage(environment);

    const evaluatorsTab = Array.from(
      container.querySelectorAll('[role="tab"]')
    ).find((tab) => tab.textContent?.startsWith("Evaluators"));
    expect(evaluatorsTab?.textContent).toContain("3");
    expect(listPendingOperationNames(environment)).toContain(
      "ProjectPageQuery"
    );
  });

  it("waits for the server before deciding to show the onboarding guide", async () => {
    const environment = createMockEnvironment();
    commitEarlierVisit(environment);
    await renderProjectPage(environment);

    expect(container.querySelector(ONBOARDING_GUIDE_SELECTOR)).toBeNull();

    await resolveOnboardingQuery({ environment, hasTraces: true });

    expect(container.querySelector(ONBOARDING_GUIDE_SELECTOR)).toBeNull();
  });

  it("shows the onboarding guide once the server says the project is empty", async () => {
    const environment = createMockEnvironment();
    commitEarlierVisit(environment);
    await renderProjectPage(environment);

    await resolveOnboardingQuery({ environment, hasTraces: false });

    expect(container.querySelector(ONBOARDING_GUIDE_SELECTOR)).not.toBeNull();
  });
});
