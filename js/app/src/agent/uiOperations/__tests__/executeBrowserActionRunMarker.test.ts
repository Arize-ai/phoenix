import { describe, expect, it, vi } from "vitest";

import { createAgentStore } from "@phoenix/store/agentStore";

import {
  abortActiveJSSandboxRun,
  executeBrowserActionTool,
} from "../executeBrowserActionTool";
import { runJSSandboxScript } from "../runtime/jsSandboxBridge";

vi.mock("../runtime/jsSandboxBridge", () => ({
  runJSSandboxScript: vi.fn(),
}));

describe("execute_browser_action run marker", () => {
  it("clears the run when the sandbox run is aborted", async () => {
    vi.mocked(runJSSandboxScript).mockImplementation(
      ({ registerAbort }) =>
        new Promise((resolve) => {
          registerAbort?.((reason) =>
            resolve({ ok: false, error: reason, callCount: 0, logs: [] })
          );
        })
    );
    const agentStore = createAgentStore();
    const dispatched = executeBrowserActionTool.dispatch({
      toolCall: {
        toolCallId: "tool-call-1",
        toolName: executeBrowserActionTool.name,
        input: { script: "await ui.timeRange.set({})" },
      },
      sessionId: "session-1",
      addToolOutput: vi.fn(async () => {}),
      appendMessagePart: vi.fn(),
      agentStore,
      capabilities: { "subagents.enabled": false, "web.access": false },
    });
    await vi.waitFor(() =>
      expect(
        agentStore.getState().browserActionRunsByToolCallId["tool-call-1"]
      ).toMatchObject({ sessionId: "session-1" })
    );

    abortActiveJSSandboxRun({ toolCallId: "tool-call-1", reason: "stopped" });
    await dispatched;

    expect(agentStore.getState().browserActionRunsByToolCallId).toEqual({});
  });

  it("clears a session's planned calls when its stream ends, leaving running calls", () => {
    const agentStore = createAgentStore();
    const state = agentStore.getState();
    state.markBrowserActionPlanned({ toolCallId: "planned", sessionId: "s-1" });
    state.startBrowserActionRun({ toolCallId: "running", sessionId: "s-1" });

    agentStore.getState().endPlannedBrowserActions("s-1");

    expect(
      Object.keys(agentStore.getState().browserActionRunsByToolCallId)
    ).toEqual(["running"]);
  });
});
