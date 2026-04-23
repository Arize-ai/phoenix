import { act, createElement, type PropsWithChildren } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentContext as AgentContextType } from "@phoenix/agent/context/agentContexts";
import { useAdvertiseAgentContextSource } from "@phoenix/agent/context/useAdvertiseAgentContextSource";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { ThemeContext } from "@phoenix/contexts/ThemeContext";
import { createAgentStore, type AgentStore } from "@phoenix/store/agentStore";

import { PromptContextPills } from "../PromptContextPills";

function AgentStoreProvider({
  children,
  store,
}: PropsWithChildren<{ store: AgentStore }>) {
  return createElement(AgentContext.Provider, { value: store }, children);
}

function MountedContextAdvertiser({
  contexts,
}: {
  contexts: AgentContextType[];
}) {
  useAdvertiseAgentContextSource({
    sourceKey: "mounted-test",
    contexts,
  });

  return null;
}

describe("Chat context UI", () => {
  let container: HTMLDivElement;
  let root: Root;
  let isUnmounted: boolean;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    isUnmounted = false;
  });

  afterEach(() => {
    if (!isUnmounted) {
      act(() => {
        root.unmount();
      });
    }
    container.remove();
    vi.restoreAllMocks();
  });

  it("publishes mounted contexts while mounted and clears them on unmount", async () => {
    const store = createAgentStore();
    const mountedContexts: AgentContextType[] = [
      {
        source: "mounted",
        type: "span_filter_condition",
        projectId: "project-1",
        filterCondition: "span_kind == 'LLM'",
      },
    ];

    await act(async () => {
      root.render(
        createElement(
          AgentStoreProvider,
          { store },
          createElement(MountedContextAdvertiser, { contexts: mountedContexts })
        )
      );
    });

    expect(store.getState().activeContexts).toEqual(mountedContexts);

    await act(async () => {
      root.unmount();
    });
    isUnmounted = true;

    expect(store.getState().activeContexts).toEqual([]);
  });

  it("renders active context pills in the prompt input", async () => {
    const contexts: AgentContextType[] = [
      {
        source: "route",
        type: "project",
        projectId: "project-1",
      },
      {
        source: "route",
        type: "trace",
        projectId: "project-1",
        traceId: "trace-1",
      },
    ];

    await act(async () => {
      root.render(
        createElement(
          ThemeContext.Provider,
          {
            value: {
              theme: "light",
              systemTheme: "light",
              themeMode: "light",
              setThemeMode: vi.fn(),
            },
          },
          createElement(PromptContextPills, { contexts })
        )
      );
    });

    expect(container.textContent).toContain("Project project-1");
    expect(container.textContent).toContain("Trace trace-1");
  });
});
