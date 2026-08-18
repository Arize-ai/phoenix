import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore, type AgentStore } from "@phoenix/store/agentStore";

import {
  ToolApprovalRequest,
  UNREACHABLE_CHAT_MESSAGE,
} from "../ToolApprovalRequest";
import type { ToolInvocationPart } from "../toolPartTypes";

installTestStorage();

const SESSION_ID = "session-1";
const APPROVAL_ID = "approval-1";

const addToolApprovalResponse = vi.fn();
/** The chat the runtime hands back, or null to simulate an evicted session. */
let residentChat: {
  addToolApprovalResponse: typeof addToolApprovalResponse;
} | null = null;

vi.mock("@phoenix/contexts/AgentChatRuntimeContext", () => ({
  useAgentChatRuntime: () => ({
    getChat: () => residentChat,
    getOrCreateChat: vi.fn(),
    evictChat: vi.fn(),
  }),
}));

function approvalRequestedPart(): ToolInvocationPart {
  return {
    type: "tool-bash",
    toolCallId: "tool-call-1",
    state: "approval-requested",
    input: { command: "phoenix-gql 'mutation { deleteEverything }'" },
    approval: { id: APPROVAL_ID },
  } as unknown as ToolInvocationPart;
}

describe("ToolApprovalRequest", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;

  beforeEach(() => {
    localStorage.removeItem("arize-phoenix-assistant");
    addToolApprovalResponse.mockClear();
    residentChat = { addToolApprovalResponse };
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

  function renderRequest(part: ToolInvocationPart = approvalRequestedPart()) {
    act(() => {
      root.render(
        <AgentContext.Provider value={store}>
          <ToolApprovalRequest part={part} denialReason="Too destructive" />
        </AgentContext.Provider>
      );
    });
  }

  function getButtons() {
    const buttons = Array.from(container.querySelectorAll("button"));
    return {
      accept: buttons.find(
        (button) => button.textContent === "Accept"
      ) as HTMLButtonElement,
      reject: buttons.find(
        (button) => button.textContent === "Reject"
      ) as HTMLButtonElement,
    };
  }

  it("sends the approval when the session's chat is reachable", () => {
    renderRequest();

    act(() => {
      getButtons().accept.click();
    });

    expect(addToolApprovalResponse).toHaveBeenCalledWith({
      id: APPROVAL_ID,
      approved: true,
    });
  });

  it("sends a denial with its reason on Reject", () => {
    renderRequest();

    act(() => {
      getButtons().reject.click();
    });

    expect(addToolApprovalResponse).toHaveBeenCalledWith({
      id: APPROVAL_ID,
      approved: false,
      reason: "Too destructive",
    });
  });

  it("disables the buttons and says why when no chat is reachable", () => {
    // The regression: the callback used to return early here, so the click was
    // accepted and the user's decision silently dropped with no feedback.
    residentChat = null;

    renderRequest();

    const { accept, reject } = getButtons();
    expect(accept.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    expect(container.textContent).toContain(UNREACHABLE_CHAT_MESSAGE);
  });

  it("renders nothing for a part that is not awaiting approval", () => {
    renderRequest({
      ...approvalRequestedPart(),
      state: "output-available",
    } as unknown as ToolInvocationPart);

    expect(container.textContent).toBe("");
  });
});
