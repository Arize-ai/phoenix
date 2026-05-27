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
  parseEditCodeEvaluatorDraftInput,
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
    sandboxConfigId: "py-sandbox",
    inputMapping: { pathMapping: {}, literalMapping: {} },
    outputConfigs: [],
    ...overrides,
  };
  return { ...base, revision: buildDraftRevision(base) };
}

function makeHost(
  initial: CodeEvaluatorDraftSnapshot,
  sandboxConfigs: SandboxConfigIndex = {
    "py-sandbox": { language: "PYTHON" },
    "ts-sandbox": { language: "TYPESCRIPT" },
  }
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

  it("accepts set_language when a compatible sandbox is selected in the same create-mode proposal", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({
        language: "PYTHON",
        sandboxConfigId: "py-sandbox",
      }),
      operations: [
        { type: "set_language", language: "TYPESCRIPT" },
        { type: "set_sandbox_config", sandboxConfigId: "ts-sandbox" },
      ],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
        "ts-sandbox": { language: "TYPESCRIPT" },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.language).toBe("TYPESCRIPT");
    expect(result.output.sandboxConfigId).toBe("ts-sandbox");
  });

  it("rejects create-mode proposals that leave the sandbox selection empty", () => {
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
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/requires a non-null sandboxConfigId/i);
  });

  it("rejects explicit null sandbox selections in create mode", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ language: "PYTHON" }),
      operations: [{ type: "set_sandbox_config", sandboxConfigId: null }],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/requires a non-null sandboxConfigId/i);
  });

  it("rejects create-mode edits that omit a required sandbox on an empty draft", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ language: "PYTHON", sandboxConfigId: null }),
      operations: [{ type: "set_description", description: "from model" }],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/requires a non-null sandboxConfigId/i);
  });

  it("allows clearing sandbox selection in edit mode", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({
        mode: "edit",
        evaluatorNodeId: "abc",
        language: "PYTHON",
        sandboxConfigId: "py-sandbox",
      }),
      operations: [{ type: "set_sandbox_config", sandboxConfigId: null }],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
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

  it("rejects set_output_configs operations with blank output config names", () => {
    const parsed = parseEditCodeEvaluatorDraftInput({
      expectedRevision: "code-evaluator-draft-abc",
      operations: [
        {
          type: "set_output_configs",
          output_configs: [
            {
              kind: "freeform",
              name: "",
              optimizationDirection: "MAXIMIZE",
              threshold: 0.5,
              lowerBound: 0,
              upperBound: 1,
            },
          ],
        },
      ],
    });
    expect(parsed).toBeNull();
  });

  it("normalizes snake_case aliases in draft edit operations", () => {
    const parsed = parseEditCodeEvaluatorDraftInput({
      expected_revision: "code-evaluator-draft-abc",
      operations: [
        {
          type: "set_input_mapping",
          input_mapping: {
            path_mapping: { output: "attributes.output.value" },
            literal_mapping: { threshold: 0.5 },
          },
        },
        {
          type: "set_output_configs",
          output_configs: [
            {
              kind: "freeform",
              name: "quality",
              optimization_direction: "MAXIMIZE",
              threshold: 0.5,
              lower_bound: 0,
              upper_bound: 1,
            },
          ],
        },
      ],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.expectedRevision).toBe("code-evaluator-draft-abc");
    expect(parsed!.operations[0]).toEqual({
      type: "set_input_mapping",
      inputMapping: {
        pathMapping: { output: "attributes.output.value" },
        literalMapping: { threshold: 0.5 },
      },
    });
    expect(parsed!.operations[1]).toEqual({
      type: "set_output_configs",
      outputConfigs: [
        {
          kind: "freeform",
          name: "quality",
          optimizationDirection: "MAXIMIZE",
          threshold: 0.5,
          lowerBound: 0,
          upperBound: 1,
        },
      ],
    });
  });

  it("accepts a single top-level operation next to expectedRevision", () => {
    const parsed = parseEditCodeEvaluatorDraftInput({
      expectedRevision: "code-evaluator-draft-abc",
      type: "set_description",
      description: "Scores whether the output includes a tool call.",
    });
    expect(parsed).toEqual({
      expectedRevision: "code-evaluator-draft-abc",
      operations: [
        {
          type: "set_description",
          description: "Scores whether the output includes a tool call.",
        },
      ],
    });
  });

  it("accepts the read snapshot revision field as the expected revision", () => {
    const parsed = parseEditCodeEvaluatorDraftInput({
      revision: "code-evaluator-draft-abc",
      operations: [
        {
          type: "set_description",
          description: "Scores whether the output includes a tool call.",
        },
      ],
    });
    expect(parsed).toEqual({
      expectedRevision: "code-evaluator-draft-abc",
      operations: [
        {
          type: "set_description",
          description: "Scores whether the output includes a tool call.",
        },
      ],
    });
  });

  it("rejects the propose-time edit when expectedRevision is stale", async () => {
    const initial = makeSnapshot();
    const { host, snapshotRef } = makeHost(initial);
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

  it("registers a pending edit from a read revision and model-ish aliases", async () => {
    const initial = makeSnapshot();
    const { host } = makeHost(initial);
    const readAction = createReadCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const readResult = await readAction({});
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    const readSnapshot = JSON.parse(
      readResult.output ?? ""
    ) as CodeEvaluatorDraftSnapshot;

    let pending: PendingCodeEvaluatorEdit | null = null;
    const editAction = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    const editResult = await editAction(
      {
        revision: readSnapshot.revision,
        type: "set_output_configs",
        output_configs: [
          {
            kind: "freeform",
            name: "quality",
            optimization_direction: "MAXIMIZE",
            threshold: 0.5,
            lower_bound: 0,
            upper_bound: 1,
          },
        ],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async () => undefined,
      }
    );
    expect(editResult.ok).toBe(true);
    expect(pending).not.toBeNull();
    expect(pending!.after.outputConfigs).toEqual([
      {
        kind: "freeform",
        name: "quality",
        optimizationDirection: "MAXIMIZE",
        threshold: 0.5,
        lowerBound: 0,
        upperBound: 1,
      },
    ]);
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
    snapshotRef.current = makeSnapshot({ description: "user edit" });

    await pending!.accept!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-error" });
    expect(String(outputs[0].errorText)).toMatch(/changed after this edit/i);
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

describe("pending create two-phase proposal lifecycle", () => {
  type Output = Record<string, unknown>;

  const datasetContext: PendingCodeEvaluatorCreateDatasetSnapshot = {
    datasetNodeId: "ds-1",
  };

  function makeBound() {
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

  it("starts in phase preview with resolved=false and no tool output", () => {
    const { bound, outputs } = makeBound();
    expect(bound.phase).toBe("preview");
    expect(bound.resolved).toBe(false);
    expect(outputs).toHaveLength(0);
  });

  it("accept flips phase to awaiting-slideover without emitting a tool output", async () => {
    const { bound, outputs, stored } = makeBound();
    await bound.accept!();
    expect(outputs).toHaveLength(0);
    const updated = stored["tc-1"];
    expect(updated).not.toBeNull();
    expect(updated!.phase).toBe("awaiting-slideover");
    expect(updated!.resolved).toBe(false);
  });

  it("reject from preview is terminal and emits a rejected output", async () => {
    const { bound, outputs, stored } = makeBound();
    await bound.reject!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "rejected",
    });
    expect(stored["tc-1"]).toBeNull();
  });

  it("resolveAsAccepted emits accepted with the created evaluator and binding id", async () => {
    const { bound, outputs, stored } = makeBound();
    await bound.accept!();
    await bound.resolveAsAccepted!({
      datasetEvaluatorId: "de-1",
      createdEvaluator: { id: "ev-1", name: "from agent" },
    });
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "accepted",
      datasetEvaluatorId: "de-1",
      createdEvaluator: { id: "ev-1", name: "from agent" },
    });
    expect(stored["tc-1"]).toBeNull();
  });

  it("resolveAsRejected from the slideover emits a rejected output", async () => {
    const { bound, outputs, stored } = makeBound();
    await bound.accept!();
    await bound.resolveAsRejected!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "rejected",
    });
    expect(stored["tc-1"]).toBeNull();
  });

  it("second terminal resolver after one has fired is a no-op (resolved latch)", async () => {
    const { bound, outputs, stored } = makeBound();
    await bound.accept!();
    await bound.resolveAsAccepted!({
      datasetEvaluatorId: "de-1",
      createdEvaluator: { id: "ev-1", name: "from agent" },
    });
    // The dialog's onOpenChange(false) commonly fires after Save success;
    // its resolveAsRejected MUST be ignored or the proposal would emit a
    // second terminal output and drift the agent's view of the tool call.
    await bound.resolveAsRejected!();
    expect(outputs).toHaveLength(1);
    expect(outputs[0]).toMatchObject({ state: "output-available" });
    expect(JSON.parse(String(outputs[0].output))).toMatchObject({
      status: "accepted",
    });
    expect(stored["tc-1"]).toBeNull();
  });

  it("accept after a terminal is a no-op (resolved latch covers phase flips too)", async () => {
    const { bound, outputs, stored } = makeBound();
    await bound.reject!();
    expect(outputs).toHaveLength(1);
    // After reject, accept must not re-mutate phase or re-emit output.
    await bound.accept!();
    expect(outputs).toHaveLength(1);
    expect(stored["tc-1"]).toBeNull();
  });
});
