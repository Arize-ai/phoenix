import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
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

  it("hides code-evaluator form context when page context already orients the user", () => {
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
          evaluatorNodeId: null,
        },
      },
    });

    expect(container.textContent).toContain("Playground");
    expect(container.textContent).toContain("Dataset: RGF0YXNl...");
    expect(container.textContent).not.toContain("Code Evaluator");
  });

  it("shows standalone code-evaluator context", () => {
    renderContextPills({
      mountedContexts: {
        evaluator: {
          type: "code_evaluator",
          evaluatorNodeId: null,
        },
      },
    });

    expect(container.textContent).toContain("Code Evaluator: new");
  });
});
