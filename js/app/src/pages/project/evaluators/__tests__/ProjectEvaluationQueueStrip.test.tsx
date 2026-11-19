import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { MemoryRouter } from "react-router";
import type { OperationDescriptor } from "relay-runtime";
import { createMockEnvironment, MockPayloadGenerator } from "relay-test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { TimeRangeProvider } from "@phoenix/components/datetime";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import { AgentProvider } from "@phoenix/contexts/AgentContext";

import { ProjectEvaluationQueueStrip } from "../ProjectEvaluatorQueueStats";

installTestMatchMedia();
installTestStorage();

const PROJECT_NODE_ID = "UHJvamVjdDox";

const SERVER_QUEUE = {
  status: "HEALTHY",
  queuedCount: 500,
  runningCount: 40,
  addedPerMinute: 50,
  completedPerMinute: 40,
  oldestWaitingAt: null,
};

const PROJECT_QUEUE = {
  queuedCount: 120,
  runningCount: 20,
  addedPerMinute: 3,
  completedPerMinute: 1,
  oldestWaitingAt: null,
};

function resolveOperation(operation: OperationDescriptor) {
  return MockPayloadGenerator.generate(operation, {
    Node: () => ({ __typename: "Project" }),
    // Both queries must read the same project record
    ID: ({ path }, generateId) =>
      path?.join(".") === "project.id" ? PROJECT_NODE_ID : `${generateId()}`,
    // Product queries carry no scalar type info, so numbers and enums reach
    // the String resolver; the path tells the project's queue from the
    // server's
    String: ({ name, path }) => {
      const queue = path?.[0] === "project" ? PROJECT_QUEUE : SERVER_QUEUE;
      if (name != null && name in queue) {
        return queue[name as keyof typeof queue];
      }
      switch (name) {
        case "evaluationTarget":
          return "SPAN";
        case "cost":
          return 1.5;
        case "excludesUntracedEvaluators":
          return false;
        default:
          return undefined;
      }
    },
  });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function renderStrip(
  renderActions: (clearableCount: number | null) => React.ReactNode
) {
  const environment = createMockEnvironment();
  await act(async () => {
    root.render(
      <RelayEnvironmentProvider environment={environment}>
        <ThemeProvider themeMode="dark">
          <PreferencesProvider>
            <AgentProvider>
              <MemoryRouter>
                <TimeRangeProvider>
                  <ProjectEvaluationQueueStrip
                    projectId={PROJECT_NODE_ID}
                    fetchKey="0"
                    renderActions={renderActions}
                  />
                </TimeRangeProvider>
              </MemoryRouter>
            </AgentProvider>
          </PreferencesProvider>
        </ThemeProvider>
      </RelayEnvironmentProvider>
    );
  });
  // The cost loads in its own query once the stats have rendered
  while (environment.mock.getAllOperations().length > 0) {
    await act(async () => {
      environment.mock.resolveMostRecentOperation(resolveOperation);
    });
  }
}

function getStatValue(label: string): string | undefined {
  const heading = Array.from(container.querySelectorAll("h3")).find(
    (element) => element.textContent === label
  );
  return heading?.parentElement?.nextElementSibling?.textContent ?? undefined;
}

describe("ProjectEvaluationQueueStrip", () => {
  it("shows the same stats as the server strip, for this project", async () => {
    await renderStrip(() => null);

    expect(
      Array.from(container.querySelectorAll("h3")).map(
        (heading) => heading.textContent
      )
    ).toEqual([
      "Status",
      "In queue",
      "Added per hour",
      "Completed per hour",
      "Net per hour",
      "Oldest wait",
      "Evaluation cost",
    ]);
    expect(getStatValue("Status")).toBe("Healthy");
    expect(getStatValue("In queue")).toBe("120");
    expect(getStatValue("Added per hour")).toBe("180");
    expect(getStatValue("Completed per hour")).toBe("60");
    expect(getStatValue("Net per hour")).toBe("+120");
    expect(getStatValue("Evaluation cost")).toContain("1.5");
  });

  it("gives the queue actions what clearing this project's queue removes", async () => {
    const renderActions = vi.fn(() => null);
    await renderStrip(renderActions);

    // Running evaluations are kept when the queue is cleared
    expect(renderActions).toHaveBeenLastCalledWith(
      PROJECT_QUEUE.queuedCount - PROJECT_QUEUE.runningCount
    );
  });
});
