import { bindPendingDatasetWrite } from "../index";
import type { DatasetWriteApplyResult, PendingDatasetWrite } from "../types";

type ToolOutputCall = Record<string, unknown>;

function setup(applyResult: DatasetWriteApplyResult) {
  const outputs: ToolOutputCall[] = [];
  const pendingSets: Array<PendingDatasetWrite | null> = [];
  let applyCalls = 0;
  const pending = bindPendingDatasetWrite({
    pending: {
      toolCallId: "call-1",
      toolName: "add_dataset_examples",
      preview: { kind: "add", examples: [{ input: { q: "x" } }] },
    },
    apply: async () => {
      applyCalls += 1;
      return applyResult;
    },
    addToolOutput: async (out: ToolOutputCall) => {
      outputs.push(out);
    },
    setPendingDatasetWrite: (_toolCallId, value) => {
      pendingSets.push(value);
    },
  });
  return { pending, outputs, pendingSets, getApplyCalls: () => applyCalls };
}

describe("bindPendingDatasetWrite", () => {
  it("accept applies the write and emits an accepted output", async () => {
    const { pending, outputs, pendingSets, getApplyCalls } = setup({
      ok: true,
      output: "Added 1 example.",
    });
    await pending.accept?.();
    expect(getApplyCalls()).toBe(1);
    expect(pendingSets).toEqual([null]); // cleared the pending entry
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      state: "output-available",
      tool: "add_dataset_examples",
      toolCallId: "call-1",
      output: {
        status: "accepted",
        acceptedBy: "user",
        message: "Added 1 example.",
      },
    });
  });

  it("records the approval source (auto for bypass)", async () => {
    const { pending, outputs } = setup({ ok: true, output: "ok" });
    await pending.accept?.({ approvalSource: "auto" });
    expect(outputs[0].output).toMatchObject({ acceptedBy: "auto" });
  });

  it("reject discards without applying and emits a rejected output", async () => {
    const { pending, outputs, pendingSets, getApplyCalls } = setup({
      ok: true,
      output: "unused",
    });
    await pending.reject?.();
    expect(getApplyCalls()).toBe(0); // never wrote
    expect(pendingSets).toEqual([null]);
    expect(outputs[0]).toMatchObject({
      state: "output-available",
      output: { status: "rejected" },
    });
  });

  it("surfaces an apply failure as an output-error", async () => {
    const { pending, outputs } = setup({ ok: false, error: "boom" });
    await pending.accept?.();
    expect(outputs[0]).toMatchObject({
      state: "output-error",
      errorText: "boom",
    });
  });
});
