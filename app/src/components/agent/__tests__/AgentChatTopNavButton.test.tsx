import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import {
  AgentProvider,
  useAgentContext,
  useAgentStore,
} from "@phoenix/contexts/AgentContext";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import type { AgentPosition, AgentStore } from "@phoenix/store/agentStore";

import { AgentChatTopNavButton } from "../AgentChatTopNavButton";
import { pxiGlowWipe } from "../pxiStyles";

installTestStorage();

function dispatchAnimationEnd(element: Element, animationName: string) {
  // React registers its animationend listener under a vendor-prefixed name
  // when the environment lacks AnimationEvent (as jsdom does); dispatch both
  // spellings so the test survives either registration.
  for (const type of ["animationend", "webkitAnimationEnd"]) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { animationName });
    element.dispatchEvent(event);
  }
}

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
    vi.unstubAllGlobals();
  });

  function installSideOverlays() {
    const drawer = document.createElement("div");
    drawer.className = "drawer";
    const overlay = document.createElement("div");
    overlay.className = "react-aria-ModalOverlay";
    const modal = document.createElement("div");
    overlay.appendChild(modal);
    document.body.appendChild(drawer);
    document.body.appendChild(overlay);
    return { drawer, modal };
  }

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

  it("stays in its nav slot when side overlays open", () => {
    const { drawer, modal } = installSideOverlays();

    renderButton();

    expect(container.querySelector("button.pxi-button")).not.toBeNull();
    expect(drawer.querySelector("button.pxi-button")).toBeNull();
    expect(modal.querySelector("button.pxi-button")).toBeNull();
  });

  it("flashes when the detached assistant closes and returns home", () => {
    renderButton({ position: "detached" });
    const initialButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(initialButton?.hasAttribute("data-pxi-should-flash")).toBe(false);

    act(() => agentStore?.getState().setIsOpen(true));
    const openButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(openButton).not.toBeNull();
    expect(openButton?.getAttribute("aria-expanded")).toBe("true");

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

  it("does not arm the flash when the detached assistant closes while a response is pending", () => {
    renderButton({ position: "detached" });

    act(() => {
      const sessionId = agentStore?.getState().createSession();
      if (sessionId) {
        agentStore?.getState().setSessionResponsePending(sessionId, true);
      }
    });
    act(() => agentStore?.getState().setIsOpen(true));
    act(() => agentStore?.getState().setIsOpen(false));

    const returnedButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(returnedButton?.hasAttribute("data-pxi-should-flash")).toBe(false);
    expect(returnedButton?.getAttribute("data-pxi-is-thinking")).toBe("true");
  });

  it("clears the flash only when the glow wipe animation ends", () => {
    renderButton({ position: "detached" });

    act(() => agentStore?.getState().setIsOpen(true));
    act(() => agentStore?.getState().setIsOpen(false));

    const button =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(button?.getAttribute("data-pxi-should-flash")).toBe("true");

    // animationend events from the button's other treatments bubble through
    // the same handler and must not cut the flash short.
    act(() => {
      if (button) {
        dispatchAnimationEnd(button, "some-other-animation");
      }
    });
    expect(button?.getAttribute("data-pxi-should-flash")).toBe("true");

    act(() => {
      if (button) {
        dispatchAnimationEnd(button, pxiGlowWipe.name);
      }
    });
    expect(button?.hasAttribute("data-pxi-should-flash")).toBe(false);
  });

  it("does not arm the flash when reduced motion is preferred", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true } as MediaQueryList)
    );
    renderButton({ position: "detached" });

    act(() => agentStore?.getState().setIsOpen(true));
    act(() => agentStore?.getState().setIsOpen(false));

    const returnedButton =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(returnedButton?.hasAttribute("data-pxi-should-flash")).toBe(false);
  });

  it("shows the working state until the active response settles", () => {
    renderButton();

    act(() => {
      const sessionId = agentStore?.getState().createSession();
      if (sessionId) {
        agentStore?.getState().setSessionResponsePending(sessionId, true);
      }
    });

    const button =
      container.querySelector<HTMLButtonElement>("button.pxi-button");
    expect(button?.getAttribute("data-pxi-is-thinking")).toBe("true");
    expect(button?.textContent).toBe("Working...");
    expect(button?.querySelector(".pxi-button__label")?.textContent).toBe(
      "Working..."
    );
    expect(button?.querySelector(".pxi-button__thinking-glyph")).not.toBeNull();
    expect(button?.querySelector(".pxi-animated-glyph")).toBeNull();

    act(() => {
      const sessionId = agentStore?.getState().activeSessionId;
      if (sessionId) {
        agentStore?.getState().setSessionChatStatus(sessionId, "ready");
      }
    });

    expect(button?.getAttribute("data-pxi-is-thinking")).toBe("true");
    expect(button?.textContent).toBe("Working...");

    act(() => {
      const sessionId = agentStore?.getState().activeSessionId;
      if (sessionId) {
        agentStore?.getState().setSessionResponsePending(sessionId, false);
      }
    });

    expect(button?.hasAttribute("data-pxi-is-thinking")).toBe(false);
    expect(button?.textContent).toBe("Ask PXI");
    expect(button?.querySelector(".pxi-animated-glyph")).not.toBeNull();
  });
});
