import {
  applyDraftOperations,
  bindPendingCodeEvaluatorCreateActions,
  buildDraftRevision,
  type CodeEvaluatorDraftHost,
  type CodeEvaluatorDraftSnapshot,
  createEditCodeEvaluatorDraftClientAction,
  createReadCodeEvaluatorDraftClientAction,
  type EditCodeEvaluatorDraftOperation,
  type PendingCodeEvaluatorCreate,
  type PendingCodeEvaluatorCreateDatasetSnapshot,
  type PendingCodeEvaluatorEdit,
  type SandboxConfigIndex,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import { dispatchCreateCodeEvaluator } from "@phoenix/agent/tools/createCodeEvaluator/dispatch";

vi.mock("@phoenix/agent/tools/createCodeEvaluator/dispatch", () => ({
  dispatchCreateCodeEvaluator: vi.fn(),
}));

const mockedDispatch = vi.mocked(dispatchCreateCodeEvaluator);

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

describe("pending create accept routes dataset context through dispatch", () => {
  type Output = Record<string, unknown>;

  function makeBound(
    datasetContext: PendingCodeEvaluatorCreateDatasetSnapshot | null
  ) {
    const proposed = makeSnapshot({
      description: "from agent",
      sandboxConfigId: "py-sandbox",
    });
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
    const bound = bindPendingCodeEvaluatorCreateActions({
      pendingCreate: {
        toolCallId: "tc-1",
        sessionId: "s-1",
        before,
        after: proposed,
        datasetContext,
      },
      addToolOutput: async (payload: Output) => {
        outputs.push(payload);
      },
      setPendingCodeEvaluatorCreate: setPending,
    });
    stored["tc-1"] = bound;
    return { bound, outputs, stored };
  }

  beforeEach(() => {
    mockedDispatch.mockReset();
  });

  it("threads the snapshotted dataset context into dispatchCreateCodeEvaluator on accept", async () => {
    const datasetContext: PendingCodeEvaluatorCreateDatasetSnapshot = {
      datasetNodeId: "ds-1",
      datasetVersionNodeId: null,
    };
    mockedDispatch.mockResolvedValueOnce({
      ok: true,
      evaluator: { id: "ev-1", name: "from agent" },
      datasetEvaluatorId: "de-1",
    });
    const { bound, outputs, stored } = makeBound(datasetContext);
    await bound.accept!();
    expect(mockedDispatch).toHaveBeenCalledTimes(1);
    const [, options] = mockedDispatch.mock.calls[0];
    expect(options).toEqual({ datasetContext, connectionIds: [] });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "accepted",
      createdEvaluator: { id: "ev-1", name: "from agent" },
      datasetEvaluatorId: "de-1",
    });
    expect(stored["tc-1"]).toBeNull();
  });

  it("passes datasetContext: null when the proposal was made off-dataset", async () => {
    mockedDispatch.mockResolvedValueOnce({
      ok: true,
      evaluator: { id: "ev-2", name: "from agent" },
      datasetEvaluatorId: null,
    });
    const { bound } = makeBound(null);
    await bound.accept!();
    expect(mockedDispatch).toHaveBeenCalledTimes(1);
    const [, options] = mockedDispatch.mock.calls[0];
    expect(options).toEqual({ datasetContext: null, connectionIds: [] });
  });

  it("emits output-error when dispatch fails and does not call addToolOutput with output-available", async () => {
    mockedDispatch.mockResolvedValueOnce({
      ok: false,
      error: "the chained mutation failed",
    });
    const { bound, outputs } = makeBound({
      datasetNodeId: "ds-1",
      datasetVersionNodeId: null,
    });
    await bound.accept!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({
      state: "output-error",
      errorText: "the chained mutation failed",
    });
  });

  it("rejects without invoking dispatch", async () => {
    const { bound, outputs, stored } = makeBound(null);
    await bound.reject!();
    expect(mockedDispatch).not.toHaveBeenCalled();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "rejected",
    });
    expect(stored["tc-1"]).toBeNull();
  });
});
