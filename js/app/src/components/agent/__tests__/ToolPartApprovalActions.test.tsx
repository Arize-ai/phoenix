import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore, type AgentStore } from "@phoenix/store/agentStore";

import { ToolPartApprovalActions } from "../ToolPartPrimitives";

installTestStorage();

const SESSION_ID = "session-1";

describe("ToolPartApprovalActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;

  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    store = createAgentStore({});
    store.getState().setActiveSession(SESSION_ID);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderActions(props?: {
    isDisabled?: boolean;
    staleMessage?: string;
  }) {
    act(() => {
      root.render(
        <AgentContext.Provider value={store}>
          <ToolPartApprovalActions
            onAccept={vi.fn()}
            onReject={vi.fn()}
            {...props}
          />
        </AgentContext.Provider>
      );
    });
  }

  function getButtons() {
    const buttons = Array.from(container.querySelectorAll("button"));
    const accept = buttons.find(
      (button) => button.textContent === "Accept"
    ) as HTMLButtonElement;
    const reject = buttons.find(
      (button) => button.textContent === "Reject"
    ) as HTMLButtonElement;
    return { accept, reject };
  }

  it("enables Accept and Reject while the active session is idle", () => {
    renderActions();
    const { accept, reject } = getButtons();
    expect(accept.disabled).toBe(false);
    expect(reject.disabled).toBe(false);
  });

  it("disables both buttons while the active session's response streams", () => {
    renderActions({
      staleMessage: "This proposal was made in an earlier session.",
    });
    act(() => {
      store.getState().setSessionChatStatus(SESSION_ID, "streaming");
    });
    const { accept, reject } = getButtons();
    expect(accept.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    // Occupation is transient — it must not surface the stale explanation.
    expect(container.textContent).not.toContain(
      "This proposal was made in an earlier session."
    );
  });

  it("disables both buttons while the session is busy on another client", () => {
    renderActions();
    act(() => {
      store.getState().setSessionBusyElsewhere(SESSION_ID, true);
    });
    const { accept, reject } = getButtons();
    expect(accept.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
  });

  it("re-enables the buttons when the turn settles", () => {
    renderActions();
    act(() => {
      store.getState().setSessionChatStatus(SESSION_ID, "streaming");
    });
    act(() => {
      store.getState().setSessionChatStatus(SESSION_ID, "ready");
    });
    const { accept, reject } = getButtons();
    expect(accept.disabled).toBe(false);
    expect(reject.disabled).toBe(false);
  });

  it("still shows the stale explanation when explicitly disabled", () => {
    renderActions({
      isDisabled: true,
      staleMessage: "This proposal was made in an earlier session.",
    });
    const { accept, reject } = getButtons();
    expect(accept.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    expect(container.textContent).toContain(
      "This proposal was made in an earlier session."
    );
  });
});
