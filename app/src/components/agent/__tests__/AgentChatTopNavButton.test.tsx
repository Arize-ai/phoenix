import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { AgentProvider, useAgentContext } from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";

import { AgentChatTopNavButton } from "../AgentChatTopNavButton";

installTestStorage();

function AgentOpenState() {
  const isOpen = useAgentContext((state) => state.isOpen);
  return <span data-testid="agent-open">{String(isOpen)}</span>;
}

describe("AgentChatTopNavButton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(
        <PreferencesProvider isAssistantAgentEnabled>
          <AgentProvider
            agentsConfig={{
              collectorEndpoint: null,
              assistantProjectName: "assistant_agent",
              webAccessEnabled: false,
              assistantEnabled: true,
              allowLocalTraces: true,
              allowRemoteExport: false,
            }}
          >
            <AgentChatTopNavButton />
            <AgentOpenState />
          </AgentProvider>
        </PreferencesProvider>
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("uses the quiet PXI button and opens the assistant", () => {
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
});
