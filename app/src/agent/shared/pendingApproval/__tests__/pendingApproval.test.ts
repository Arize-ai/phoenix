import { bindPendingApproval } from "../index";
import type {
  ApprovalCommitResult,
  ApprovalSource,
  PendingApprovalActions,
  PendingApprovalIdentity,
} from "../types";

type ToolOutputCall = Record<string, unknown>;

type DemoPending = PendingApprovalIdentity &
  PendingApprovalActions & {
    kind: string;
  };

function setup(commitResult: ApprovalCommitResult) {
  const outputs: ToolOutputCall[] = [];
  const cleared: string[] = [];
  let commitCalls = 0;
  let lastApprovalSource: ApprovalSource | null = null;
  const pending = bindPendingApproval<DemoPending>({
    pending: {
      toolCallId: "call-1",
      toolName: "some_write_tool",
      kind: "demo",
    },
    commit: async ({ approvalSource }) => {
      commitCalls += 1;
      lastApprovalSource = approvalSource;
      return commitResult;
    },
    buildRejectedOutput: () => ({ status: "rejected", message: "nothing written" }),
    navigationCancelError: "surface closed",
    addToolOutput: (async (out: ToolOutputCall) => {
      outputs.push(out);
    }) as never,
    clearPending: (toolCallId) => {
      cleared.push(toolCallId);
    },
  });
  return {
    pending,
    outputs,
    cleared,
    getCommitCalls: () => commitCalls,
    getLastApprovalSource: () => lastApprovalSource,
  };
}

describe("bindPendingApproval", () => {
  it("preserves the serializable pending data alongside the bound actions", () => {
    const { pending } = setup({ ok: true, output: "done" });
    expect(pending.toolCallId).toBe("call-1");
    expect(pending.toolName).toBe("some_write_tool");
    expect(pending.kind).toBe("demo");
    expect(typeof pending.accept).toBe("function");
    expect(typeof pending.reject).toBe("function");
    expect(typeof pending.cancel).toBe("function");
  });

  it("accept clears the pending entry, commits, and emits the commit output", async () => {
    const { pending, outputs, cleared, getCommitCalls, getLastApprovalSource } =
      setup({ ok: true, output: { status: "accepted", message: "done" } });
    await pending.accept?.();
    expect(getCommitCalls()).toBe(1);
    expect(getLastApprovalSource()).toBe("user");
    expect(cleared).toEqual(["call-1"]);
    expect(outputs).toEqual([
      {
        state: "output-available",
        tool: "some_write_tool",
        toolCallId: "call-1",
        output: { status: "accepted", message: "done" },
      },
    ]);
  });

  it("forwards the approval source for an auto (bypass) accept", async () => {
    const { pending, getLastApprovalSource } = setup({
      ok: true,
      output: "done",
    });
    await pending.accept?.({ approvalSource: "auto" });
    expect(getLastApprovalSource()).toBe("auto");
  });

  it("emits an error output when the commit fails", async () => {
    const { pending, outputs, cleared } = setup({ ok: false, error: "boom" });
    await pending.accept?.();
    expect(cleared).toEqual(["call-1"]);
    expect(outputs).toEqual([
      {
        state: "output-error",
        tool: "some_write_tool",
        toolCallId: "call-1",
        errorText: "boom",
      },
    ]);
  });

  it("reject clears the entry and reports the rejected output without committing", async () => {
    const { pending, outputs, cleared, getCommitCalls } = setup({
      ok: true,
      output: "done",
    });
    await pending.reject?.();
    expect(getCommitCalls()).toBe(0);
    expect(cleared).toEqual(["call-1"]);
    expect(outputs).toEqual([
      {
        state: "output-available",
        tool: "some_write_tool",
        toolCallId: "call-1",
        output: { status: "rejected", message: "nothing written" },
      },
    ]);
  });

  it("cancel clears the entry and reports the navigation-cancel error", async () => {
    const { pending, outputs, cleared, getCommitCalls } = setup({
      ok: true,
      output: "done",
    });
    await pending.cancel?.();
    expect(getCommitCalls()).toBe(0);
    expect(cleared).toEqual(["call-1"]);
    expect(outputs).toEqual([
      {
        state: "output-error",
        tool: "some_write_tool",
        toolCallId: "call-1",
        errorText: "surface closed",
      },
    ]);
  });
});
