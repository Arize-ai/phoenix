import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  MemoryRouter,
  Route,
  RouterContextProvider,
  Routes,
} from "react-router";
import { createOperationDescriptor } from "relay-runtime";
import { createMockEnvironment } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ErrorBoundary } from "@phoenix/components/exception";
import { TopNavActionsProvider } from "@phoenix/components/nav";
import { ThemeProvider } from "@phoenix/contexts";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ProjectProvider } from "@phoenix/contexts/ProjectContext";

import ProjectPageQueriesOnboardingQueryNode from "../__generated__/ProjectPageQueriesOnboardingQuery.graphql";
import ProjectPageQueryNode from "../__generated__/ProjectPageQuery.graphql";
import { projectLoader } from "../projectLoader";
import { ProjectPageContent } from "../ProjectPage";
import { ProjectOnboardingQueryReferenceContext } from "../ProjectPageQueries";

const relayEnvironmentHolder = vi.hoisted(() => ({
  current: null as ReturnType<typeof createMockEnvironment> | null,
}));

vi.mock("@phoenix/RelayEnvironment", () => ({
  get default() {
    return relayEnvironmentHolder.current;
  },
}));

installTestMatchMedia();

const PROJECT_ID = "project-1";

const ONBOARDING_GUIDE_SELECTOR =
  '[aria-label="Set up tracing for this project"]';

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

function ProjectErrorFallback() {
  return <p role="alert">The project could not be loaded</p>;
}

function runProjectLoader() {
  const url = new URL(`http://localhost/projects/${PROJECT_ID}`);
  return projectLoader({
    request: new Request(url),
    url,
    pattern: "/projects/:projectId",
    params: { projectId: PROJECT_ID },
    context: new RouterContextProvider(),
  });
}

describe("ProjectPageContent", () => {
  let container: HTMLDivElement;
  let root: Root;
  let environment: ReturnType<typeof createMockEnvironment>;

  beforeEach(() => {
    environment = createMockEnvironment();
    relayEnvironmentHolder.current = environment;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderProjectPage({ tab = "spans" }: { tab?: string } = {}) {
    const { onboardingQueryReference } = runProjectLoader();
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <ProjectProvider projectId={PROJECT_ID}>
                <ProjectOnboardingQueryReferenceContext.Provider
                  value={onboardingQueryReference}
                >
                  <TopNavActionsProvider>
                    <MemoryRouter
                      initialEntries={[`/projects/${PROJECT_ID}/${tab}`]}
                    >
                      <Routes>
                        <Route
                          path="/projects/:projectId/*"
                          element={
                            <ErrorBoundary fallback={ProjectErrorFallback}>
                              <Suspense fallback={null}>
                                <ProjectPageContent
                                  projectId={PROJECT_ID}
                                  timeRangeISOStrings={TIME_RANGE}
                                />
                              </Suspense>
                            </ErrorBoundary>
                          }
                        />
                      </Routes>
                    </MemoryRouter>
                  </TopNavActionsProvider>
                </ProjectOnboardingQueryReferenceContext.Provider>
              </ProjectProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  function listPendingOperationNames(): string[] {
    return environment.mock
      .getAllOperations()
      .map((operation) => operation.request.node.params.name);
  }

  it("requests the spans table's first page while the page query is in flight", async () => {
    await renderProjectPage();

    expect(listPendingOperationNames()).toEqual(
      expect.arrayContaining([
        "ProjectPageQuery",
        "ProjectPageQueriesSpansQuery",
      ])
    );
  });

  it("shows the tabs while the page query is in flight, requesting it once", async () => {
    await renderProjectPage();

    const tabNames = Array.from(
      container.querySelectorAll('[role="tab"]'),
      (tab) => tab.textContent?.trim()
    );
    expect(tabNames).toEqual(
      expect.arrayContaining(["Spans", "Traces", "Sessions", "Config"])
    );
    expect(
      listPendingOperationNames().filter((name) => name === "ProjectPageQuery")
    ).toHaveLength(1);
  });

  /** What an earlier visit left in the store: an empty project with 3 evaluators. */
  function commitEarlierVisit() {
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

  async function resolveOnboardingQuery({ hasTraces }: { hasTraces: boolean }) {
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
    commitEarlierVisit();
    await renderProjectPage();

    const evaluatorsTab = Array.from(
      container.querySelectorAll('[role="tab"]')
    ).find((tab) => tab.textContent?.startsWith("Evaluators"));
    expect(evaluatorsTab?.textContent).toContain("3");
    expect(listPendingOperationNames()).toContain("ProjectPageQuery");
  });

  it("waits for the server before deciding to show the onboarding guide", async () => {
    commitEarlierVisit();
    await renderProjectPage();

    expect(container.querySelector(ONBOARDING_GUIDE_SELECTOR)).toBeNull();

    await resolveOnboardingQuery({ hasTraces: true });

    expect(container.querySelector(ONBOARDING_GUIDE_SELECTOR)).toBeNull();
  });

  it("shows the onboarding guide once the server says the project is empty", async () => {
    commitEarlierVisit();
    await renderProjectPage();

    await resolveOnboardingQuery({ hasTraces: false });

    expect(container.querySelector(ONBOARDING_GUIDE_SELECTOR)).not.toBeNull();
  });

  it("resolves the breadcrumb name from the onboarding request", async () => {
    const { projectName } = runProjectLoader();

    expect(
      listPendingOperationNames().filter(
        (name) => name === "ProjectPageQueriesOnboardingQuery"
      )
    ).toHaveLength(1);

    await resolveOnboardingQuery({ hasTraces: true });

    await expect(projectName).resolves.toBe("support-chatbot");
  });

  it("uses a project name already in the store for the breadcrumb", () => {
    environment.commitUpdate((store) => {
      store.create(PROJECT_ID, "Project").setValue("support-chatbot", "name");
    });

    expect(runProjectLoader().projectName).toBe("support-chatbot");
  });

  it("shows the error state on a tab without the onboarding guide when the page query fails", async () => {
    await renderProjectPage({ tab: "metrics" });
    const pageOperation = environment.mock
      .getAllOperations()
      .find(
        (operation) => operation.request.node.params.name === "ProjectPageQuery"
      );
    if (!pageOperation) {
      throw new Error("Expected a pending page query");
    }

    await act(async () => {
      environment.mock.reject(pageOperation, new Error("Project not found"));
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "The project could not be loaded"
    );
  });
});
