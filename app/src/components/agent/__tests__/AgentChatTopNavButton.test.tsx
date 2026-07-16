import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  AgentProvider,
  useAgentContext,
  useAgentStore,
} from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import type { AgentPosition, AgentStore } from "@phoenix/store/agentStore";

import { AgentChatTopNavButton } from "../AgentChatTopNavButton";

installTestStorage();

let agentStore: AgentStore | null = null;

function AgentStoreCapture() {
  agentStore = useAgentStore();
  return null;
}

function AgentOpenState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  return <span data-testid="agent-open">{String(isOpen)}</span>;
}

describe("AgentChatTopNavButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderButton({
    position = "pinned",
  }: {
    position?: AgentPosition;
  } = {}) {
    act(() => {
      root.render(
        <PreferencesProvider isAssistantAgentEnabled>
          <AgentProvider
            position={position}
            agentsConfig={{
              collectorEndpoint: null,
              assistantProjectName: "assistant_agent",
              forceTracing: false,
              webAccessEnabled: false,
              assistantEnabled: true,
              allowLocalTraces: true,
              allowRemoteExport: false,
            }}
          >
            <AgentStoreCapture />
            <AgentChatTopNavButton />
            <AgentOpenState />
          </AgentProvider>
        </PreferencesProvider>
      );
    });
  }

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    agentStore = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    agentStore = null;
  });

  it("uses the quiet PXI button and opens the assistant", () => {
    renderButton();
    const button = container.querySelector<HTMLButtonElement>("button");

    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("Ask PXI");
    expect(button?.classList.contains("pxi-button")).toBe(true);
    expect(button?.getAttribute("data-size")).toBe("S");
    expect(button?.getAttribute("data-variant")).toBe("quiet");

    act(() => button?.click());

    expect(
      container.querySelector('[data-testid="agent-open"]')?.textContent
    ).toBe("true");
    expect(container.querySelector("button")).toBeNull();
  });

  it("flashes when the detached assistant closes and returns home", () => {
    renderButton({ position: "detached" });
    const initialButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(initialButton?.hasAttribute("data-pxi-should-flash")).toBe(false);

    act(() => agentStore?.getState().setIsOpen(true));
    expect(container.querySelector("button.pxi-button")).toBeNull();

    act(() => agentStore?.getState().setIsOpen(false));
    const returnedButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(returnedButton?.getAttribute("data-pxi-should-flash")).toBe("true");
  });

  it("does not flash when the pinned assistant closes", () => {
    renderButton();

    act(() => agentStore?.getState().setIsOpen(true));
    act(() => agentStore?.getState().setIsOpen(false));

    const returnedButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(returnedButton?.hasAttribute("data-pxi-should-flash")).toBe(false);
  });
});
