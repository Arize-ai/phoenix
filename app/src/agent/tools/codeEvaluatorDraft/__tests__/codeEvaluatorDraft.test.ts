import {
  applyDraftOperations,
  buildDraftRevision,
  type CodeEvaluatorDraftHost,
  type CodeEvaluatorDraftSnapshot,
  createEditCodeEvaluatorDraftClientAction,
  createReadCodeEvaluatorDraftClientAction,
  type EditCodeEvaluatorDraftOperation,
  type PendingCodeEvaluatorEdit,
  parseEditCodeEvaluatorDraftInput,
  parseTestCodeEvaluatorDraftInput,
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
    testPayload: {
      input: { question: "Which answer used a tool?" },
      output: { messages: [{ role: "assistant", content: "Used search" }] },
      reference: { expectedTool: "search" },
      metadata: { split: "validation" },
    },
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

  it("preserves an existing sandbox when create-mode edits do not touch sandbox or language", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({
        language: "PYTHON",
        sandboxConfigId: "py-sandbox",
      }),
      operations: [
        {
          type: "set_source_code",
          sourceCode: 'def evaluate(output):\n    return {"score": 1.0}',
        },
      ],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.sandboxConfigId).toBe("py-sandbox");
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
          type: "set_test_payload",
          test_payload: {
            input: { question: "Was a tool used?" },
            output: { answer: "yes" },
            reference: { expected: true },
            metadata: { source: "fixture" },
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
      type: "set_test_payload",
      testPayload: {
        input: { question: "Was a tool used?" },
        output: { answer: "yes" },
        reference: { expected: true },
        metadata: { source: "fixture" },
      },
    });
    expect(parsed!.operations[2]).toEqual({
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

  it("applies set_test_payload and includes it in the revision hash", () => {
    const initial = makeSnapshot({
      testPayload: {
        input: { prompt: "old" },
        output: { answer: "old" },
        reference: {},
        metadata: {},
      },
    });
    const result = applyDraftOperations({
      snapshot: initial,
      operations: [
        {
          type: "set_test_payload",
          testPayload: {
            input: { prompt: "new" },
            output: { answer: "new" },
            reference: { rubric: "match answer" },
            metadata: { split: "eval" },
          },
        },
      ],
      sandboxConfigs: {
        "py-sandbox": { language: "PYTHON" },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.testPayload).toEqual({
      input: { prompt: "new" },
      output: { answer: "new" },
      reference: { rubric: "match answer" },
      metadata: { split: "eval" },
    });
    expect(result.output.revision).not.toBe(initial.revision);
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

  it("accepts revision aliases for test_code_evaluator_draft", () => {
    expect(
      parseTestCodeEvaluatorDraftInput({
        revision: "code-evaluator-draft-abc",
      })
    ).toEqual({ expectedRevision: "code-evaluator-draft-abc" });
    expect(
      parseTestCodeEvaluatorDraftInput({
        expected_revision: "code-evaluator-draft-def",
      })
    ).toEqual({ expectedRevision: "code-evaluator-draft-def" });
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

  it("applies accepted test payload edits through the pending edit path", async () => {
    const initial = makeSnapshot({
      testPayload: {
        input: { prompt: "initial" },
        output: { answer: "initial" },
        reference: {},
        metadata: {},
      },
    });
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
        operations: [
          {
            type: "set_test_payload",
            testPayload: {
              input: { prompt: "updated" },
              output: { answer: "updated" },
              reference: { expected: "updated" },
              metadata: { split: "smoke" },
            },
          },
        ],
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
    expect(pending!.after.testPayload.output).toEqual({ answer: "updated" });

    await pending!.accept!();
    expect(snapshotRef.current.testPayload).toEqual({
      input: { prompt: "updated" },
      output: { answer: "updated" },
      reference: { expected: "updated" },
      metadata: { split: "smoke" },
    });
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
