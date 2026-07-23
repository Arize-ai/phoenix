import { bindPendingApproval } from "../index";
import type { ApprovalApplyResult, PendingApproval } from "../types";

type ToolOutputCall = Record<string, unknown>;

function setup(applyResult: ApprovalApplyResult) {
  const outputs: ToolOutputCall[] = [];
  const pendingSets: Array<PendingApproval<{ kind: string }> | null> = [];
  let applyCalls = 0;
  const pending = bindPendingApproval<{ kind: string }>({
    pending: {
      toolCallId: "call-1",
      toolName: "some_write_tool",
      preview: { kind: "demo" },
    },
    apply: async () => {
      applyCalls += 1;
      return applyResult;
    },
    addToolOutput: async (out: ToolOutputCall) => {
      outputs.push(out);
    },
    setPending: (_toolCallId, value) => {
      pendingSets.push(value);
    },
    rejectedMessage: "nothing written",
  });
  return { pending, outputs, pendingSets, getApplyCalls: () => applyCalls };
}

describe("bindPendingApproval", () => {
  it("accept clears the pending entry, applies, and emits an accepted output", async () => {
    const { pending, outputs, pendingSets, getApplyCalls } = setup({
      ok: true,
      output: "done",
    });
    await pending.accept?.();
    expect(getApplyCalls()).toBe(1);
    expect(pendingSets).toEqual([null]);
    expect(outputs).toEqual([
      {
        state: "output-available",
        tool: "some_write_tool",
        toolCallId: "call-1",
        output: { status: "accepted", acceptedBy: "user", message: "done" },
      },
    ]);
  });

  it("records the approval source for an auto (bypass) accept", async () => {
    const { pending, outputs } = setup({ ok: true, output: "done" });
    await pending.accept?.({ approvalSource: "auto" });
    expect(outputs[0].output).toMatchObject({ acceptedBy: "auto" });
  });

  it("emits an error output without applying again when apply fails", async () => {
    const { pending, outputs } = setup({ ok: false, error: "boom" });
    await pending.accept?.();
    expect(outputs).toEqual([
      {
        state: "output-error",
        tool: "some_write_tool",
        toolCallId: "call-1",
        errorText: "boom",
      },
    ]);
  });

  it("reject clears the entry and reports the rejected message without applying", async () => {
    const { pending, outputs, pendingSets, getApplyCalls } = setup({
      ok: true,
      output: "done",
    });
    await pending.reject?.();
    expect(getApplyCalls()).toBe(0);
    expect(pendingSets).toEqual([null]);
    expect(outputs).toEqual([
      {
        state: "output-available",
        tool: "some_write_tool",
        toolCallId: "call-1",
        output: { status: "rejected", message: "nothing written" },
      },
    ]);
  });
});
