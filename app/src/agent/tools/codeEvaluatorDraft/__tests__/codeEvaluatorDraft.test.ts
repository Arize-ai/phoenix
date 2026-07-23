import { createEvaluatorHostSubmit } from "@phoenix/agent/tools/approval";
import {
  applyDraftOperations,
  type CodeEvaluatorDraftHost,
  type CodeEvaluatorDraftSnapshot,
  createEditCodeEvaluatorDraftClientAction,
  createReadCodeEvaluatorDraftClientAction,
  type EditCodeEvaluatorDraftOperation,
  type EvaluatorSubmitResult,
  type PendingCodeEvaluatorEdit,
  parseEditCodeEvaluatorDraftInput,
  type SandboxConfigIndex,
} from "@phoenix/agent/tools/codeEvaluatorDraft";

function makeSnapshot(
  overrides: Partial<CodeEvaluatorDraftSnapshot> = {}
): CodeEvaluatorDraftSnapshot {
  return {
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
    submit: async ({ approvalSource }) => ({
      ok: true,
      acceptedBy: approvalSource,
      evaluator: { id: "ev-1", name: snapshotRef.current.name },
    }),
  };
  return { host, snapshotRef };
}

describe("code evaluator draft agent tools", () => {
  it("reads the current draft snapshot", async () => {
    const { host } = makeHost(makeSnapshot());
    const action = createReadCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await action({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot: CodeEvaluatorDraftSnapshot = JSON.parse(
      result.output ?? ""
    );
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

  it("applies set_test_payload", () => {
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
  });

  it("accepts a single top-level operation", () => {
    const parsed = parseEditCodeEvaluatorDraftInput({
      type: "set_description",
      description: "Scores whether the output includes a tool call.",
    });
    expect(parsed).toEqual({
      operations: [
        {
          type: "set_description",
          description: "Scores whether the output includes a tool call.",
        },
      ],
    });
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
  });

  it("applies the pending edit on accept", async () => {
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

  it("auto-applies the edit without surfacing a confirmation when shouldAutoAccept is true", async () => {
    const initial = makeSnapshot({ description: "original" });
    const { host, snapshotRef } = makeHost(initial);
    let surfacedPending = false;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        if (edit) surfacedPending = true;
      },
      shouldAutoAccept: () => true,
    });
    const result = await action(
      {
        operations: [{ type: "set_description", description: "auto" }],
      },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async (payload: Record<string, unknown>) => {
          outputs.push(payload);
        },
      }
    );
    expect(result.ok).toBe(true);
    // Auto-mode must never surface the accept/reject confirmation dialog.
    expect(surfacedPending).toBe(false);
    // The edit is applied immediately and stamped as auto-approved.
    expect(snapshotRef.current.description).toBe("auto");
    expect(outputs[0]).toMatchObject({
      state: "output-available",
      output: expect.objectContaining({
        status: "accepted",
        acceptedBy: "auto",
      }),
    });
  });

  it("does not persist on draft-edit accept (accept is form-operation-only)", async () => {
    const initial = makeSnapshot({ description: "original" });
    const { host, snapshotRef } = makeHost(initial);
    let submitCalled = false;
    host.submit = async ({ approvalSource }) => {
      submitCalled = true;
      return {
        ok: true,
        acceptedBy: approvalSource,
        evaluator: { id: "ev-1", name: snapshotRef.current.name },
      };
    };
    let pending: PendingCodeEvaluatorEdit | null = null;
    const action = createEditCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingCodeEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
      shouldAutoAccept: () => true,
    });
    await action(
      { operations: [{ type: "set_description", description: "edited" }] },
      { toolCallId: "tc", sessionId: "s", addToolOutput: async () => undefined }
    );
    void pending;
    expect(snapshotRef.current.description).toBe("edited");
    expect(submitCalled).toBe(false);
  });
});

describe("code evaluator host submit capability", () => {
  it("drives the dialog's handleSubmit and stamps the manual approval source", async () => {
    let handleSubmitCalls = 0;
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => {
      handleSubmitCalls += 1;
      return {
        ok: true,
        acceptedBy: "user",
        evaluator: { id: "ev-42", name: "hallucination" },
      };
    };
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "user" });
    expect(handleSubmitCalls).toBe(1);
    expect(result).toEqual({
      ok: true,
      acceptedBy: "user",
      evaluator: { id: "ev-42", name: "hallucination" },
    });
  });

  it("persists and stamps acceptedBy 'auto' under the bypass approval source", async () => {
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => ({
      ok: true,
      acceptedBy: "user",
      evaluator: { id: "ev-42", name: "hallucination" },
    });
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result).toEqual({
      ok: true,
      acceptedBy: "auto",
      evaluator: { id: "ev-42", name: "hallucination" },
    });
  });

  it("surfaces a validation failure as a failed result (no false accept)", async () => {
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => ({
      ok: false,
      error: "Please select a sandbox configuration.",
    });
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result).toEqual({
      ok: false,
      error: "Please select a sandbox configuration.",
    });
  });

  it("surfaces a missing/incompatible sandbox-config prerequisite as a failed result", async () => {
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => ({
      ok: false,
      error: "Source code is required.",
    });
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/required/i);
  });

  it("surfaces a server/mutation error as a failed result", async () => {
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => ({
      ok: false,
      error: "permission denied",
    });
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result).toEqual({ ok: false, error: "permission denied" });
  });

  it("fails with the actionable unmounted error when the form is gone", async () => {
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => null,
      unmountedError: "The code-evaluator form is not mounted; cannot submit.",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result).toEqual({
      ok: false,
      error: "The code-evaluator form is not mounted; cannot submit.",
    });
  });
});
