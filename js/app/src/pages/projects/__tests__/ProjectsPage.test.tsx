import { act, Suspense } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import {
  graphql,
  RelayEnvironmentProvider,
  useLazyLoadQuery,
} from "react-relay";
import { MemoryRouter } from "react-router";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { TimeRangeProvider } from "@phoenix/components/datetime";
import { ClearingTracesIndicator } from "@phoenix/components/project/ClearingTracesIndicator";
import { ThemeProvider, ViewerContext } from "@phoenix/contexts";
import { AgentProvider } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import { ProjectsPageContent } from "../ProjectsPage";
import type { ProjectsPageTestQuery } from "./__generated__/ProjectsPageTestQuery.graphql";

installTestMatchMedia();

const TIME_RANGE = {
  start: "2026-07-01T00:00:00.000Z",
  end: "2026-07-02T00:00:00.000Z",
};

function ProjectsPageContentTestRenderer() {
  const data = useLazyLoadQuery<ProjectsPageTestQuery>(
    graphql`
      query ProjectsPageTestQuery @relay_test_operation {
        ...ProjectsPageProjectsFragment
      }
    `,
    {}
  );
  return <ProjectsPageContent timeRangeISOStrings={TIME_RANGE} query={data} />;
}

describe("ProjectsPage clearing traces behavior", () => {
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

  it("exposes role=status and aria-hidden=true on ClearingTracesIndicator", () => {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <ClearingTracesIndicator />
        </ThemeProvider>
      );
    });

    const statusElement = container.querySelector('[role="status"]');
    expect(statusElement).not.toBeNull();
    expect(statusElement?.textContent).toContain("Clearing traces…");
    expect(
      statusElement?.querySelector(".icon-wrap")?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("renders ClearingTracesIndicator in table view, polls clearing nodes without resetting ProjectsPageProjectsQuery, and refreshes ProjectMetrics when clearing completes", async () => {
    vi.useFakeTimers();
    const environment = createMockEnvironment();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <ViewerContext.Provider
              value={{ viewer: null, refetchViewer: vi.fn() }}
            >
              <PreferencesProvider projectViewMode="table">
                <AgentProvider>
                  <MemoryRouter>
                    <TimeRangeProvider>
                      <Suspense fallback={null}>
                        <ProjectsPageContentTestRenderer />
                      </Suspense>
                    </TimeRangeProvider>
                  </MemoryRouter>
                </AgentProvider>
              </PreferencesProvider>
            </ViewerContext.Provider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });

    const listQuery = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name === "ProjectsPageTestQuery"
      );
    expect(listQuery).toBeDefined();

    await act(async () => {
      environment.mock.resolve(
        listQuery!,
        MockPayloadGenerator.generate(listQuery!, {
          Project: () => ({
            id: "project-1",
            name: "alpha",
            gradientStartColor: "#111111",
            gradientEndColor: "#222222",
            isClearingTraces: true,
            startTime: "2026-07-01T00:00:00.000Z",
            endTime: "2026-07-01T12:00:00.000Z",
          }),
          PageInfo: () => ({
            hasNextPage: true,
            endCursor: "cursor-1",
          }),
        })
      );
    });

    expect(
      container.querySelector('[data-testid="projects-table"]')
    ).not.toBeNull();
    expect(container.textContent).toContain("Clearing traces…");

    const initialMetricsQuery = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name ===
          "ProjectsPageProjectMetricsQuery"
      );
    expect(initialMetricsQuery).toBeDefined();
    await act(async () => {
      environment.mock.resolve(initialMetricsQuery!, {
        data: {
          project: {
            __typename: "Project",
            id: "project-1",
            traceCount: 42,
            sessionCount: 7,
            latencyMsP50: 120,
          },
        },
      });
    });
    expect(container.textContent).toContain("42");

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    const polledOperationNames = environment.mock
      .getAllOperations()
      .map((operation) => operation.request.node.params.name);
    expect(polledOperationNames).toContain(
      "ProjectsPageProjectClearingStatusQuery"
    );
    expect(polledOperationNames).toContain("ProjectsPageProjectMetricsQuery");
    expect(polledOperationNames).not.toContain("ProjectsPageProjectsQuery");

    const midClearMetricsQuery = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name ===
          "ProjectsPageProjectMetricsQuery"
      );
    await act(async () => {
      environment.mock.resolve(midClearMetricsQuery!, {
        data: {
          project: {
            __typename: "Project",
            id: "project-1",
            traceCount: 15,
            sessionCount: 3,
            latencyMsP50: 80,
          },
        },
      });
    });
    expect(container.textContent).toContain("15");

    const statusPoll = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name ===
          "ProjectsPageProjectClearingStatusQuery"
      );
    await act(async () => {
      environment.mock.resolve(statusPoll!, {
        data: {
          project: {
            __typename: "Project",
            id: "project-1",
            isClearingTraces: false,
            startTime: null,
            endTime: null,
          },
        },
      });
    });

    expect(container.textContent).not.toContain("Clearing traces…");

    const finalMetricsQuery = environment.mock
      .getAllOperations()
      .find(
        (operation) =>
          operation.request.node.params.name ===
          "ProjectsPageProjectMetricsQuery"
      );
    expect(finalMetricsQuery).toBeDefined();
    await act(async () => {
      environment.mock.resolve(finalMetricsQuery!, {
        data: {
          project: {
            __typename: "Project",
            id: "project-1",
            traceCount: 0,
            sessionCount: 0,
            latencyMsP50: null,
          },
        },
      });
    });

    expect(container.textContent).not.toContain("15");
    expect(container.textContent).toContain("--");
  });
});
