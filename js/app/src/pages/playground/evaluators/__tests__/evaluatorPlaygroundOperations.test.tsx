import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { dispatchUIOperationCall } from "@phoenix/agent/uiOperations/dispatch";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore } from "@phoenix/store/agentStore";

import type { EvaluatorAgentSlot } from "../evaluatorAgentSlot";
import { useEvaluatorPlaygroundAgent } from "../useEvaluatorPlaygroundAgent";

function setup(slot?: EvaluatorAgentSlot) {
  const agentStore = createAgentStore();
  agentStore.getState().setPermissions({ edits: "bypass" });
  const run = vi.fn(async () => ({
    ok: true as const,
    output: { mode: "evaluators", results: ["pass"] },
  }));
  const configure = vi.fn(async () => ({ ok: true as const }));
  function Host() {
    useEvaluatorPlaygroundAgent({
      getSlot: () => slot,
      readWorkspace: () => ({ mode: "evaluators" }),
      configureWorkspace: configure,
      selectSlot: async () => ({ ok: true }),
      runSlots: run,
      stopRuns: vi.fn(),
      reviewExample: async () => ({ ok: true }),
      isBusy: false,
    });
    return null;
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <AgentContext.Provider value={agentStore}>
        <Host />
      </AgentContext.Provider>
    )
  );
  const mounted = {
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
  function dispatch(operationName: string, input: unknown = {}) {
    return dispatchUIOperationCall({
      agentStore,
      operationName,
      input,
      callId: "test:1",
      sessionId: "test",
      capabilities: { "subagents.enabled": false, "web.access": false },
    });
  }
  return { agentStore, mounted, dispatch, run, configure };
}
describe("PXI evaluator mode dispatch", () => {
  it("saves through the slot adapter and rejects writes during an active save", async () => {
    let finish!: (result: { ok: true }) => void;
    const save = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          finish = resolve;
        })
    );
    const { mounted, dispatch, run } = setup({
      read: vi.fn(),
      edit: vi.fn(),
      save,
    });
    const pending = dispatch("evaluatorPlayground.saveSlot", {
      slot: "B",
      expectedRevision: "current",
    });
    await vi.waitFor(() => expect(save).toHaveBeenCalledWith("current"));
    expect(await dispatch("evaluatorPlayground.run")).toMatchObject({
      ok: false,
    });
    expect(run).not.toHaveBeenCalled();
    finish({ ok: true });
    expect(await pending).toMatchObject({ ok: true });
    expect(await dispatch("evaluatorPlayground.run")).toMatchObject({
      ok: true,
    });
    mounted.unmount();
  });
  it("exposes evaluator mode operations, not prompt run or evaluator-dialog edits", async () => {
    const { mounted, dispatch } = setup();
    expect(await dispatch("evaluatorPlayground.read")).toMatchObject({
      ok: true,
      output: { mode: "evaluators" },
    });
    expect(await dispatch("playground.run")).toMatchObject({
      ok: false,
      code: "NOT_AVAILABLE",
    });
    expect(await dispatch("evaluators.code.read")).toMatchObject({
      ok: false,
      code: "NOT_AVAILABLE",
    });
    mounted.unmount();
    expect(await dispatch("evaluatorPlayground.read")).toMatchObject({
      ok: false,
      code: "NOT_AVAILABLE",
    });
  });
  it("routes explicit B and awaits results, while rejecting invalid sample sizes", async () => {
    const { mounted, dispatch, run, configure } = setup();
    await act(async () => {
      expect(
        await dispatch("evaluatorPlayground.run", { slots: ["B"] })
      ).toMatchObject({ ok: true, output: { results: ["pass"] } });
    });
    expect(run).toHaveBeenCalledWith(["B"], undefined);
    expect(
      await dispatch("evaluatorPlayground.configure", { sampleSize: 501 })
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(configure).not.toHaveBeenCalled();
    mounted.unmount();
  });
  it("keeps script-level approval gating for evaluator writes", async () => {
    const { agentStore, mounted, dispatch, run } = setup();
    agentStore.getState().setPermissions({ edits: "manual" });
    expect(await dispatch("evaluatorPlayground.run")).toMatchObject({
      ok: false,
      code: "APPROVAL_REQUIRED",
    });
    expect(run).not.toHaveBeenCalled();
    mounted.unmount();
  });
});
