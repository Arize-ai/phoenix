import {
  applyDraftOperations,
  bindPendingCodeEvaluatorCreateHandoffActions,
  buildDraftRevision,
  CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR,
  type CodeEvaluatorDraftHost,
  type CodeEvaluatorDraftSnapshot,
  createEditCodeEvaluatorDraftClientAction,
  createReadCodeEvaluatorDraftClientAction,
  type EditCodeEvaluatorDraftOperation,
  type PendingCodeEvaluatorCreate,
  type PendingCodeEvaluatorEdit,
  type SandboxConfigIndex,
} from "@phoenix/agent/tools/codeEvaluatorDraft";

function makeSnapshot(
  overrides: Partial<Omit<CodeEvaluatorDraftSnapshot, "revision">> = {}
): CodeEvaluatorDraftSnapshot {
  const base: Omit<CodeEvaluatorDraftSnapshot, "revision"> = {
    mode: "create",
    evaluatorNodeId: null,
    name: "hallucination",
    description: "",
    language: "PYTHON",
    sourceCode: "def evaluate(output):\n    return 1.0",
    sandboxConfigId: null,
    inputMapping: { pathMapping: {}, literalMapping: {} },
    outputConfigs: [],
    ...overrides,
  };
  return { ...base, revision: buildDraftRevision(base) };
}

function makeHost(
  initial: CodeEvaluatorDraftSnapshot,
  sandboxConfigs: SandboxConfigIndex = {}
): {
  host: CodeEvaluatorDraftHost;
  snapshotRef: { current: CodeEvaluatorDraftSnapshot };
} {
  const snapshotRef = { current: initial };
  const previewOperations = (
    snapshot: CodeEvaluatorDraftSnapshot,
    operations: EditCodeEvaluatorDraftOperation[]
  ) => applyDraftOperations({ snapshot, operations, sandboxConfigs });
  const host: CodeEvaluatorDraftHost = {
    getSnapshot: () => snapshotRef.current,
    previewOperations,
    applyOperations: (operations) => {
      const proposed = previewOperations(snapshotRef.current, operations);
      if (!proposed.ok) return proposed;
      snapshotRef.current = proposed.output;
      return { ok: true, output: proposed.output };
    },
  };
  return { host, snapshotRef };
}

describe("code evaluator draft agent tools", () => {
  it("reads a snapshot with a content-hash revision", async () => {
    const { host } = makeHost(makeSnapshot());
    const action = createReadCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await action({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = JSON.parse(
      result.output ?? ""
    ) as CodeEvaluatorDraftSnapshot;
    expect(snapshot.revision).toMatch(/^code-evaluator-draft-/);
    expect(snapshot.mode).toBe("create");
  });

  it("rejects set_language in edit mode (language is immutable)", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ mode: "edit", evaluatorNodeId: "abc" }),
      operations: [{ type: "set_language", language: "TYPESCRIPT" }],
      sandboxConfigs: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/language is immutable/i);
  });

  it("clears incompatible sandbox selection when set_language changes the language in create mode", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({
        language: "PYTHON",
        sandboxConfigId: "py-sandbox",
      }),
      operations: [{ type: "set_language", language: "TYPESCRIPT" }],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
        "ts-sandbox": { language: "TYPESCRIPT" },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.language).toBe("TYPESCRIPT");
    expect(result.output.sandboxConfigId).toBeNull();
  });

  it("rejects set_sandbox_config whose config language does not match draft language", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ language: "PYTHON" }),
      operations: [
        { type: "set_sandbox_config", sandboxConfigId: "ts-sandbox" },
      ],
      sandboxConfigs: { "ts-sandbox": { language: "TYPESCRIPT" } },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/does not match the draft language/i);
  });

  it("rejects the propose-time edit when expectedRevision is stale", async () => {
    const initial = makeSnapshot();
    const { host, snapshotRef } = makeHost(initial);
    // Mutate the host so the next read returns a different revision than the
    // model holds in `expectedRevision`.
    snapshotRef.current = makeSnapshot({ description: "drifted" });

    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: () => undefined,
    });
    const result = await action(
      {
        expectedRevision: initial.revision,
        operations: [{ type: "set_description", description: "from model" }],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async () => undefined,
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/changed since it was last viewed/i);
  });

  it("registers a pending edit when the propose-time gate passes", async () => {
    const initial = makeSnapshot();
    const { host } = makeHost(initial);
    let pending: PendingCodeEvaluatorEdit | null = null;
    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    const result = await action(
      {
        expectedRevision: initial.revision,
        operations: [{ type: "set_description", description: "from model" }],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async () => undefined,
      }
    );
    expect(result.ok).toBe(true);
    expect(pending).not.toBeNull();
    expect(pending!.after.description).toBe("from model");
    expect(pending!.before.revision).toBe(initial.revision);
  });

  it("rejects accept when the draft revision drifted after propose", async () => {
    const initial = makeSnapshot();
    const { host, snapshotRef } = makeHost(initial);
    let pending: PendingCodeEvaluatorEdit | null = null;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    await action(
      {
        expectedRevision: initial.revision,
        operations: [{ type: "set_description", description: "from model" }],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async (payload: Record<string, unknown>) => {
          outputs.push(payload);
        },
      }
    );
    expect(pending).not.toBeNull();
    // User edits the form before accepting.
    snapshotRef.current = makeSnapshot({ description: "user edit" });

    await pending!.accept!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-error" });
    expect(String(outputs[0].errorText)).toMatch(/changed after this edit/i);
    // Form must NOT have been mutated by the stale accept.
    expect(snapshotRef.current.description).toBe("user edit");
  });

  it("applies the pending edit on accept when revision still matches", async () => {
    const initial = makeSnapshot();
    const { host, snapshotRef } = makeHost(initial);
    let pending: PendingCodeEvaluatorEdit | null = null;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    await action(
      {
        expectedRevision: initial.revision,
        operations: [{ type: "set_description", description: "accepted" }],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async (payload: Record<string, unknown>) => {
          outputs.push(payload);
        },
      }
    );
    await pending!.accept!();
    expect(snapshotRef.current.description).toBe("accepted");
    expect(outputs[0]).toMatchObject({ state: "output-available" });
  });

  it("leaves the form unchanged when the user rejects the proposed edit", async () => {
    const initial = makeSnapshot({ description: "original" });
    const { host, snapshotRef } = makeHost(initial);
    let pending: PendingCodeEvaluatorEdit | null = null;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    await action(
      {
        expectedRevision: initial.revision,
        operations: [{ type: "set_description", description: "from model" }],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async (payload: Record<string, unknown>) => {
          outputs.push(payload);
        },
      }
    );
    await pending!.reject!();
    expect(snapshotRef.current.description).toBe("original");
    expect(outputs[0]).toMatchObject({
      state: "output-available",
      output: expect.objectContaining({ status: "rejected" }),
    });
  });
});

describe("pending create handoff terminal-state contract", () => {
  type Output = Record<string, unknown>;

  function makeHandoff() {
    const proposed = makeSnapshot({ description: "from agent" });
    const before = makeSnapshot({
      name: "",
      description: "",
      sourceCode: "",
      sandboxConfigId: null,
    });
    const outputs: Output[] = [];
    const stored: Record<string, PendingCodeEvaluatorCreate | null> = {};
    const setPending = (
      toolCallId: string,
      pending: PendingCodeEvaluatorCreate | null
    ) => {
      stored[toolCallId] = pending;
    };
    const bound = bindPendingCodeEvaluatorCreateHandoffActions({
      pendingCreate: {
        kind: "handoff",
        toolCallId: "tc-1",
        sessionId: "s-1",
        before,
        after: proposed,
        datasetContext: {
          datasetNodeId: "ds-1",
          datasetVersionNodeId: null,
        },
        resolved: false,
      },
      addToolOutput: async (payload: Output) => {
        outputs.push(payload);
      },
      setPendingCodeEvaluatorCreate: setPending,
    });
    stored["tc-1"] = bound;
    return { bound, outputs, stored };
  }

  it("emits a single accepted output on resolveAsAccepted", async () => {
    const { bound, outputs, stored } = makeHandoff();
    await bound.resolveAsAccepted!({
      createdEvaluator: { id: "ev-1", name: "from agent" },
      datasetEvaluatorId: "de-1",
    });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "accepted",
      createdEvaluator: { id: "ev-1", name: "from agent" },
      datasetEvaluatorId: "de-1",
    });
    expect(stored["tc-1"]).toBeNull();
    expect(bound.resolved).toBe(true);
  });

  it("emits a single rejected output on resolveAsRejected", async () => {
    const { bound, outputs, stored } = makeHandoff();
    await bound.resolveAsRejected!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "rejected",
    });
    expect(stored["tc-1"]).toBeNull();
  });

  it("emits output-error on resolveAsFailed carrying the error message", async () => {
    const { bound, outputs } = makeHandoff();
    await bound.resolveAsFailed!("mutation went wrong");
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      state: "output-error",
      errorText: "mutation went wrong",
    });
  });

  it("emits CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR on cancel before resolution", async () => {
    const { bound, outputs } = makeHandoff();
    await bound.cancel!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      state: "output-error",
      errorText: CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR,
    });
  });

  it("is idempotent — close-after-save does not re-emit a rejected output", async () => {
    const { bound, outputs } = makeHandoff();
    await bound.resolveAsAccepted!({
      createdEvaluator: { id: "ev-1", name: "from agent" },
      datasetEvaluatorId: "de-1",
    });
    // Slideover's onOpenChange(false) fires after Save closes the modal.
    await bound.resolveAsRejected!();
    await bound.cancel!();
    expect(outputs).toHaveLength(1);
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "accepted",
    });
  });

  it("ignores cancel after a terminal resolver fires", async () => {
    const { bound, outputs } = makeHandoff();
    await bound.resolveAsFailed!("the chained mutation failed");
    await bound.cancel!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      state: "output-error",
      errorText: "the chained mutation failed",
    });
  });
});
