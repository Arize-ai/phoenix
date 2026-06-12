import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  PATCH_EXPERIMENT_TOOL_NAME,
  type PendingPatchExperiment,
} from "@phoenix/agent/tools/patchExperiment";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import { createAgentStore } from "@phoenix/store/agentStore";

import { PatchExperimentToolDetails } from "../PatchExperimentToolDetails";
import type { ToolInvocationPart } from "../toolPartTypes";

installTestStorage();

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
});

function createPart(): ToolInvocationPart {
  return {
    type: `tool-${PATCH_EXPERIMENT_TOOL_NAME}`,
    toolCallId: "tool-call-1",
    state: "input-available",
    input: {},
    output: undefined,
    errorText: undefined,
  } as ToolInvocationPart;
}

function renderPending(pending: PendingPatchExperiment) {
  const agentStore = createAgentStore();
  agentStore.getState().setPendingPatchExperiment("tool-call-1", pending);

  act(() => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <AgentContext.Provider value={agentStore}>
          <PatchExperimentToolDetails part={createPart()} />
        </AgentContext.Provider>
      </ThemeProvider>
    );
  });
}

function click(element: Element | null) {
  expect(element).not.toBeNull();
  act(() => {
    element!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("PatchExperimentToolDetails", () => {
  it("renders the resolved target name and a before/after field diff", () => {
    renderPending({
      toolCallId: "tool-call-1",
      sessionId: "session-1",
      experimentId: "exp-1",
      experimentName: "baseline run",
      expectedUpdatedAt: "2026-06-10T00:00:00Z",
      payload: { description: "updated" },
      diff: [{ field: "description", previous: "old", next: "updated" }],
      accept: async () => undefined,
      reject: async () => undefined,
    });

    expect(container.textContent).toContain("baseline run");
    expect(container.textContent).toContain("Description");
    expect(container.textContent).toContain("old");
    expect(container.textContent).toContain("updated");
  });

  it("renders a cleared field as (none)", () => {
    renderPending({
      toolCallId: "tool-call-1",
      sessionId: "session-1",
      experimentId: "exp-1",
      experimentName: "baseline run",
      expectedUpdatedAt: "2026-06-10T00:00:00Z",
      payload: { description: null },
      diff: [{ field: "description", previous: "old", next: null }],
      accept: async () => undefined,
      reject: async () => undefined,
    });

    expect(container.textContent).toContain("(none)");
  });

  it("invokes accept and reject handlers from the card buttons", () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    const reject = vi.fn().mockResolvedValue(undefined);
    renderPending({
      toolCallId: "tool-call-1",
      sessionId: "session-1",
      experimentId: "exp-1",
      experimentName: "baseline run",
      expectedUpdatedAt: "2026-06-10T00:00:00Z",
      payload: { name: "renamed" },
      diff: [{ field: "name", previous: "baseline run", next: "renamed" }],
      accept,
      reject,
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    click(buttons.find((b) => b.textContent === "Accept") ?? null);
    expect(accept).toHaveBeenCalledTimes(1);
    click(buttons.find((b) => b.textContent === "Reject") ?? null);
    expect(reject).toHaveBeenCalledTimes(1);
  });
});
