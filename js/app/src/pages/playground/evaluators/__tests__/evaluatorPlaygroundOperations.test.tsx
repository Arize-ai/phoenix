import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { dispatchUIOperationCall } from "@phoenix/agent/uiOperations/dispatch";
import type { EvaluatorWorkspaceReadOutput } from "@phoenix/agent/uiOperations/operations/evaluatorPlayground";
import { AgentContext } from "@phoenix/contexts/AgentContext";
import { createAgentStore } from "@phoenix/store/agentStore";

import type { EvaluatorAgentSlot } from "../evaluatorAgentSlot";
import { useEvaluatorPlaygroundAgent } from "../useEvaluatorPlaygroundAgent";
import type { EvaluatorWorkspaceRead } from "../useEvaluatorPlaygroundAgent";

const emptyWorkspace: EvaluatorWorkspaceRead = {
  mode: "evaluators",
  source: null,
  sampleSize: 20,
  sampleLoaded: false,
  totalExamples: 0,
  isRunning: false,
  staleSlots: [],
  slots: [],
  examples: [],
  nextOffset: null,
};

function setup(slot?: EvaluatorAgentSlot) {
  const agentStore = createAgentStore();
  agentStore.getState().setPermissions({ edits: "bypass" });

  const run = vi.fn(async () => ({
    ok: true as const,
    output: { mode: "evaluators", results: ["pass"] },
  }));

  const configure = vi.fn(async () => ({ ok: true as const }));

  const readFilterHelp = vi.fn(async () => ({
    ok: true as const,
    output: { fields: [], notes: [], examples: [], project: null },
  }));

  function Host() {
    useEvaluatorPlaygroundAgent({
      getSlot: () => slot,
      readWorkspace: () => emptyWorkspace,
      configureWorkspace: configure,
      readFilterHelp,
      selectSlot: async () => ({ ok: true }),
      runSlots: run,
      stopRuns: vi.fn(),
      writeExpectedOutput: async () => ({ ok: true }),
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

  return { agentStore, mounted, dispatch, run, configure, readFilterHelp };
}

describe("PXI evaluator mode dispatch", () => {
  it("documents the read output with the shape the page returns", () => {
    expectTypeOf<EvaluatorWorkspaceRead>().toMatchTypeOf<EvaluatorWorkspaceReadOutput>();
  });
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
      saveFilter: vi.fn(),
    });

    const pending = dispatch("evaluatorPlayground.saveSlot", {
      slot: "B",
      expectedRevision: "current",
    });

    await vi.waitFor(() => expect(save).toHaveBeenCalledWith("current", {}));
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
  it("passes save options through to the slot and exposes filter help", async () => {
    const save = vi.fn(async () => ({ ok: true as const }));

    const { mounted, dispatch, readFilterHelp } = setup({
      read: vi.fn(),
      edit: vi.fn(),
      save,
      saveFilter: vi.fn(),
    });

    expect(
      await dispatch("evaluatorPlayground.saveSlot", {
        slot: "A",
        expectedRevision: "current",
        filterCondition: "",
        samplingRate: 0.5,
        asNew: true,
      })
    ).toMatchObject({ ok: true });
    expect(save).toHaveBeenCalledWith("current", {
      filterCondition: "",
      samplingRate: 0.5,
      asNew: true,
    });
    expect(
      await dispatch("evaluatorPlayground.saveSlot", {
        slot: "A",
        expectedRevision: "current",
        samplingRate: 2,
      })
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await dispatch("evaluatorPlayground.readFilterHelp")).toMatchObject({
      ok: true,
      output: { project: null },
    });
    expect(readFilterHelp).toHaveBeenCalledOnce();
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
