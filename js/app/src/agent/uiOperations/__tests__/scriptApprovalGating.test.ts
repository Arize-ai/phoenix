import { describe, expect, it, vi } from "vitest";

import type { AgentCapabilities } from "@phoenix/agent/extensions/capabilities";
import { createAgentStore } from "@phoenix/store/agentStore";

import { dispatchUIOperationCall } from "../dispatch";
import {
  SCRIPT_REJECTED_OUTPUT,
  stageScriptApproval,
} from "../executeBrowserActionTool";
import {
  grantScriptApproval,
  isOperationCallApprovalGranted,
  revokeScriptApproval,
} from "../scriptApprovalGrant";

const CAPABILITIES: AgentCapabilities = {
  "subagents.enabled": false,
  "web.access": false,
};

const HOST_TOOL_CALL_ID = "tool-call-1";

/** A write-kind catalog operation with a trivially valid input. */
const WRITE_OP = "timeRange.set";
const WRITE_OP_INPUT = { timeRangeKey: "7d" };
/** A read-kind catalog operation that takes an empty input. */
const READ_OP = "playground.model.list";

function setup() {
  const agentStore = createAgentStore();
  return { agentStore };
}

function dispatch({
  agentStore,
  operationName,
  input,
}: {
  agentStore: ReturnType<typeof createAgentStore>;
  operationName: string;
  input: unknown;
}) {
  return dispatchUIOperationCall({
    operationName,
    input,
    callId: `${HOST_TOOL_CALL_ID}:1`,
    agentStore,
    sessionId: "session-1",
    capabilities: CAPABILITIES,
  });
}

describe("scriptApprovalGrant registry", () => {
  it("resolves grants through the inner operation call id's host prefix", () => {
    expect(isOperationCallApprovalGranted("host-1:3")).toBe(false);
    grantScriptApproval("host-1");
    try {
      expect(isOperationCallApprovalGranted("host-1:3")).toBe(true);
      expect(isOperationCallApprovalGranted("host-1")).toBe(true);
      expect(isOperationCallApprovalGranted("host-2:1")).toBe(false);
    } finally {
      revokeScriptApproval("host-1");
    }
    expect(isOperationCallApprovalGranted("host-1:3")).toBe(false);
  });
});

describe("dispatch script-approval gate", () => {
  it("refuses a state-changing operation from an unapproved script in manual edit mode", async () => {
    const { agentStore } = setup();
    agentStore
      .getState()
      .registerClientAction(WRITE_OP, async () => ({ ok: true }));
    const result = await dispatch({
      agentStore,
      operationName: WRITE_OP,
      input: WRITE_OP_INPUT,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "APPROVAL_REQUIRED",
      error: expect.stringContaining("write_description"),
    });
  });

  it("lets a read operation through without any approval in manual edit mode", async () => {
    const { agentStore } = setup();
    agentStore.getState().registerClientAction(READ_OP, async () => ({
      ok: true,
      output: { builtinModels: [] },
    }));
    const result = await dispatch({
      agentStore,
      operationName: READ_OP,
      input: {},
    });
    expect(result).toMatchObject({ ok: true });
  });

  it("lets a state-changing operation through once the script run is granted", async () => {
    const { agentStore } = setup();
    const handler = vi.fn(async () => ({ ok: true as const }));
    agentStore.getState().registerClientAction(WRITE_OP, handler);
    grantScriptApproval(HOST_TOOL_CALL_ID);
    try {
      const result = await dispatch({
        agentStore,
        operationName: WRITE_OP,
        input: WRITE_OP_INPUT,
      });
      expect(result).toMatchObject({ ok: true });
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      revokeScriptApproval(HOST_TOOL_CALL_ID);
    }
  });

  it("does not gate state-changing operations in bypass edit mode", async () => {
    const { agentStore } = setup();
    agentStore.getState().setPermissions({ edits: "bypass" });
    agentStore
      .getState()
      .registerClientAction(WRITE_OP, async () => ({ ok: true }));
    const result = await dispatch({
      agentStore,
      operationName: WRITE_OP,
      input: WRITE_OP_INPUT,
    });
    expect(result).toMatchObject({ ok: true });
  });
});

describe("stageScriptApproval", () => {
  it("stages a pending entry, opens the host card, and resolves accepted", async () => {
    const { agentStore } = setup();
    const decisionPromise = stageScriptApproval({
      toolCallId: HOST_TOOL_CALL_ID,
      description: "This script will set the time range to 7 days.",
      agentStore,
    });
    const pending =
      agentStore.getState().pendingScriptApprovalsByToolCallId[
        HOST_TOOL_CALL_ID
      ];
    expect(pending).toMatchObject({
      toolCallId: HOST_TOOL_CALL_ID,
      description: "This script will set the time range to 7 days.",
    });
    await pending?.accept?.();
    await expect(decisionPromise).resolves.toEqual({ status: "accepted" });
    expect(
      agentStore.getState().pendingScriptApprovalsByToolCallId[
        HOST_TOOL_CALL_ID
      ]
    ).toBeUndefined();
  });

  it("resolves rejected and clears the pending entry", async () => {
    const { agentStore } = setup();
    const decisionPromise = stageScriptApproval({
      toolCallId: HOST_TOOL_CALL_ID,
      description: "This script will delete a dataset.",
      agentStore,
    });
    await agentStore
      .getState()
      .pendingScriptApprovalsByToolCallId[HOST_TOOL_CALL_ID]?.reject?.();
    await expect(decisionPromise).resolves.toEqual({ status: "rejected" });
    expect(
      agentStore.getState().pendingScriptApprovalsByToolCallId[
        HOST_TOOL_CALL_ID
      ]
    ).toBeUndefined();
    // The rejection message the tool reports back is a stable contract.
    expect(SCRIPT_REJECTED_OUTPUT).toContain("rejected");
  });

  it("settles as aborted when the registered abort fires (interrupt)", async () => {
    const { agentStore } = setup();
    let abort: ((reason: string) => void) | undefined;
    const decisionPromise = stageScriptApproval({
      toolCallId: HOST_TOOL_CALL_ID,
      description: "This script will annotate spans.",
      agentStore,
      registerAbort: (callback) => {
        abort = callback;
      },
    });
    abort?.("The script run was interrupted.");
    await expect(decisionPromise).resolves.toEqual({
      status: "aborted",
      reason: "The script run was interrupted.",
    });
    expect(
      agentStore.getState().pendingScriptApprovalsByToolCallId[
        HOST_TOOL_CALL_ID
      ]
    ).toBeUndefined();
    // A late decision after the abort is a no-op, not a double settle.
    await expect(decisionPromise).resolves.toEqual({
      status: "aborted",
      reason: "The script run was interrupted.",
    });
  });
});
