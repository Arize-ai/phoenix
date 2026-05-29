import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { AgentContext as AgentStoreContext } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { createAgentStore } from "@phoenix/store/agentStore";

import { AgentContextPills } from "../AgentContextPills";

describe("AgentContextPills", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function renderContextPills({
    routeContexts = [],
    mountedContexts = {},
  }: {
    routeContexts?: AgentContext[];
    mountedContexts?: Record<string, AgentContext>;
  }) {
    const agentStore = createAgentStore();
    agentStore.setState({ routeContexts, mountedContexts });

    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <AgentStoreContext.Provider value={agentStore}>
            <AgentContextPills />
          </AgentStoreContext.Provider>
        </ThemeProvider>
      );
    });
  }

  it("renders the editing-evaluator pill alongside its dataset/playground surfaces (nothing hidden)", () => {
    renderContextPills({
      routeContexts: [
        { type: "playground", instanceIds: [0] },
        {
          type: "dataset",
          datasetNodeId: "RGF0YXNldDox",
          datasetVersionNodeId: null,
        },
      ],
      mountedContexts: {
        evaluator: {
          type: "code_evaluator",
          evaluatorNodeId: "RXZhbHVhdG9yOjE=",
        },
      },
    });

    // The surface pills still render...
    expect(container.textContent).toContain("Playground");
    expect(container.textContent).toContain("Dataset: RGF0YXNl...");
    // ...and the task-role context is now its own pill, labeled as an action,
    // instead of being hidden behind the page-level surfaces.
    expect(container.textContent).toContain("Editing evaluator: RXZhbHVh...");
  });

  it("labels a create-mode code-evaluator context as a new-evaluator action", () => {
    renderContextPills({
      mountedContexts: {
        evaluator: {
          type: "code_evaluator",
          evaluatorNodeId: null,
        },
      },
    });

    expect(container.textContent).toContain("New evaluator");
  });

  it("renders the project → trace → span breadcrumb pills unchanged", () => {
    renderContextPills({
      routeContexts: [
        { type: "project", projectNodeId: "UHJvamVjdDox" },
        {
          type: "trace",
          projectNodeId: "UHJvamVjdDox",
          otelTraceId: "ee6a3a45bd5f1d1e31975e8fedb97cd5",
        },
        {
          type: "span",
          projectNodeId: "UHJvamVjdDox",
          spanNodeId: "U3Bhbjox",
        },
      ],
    });

    expect(container.textContent).toContain("Project");
    expect(container.textContent).toContain("Trace: ee6a3a45...");
    expect(container.textContent).toContain("Span: U3Bhbjox");
  });

  it("does not alter the selectActiveContexts payload (presentation-only view)", () => {
    const routeContexts: AgentContext[] = [
      { type: "playground", instanceIds: [0] },
      {
        type: "dataset",
        datasetNodeId: "RGF0YXNldDox",
        datasetVersionNodeId: null,
      },
    ];
    const mountedContexts: Record<string, AgentContext> = {
      evaluator: {
        type: "code_evaluator",
        evaluatorNodeId: "RXZhbHVhdG9yOjE=",
      },
    };

    const agentStore = createAgentStore();
    agentStore.setState({ routeContexts, mountedContexts });

    // The pills are a view over this selector; rendering them must not mutate
    // or drop anything from the payload sent on the next chat turn — the
    // code_evaluator context stays a peer alongside the playground/dataset
    // surfaces.
    const before = selectActiveContexts(agentStore.getState());

    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <AgentStoreContext.Provider value={agentStore}>
            <AgentContextPills />
          </AgentStoreContext.Provider>
        </ThemeProvider>
      );
    });

    const after = selectActiveContexts(agentStore.getState());
    expect(after).toStrictEqual(before);
    expect(after).toStrictEqual([
      { type: "playground", instanceIds: [0] },
      {
        type: "dataset",
        datasetNodeId: "RGF0YXNldDox",
        datasetVersionNodeId: null,
      },
      { type: "code_evaluator", evaluatorNodeId: "RXZhbHVhdG9yOjE=" },
    ]);
  });
});
