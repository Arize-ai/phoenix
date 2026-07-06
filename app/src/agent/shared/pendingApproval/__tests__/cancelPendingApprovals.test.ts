import { cancelPendingApprovalsForTools } from "../cancelPendingApprovals";
import type {
  PendingApproval,
  PendingApprovalsByToolCallId,
} from "../registry";
import { selectPendingApproval } from "../selectPendingApproval";

/**
 * Builds a minimal pending-approval stand-in. The union is exercised
 * structurally here (only the identity + `cancel` matter to these helpers), so
 * a cast keeps the fixtures free of each tool's full preview payload.
 */
function fakePending(
  toolCallId: string,
  toolName: string,
  cancel: () => Promise<void>
): PendingApproval {
  return { toolCallId, toolName, cancel } as unknown as PendingApproval;
}

describe("selectPendingApproval", () => {
  it("returns the staged approval for a tool call, or null when absent", () => {
    const pending = fakePending("call-1", "save_prompt", async () => {});
    const state = {
      pendingApprovalsByToolCallId: {
        "call-1": pending,
      } satisfies PendingApprovalsByToolCallId,
    };
    expect(selectPendingApproval(state, "call-1")).toBe(pending);
    expect(selectPendingApproval(state, "missing")).toBeNull();
  });
});

describe("cancelPendingApprovalsForTools", () => {
  it("cancels only approvals owned by the given tool names", () => {
    const calls: string[] = [];
    const record: PendingApprovalsByToolCallId = {
      "call-save": fakePending("call-save", "save_prompt", async () => {
        calls.push("call-save");
      }),
      "call-load": fakePending("call-load", "load_dataset", async () => {
        calls.push("call-load");
      }),
      "call-eval": fakePending(
        "call-eval",
        "edit_code_evaluator_draft",
        async () => {
          calls.push("call-eval");
        }
      ),
    };

    cancelPendingApprovalsForTools({
      pendingApprovalsByToolCallId: record,
      toolNames: ["save_prompt", "load_dataset"],
    });

    // The evaluator approval is owned by a different surface and left untouched.
    expect(calls.sort()).toEqual(["call-load", "call-save"]);
  });

  it("ignores tool names with no staged approval", () => {
    expect(() =>
      cancelPendingApprovalsForTools({
        pendingApprovalsByToolCallId: {},
        toolNames: ["save_prompt"],
      })
    ).not.toThrow();
  });
});
