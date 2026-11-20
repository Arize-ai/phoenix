import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter, Route, Routes } from "react-router";
import { createMockEnvironment } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { TimeRangeProvider } from "@phoenix/components/datetime";
import {
  TopNavActionsProvider,
  TopNavActionsSlot,
} from "@phoenix/components/nav";
import { ThemeProvider } from "@phoenix/contexts";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import { ProjectPageContent } from "../ProjectPage";

installTestMatchMedia();

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
    vi.useRealTimers();
  });

  it("requests the spans table's first page while the page query is in flight", async () => {
    const environment = createMockEnvironment();
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <MemoryRouter initialEntries={["/projects/project-1/spans"]}>
                <Routes>
                  <Route
                    path="/projects/:projectId/*"
                    element={
                      <Suspense fallback={null}>
                        <ProjectPageContent
                          projectId="project-1"
                          timeRangeISOStrings={TIME_RANGE}
                        />
                      </Suspense>
                    }
                  />
                </Routes>
              </MemoryRouter>
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });

    const pendingOperationNames = environment.mock
      .getAllOperations()
      .map((operation) => operation.request.node.params.name);
    expect(pendingOperationNames).toEqual(
      expect.arrayContaining([
        "ProjectPageQuery",
        "ProjectPageQueriesSpansQuery",
      ])
    );
  });

  it("keeps ProjectPage mounted if a clearing poll fails and clears the indicator once clearing finishes", async () => {
    vi.useFakeTimers();
    const environment = createMockEnvironment();
    const onErrorBoundary = vi.fn();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <PreferencesProvider>
              <AgentProvider>
                <MemoryRouter initialEntries={["/projects/project-1/metrics"]}>
                  <TimeRangeProvider>
                    <TopNavActionsProvider>
                      <TopNavActionsSlot />
                      <ErrorBoundary
                        fallback={<div>error-boundary-fallback</div>}
                        onError={onErrorBoundary}
                      >
                        <Routes>
                          <Route
                            path="/projects/:projectId/*"
                            element={
                              <Suspense fallback={null}>
                                <ProjectPageContent
                                  projectId="project-1"
                                  timeRangeISOStrings={TIME_RANGE}
                                />
                              </Suspense>
                            }
                          />
                        </Routes>
                      </ErrorBoundary>
                    </TopNavActionsProvider>
                  </TimeRangeProvider>
                </MemoryRouter>
              </AgentProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });

    const initialPageQuery = environment.mock
      .getAllOperations()
      .find(
        (operation) => operation.request.node.params.name === "ProjectPageQuery"
      );
    expect(initialPageQuery).toBeDefined();

    await act(async () => {
      environment.mock.resolve(initialPageQuery!, {
        data: {
          project: {
            __typename: "Project",
            id: "project-1",
            name: "alpha",
            evaluatorCount: 0,
            hasTraces: true,
            isClearingTraces: true,
            streamingLastUpdatedAt: "2026-07-01T12:00:00.000Z",
          },
        },
      });
    });

    expect(container.textContent).toContain("Clearing traces…");

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    const firstPoll = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name ===
          "ProjectTimeRangeControlsRefetchQuery"
      );
    expect(firstPoll).toBeDefined();

    await act(async () => {
      environment.mock.reject(firstPoll!, new Error("502 Bad Gateway"));
    });

    expect(onErrorBoundary).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("error-boundary-fallback");
    expect(container.textContent).toContain("Clearing traces…");

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    const secondPoll = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name ===
          "ProjectTimeRangeControlsRefetchQuery"
      );
    expect(secondPoll).toBeDefined();

    await act(async () => {
      environment.mock.resolve(secondPoll!, {
        data: {
          node: {
            __typename: "Project",
            id: "project-1",
            isClearingTraces: false,
            streamingLastUpdatedAt: "2026-07-01T12:00:00.000Z",
          },
        },
      });
    });

    expect(container.textContent).not.toContain("Clearing traces…");
    expect(onErrorBoundary).not.toHaveBeenCalled();
  });
});
