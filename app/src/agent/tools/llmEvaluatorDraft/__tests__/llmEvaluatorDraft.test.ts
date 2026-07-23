import { describe, expect, it } from "vitest";

import { createEvaluatorHostSubmit } from "@phoenix/agent/tools/approval";
import { fromOutputConfigDraft } from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  applyDraftOperations,
  createEditLlmEvaluatorDraftClientAction,
  createReadLlmEvaluatorDraftClientAction,
  createTestLlmEvaluatorDraftClientAction,
  type EditLlmEvaluatorDraftOperation,
  type EvaluatorSubmitResult,
  type LLMEvaluatorDraftSnapshot,
  type LlmEvaluatorDraftHost,
  parseEditLlmEvaluatorDraftInput,
  type PendingLlmEvaluatorEdit,
  reconcileJudgeOperations,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import { buildJudgeToolFunctions } from "@phoenix/components/evaluators/utils";
import type { PlaygroundStore } from "@phoenix/store/playground";

function makeSnapshot(
  overrides: Partial<LLMEvaluatorDraftSnapshot> = {}
): LLMEvaluatorDraftSnapshot {
  return {
    mode: "create",
    evaluatorNodeId: null,
    name: "hallucination",
    description: "",
    inputMapping: { pathMapping: {}, literalMapping: {} },
    testPayload: {
      input: { question: "Which answer used a tool?" },
      output: {},
      reference: {},
      metadata: {},
    },
    includeExplanation: true,
    outputConfigs: [],
    judge: {
      model: "gpt-4o",
      provider: "OPENAI",
      templateFormat: "MUSTACHE",
      messages: [{ role: "system", content: "Evaluate the output." }],
      invocationParameters: {},
      tools: null,
      toolChoice: null,
    },
    ...overrides,
  };
}

function makeHost(initial: LLMEvaluatorDraftSnapshot): {
  host: LlmEvaluatorDraftHost;
  snapshotRef: { current: LLMEvaluatorDraftSnapshot };
} {
  const snapshotRef = { current: initial };
  const previewOperations = (
    snapshot: LLMEvaluatorDraftSnapshot,
    operations: EditLlmEvaluatorDraftOperation[]
  ) => applyDraftOperations({ snapshot, operations });
  const host: LlmEvaluatorDraftHost = {
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

describe("llm evaluator draft read tool", () => {
  it("reads the current draft snapshot including the judge block", async () => {
    const { host } = makeHost(makeSnapshot());
    const action = createReadLlmEvaluatorDraftClientAction({
      getDraftHost: () => host,
    });
    const result = await action({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const snapshot = JSON.parse(
      result.output ?? ""
    ) as LLMEvaluatorDraftSnapshot;
    expect(snapshot.mode).toBe("create");
    expect(snapshot.judge.model).toBe("gpt-4o");
    expect(snapshot.judge.messages).toHaveLength(1);
  });

  it("errors when the form is not mounted", async () => {
    const action = createReadLlmEvaluatorDraftClientAction({
      getDraftHost: () => null,
    });
    const result = await action({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not mounted/i);
  });
});

describe("llm evaluator draft test tool", () => {
  it("runs the preview and returns the judge result as a JSON string", async () => {
    const output = { results: [{ annotation: { score: 1 } }] };
    const action = createTestLlmEvaluatorDraftClientAction({
      isDraftMounted: () => true,
      createPreviewRunner: () => ({
        ok: true,
        output: async () => ({ ok: true, output }),
      }),
    });
    const result = await action({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.parse(result.output ?? "")).toEqual(output);
  });

  it("errors when the form is not mounted", async () => {
    const action = createTestLlmEvaluatorDraftClientAction({
      isDraftMounted: () => false,
      createPreviewRunner: () => ({
        ok: true,
        output: async () => ({ ok: true, output: {} }),
      }),
    });
    const result = await action({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not mounted/i);
  });

  it("propagates a judge/API failure as the result error, not a crash", async () => {
    const action = createTestLlmEvaluatorDraftClientAction({
      isDraftMounted: () => true,
      createPreviewRunner: () => ({
        ok: true,
        output: async () => ({ ok: false, error: "judge failed" }),
      }),
    });
    const result = await action({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("judge failed");
  });
});

describe("llm evaluator draft edit reducer", () => {
  it("applies field-level set operations", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ description: "old" }),
      operations: [
        { type: "set_name", name: "tool usage" },
        { type: "set_description", description: "Scores tool usage." },
        {
          type: "set_test_payload",
          testPayload: {
            input: { prompt: "new" },
            output: { answer: "new" },
            reference: { rubric: "match" },
            metadata: { split: "eval" },
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.name).toBe("tool usage");
    expect(result.output.description).toBe("Scores tool usage.");
    expect(result.output.testPayload.input).toEqual({ prompt: "new" });
  });

  it("applies set_judge_prompt to the snapshot judge block", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot(),
      operations: [
        {
          type: "set_judge_prompt",
          messages: [
            { role: "system", content: "You are a strict grader." },
            { role: "user", content: "Grade: {{output}}" },
          ],
          templateFormat: "F_STRING",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.judge.messages).toEqual([
      { role: "system", content: "You are a strict grader." },
      { role: "user", content: "Grade: {{output}}" },
    ]);
    expect(result.output.judge.templateFormat).toBe("F_STRING");
  });

  it("ignores an invalid templateFormat on set_judge_prompt", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot(),
      operations: [
        {
          type: "set_judge_prompt",
          messages: [{ role: "system", content: "Grade it." }],
          templateFormat: "NOT_A_FORMAT",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Falls back to the prior snapshot format rather than writing garbage.
    expect(result.output.judge.templateFormat).toBe("MUSTACHE");
  });

  it("applies set_judge_model to the snapshot judge block", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot(),
      operations: [
        {
          type: "set_judge_model",
          model: "claude-opus-4-6",
          provider: "ANTHROPIC",
          invocationParameters: { temperature: 0.2 },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.judge.model).toBe("claude-opus-4-6");
    expect(result.output.judge.provider).toBe("ANTHROPIC");
    expect(result.output.judge.invocationParameters).toEqual({
      temperature: 0.2,
    });
  });

  it("normalizes snake_case aliases in draft edit operations", () => {
    const parsed = parseEditLlmEvaluatorDraftInput({
      operations: [
        {
          type: "set_input_mapping",
          input_mapping: {
            path_mapping: { output: "attributes.output.value" },
            literal_mapping: { threshold: 0.5 },
          },
        },
        { type: "set_include_explanation", include_explanation: false },
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
      type: "set_include_explanation",
      includeExplanation: false,
    });
  });

  // includeExplanation is inferred from the judge tools, not stored on them, so
  // the tools regenerated from the draft must stay consistent when it toggles.
  it("keeps the regenerated judge tool consistent after toggling includeExplanation and outputConfigs", () => {
    const result = applyDraftOperations({
      snapshot: makeSnapshot({ includeExplanation: true, outputConfigs: [] }),
      operations: [
        { type: "set_include_explanation", includeExplanation: false },
        {
          type: "set_output_configs",
          outputConfigs: [
            {
              kind: "classification",
              name: "tool_used",
              optimizationDirection: "MAXIMIZE",
              values: [
                { label: "yes", score: 1 },
                { label: "no", score: 0 },
              ],
            },
          ],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.output;

    const toolFunctions = buildJudgeToolFunctions({
      outputConfigs: next.outputConfigs.map(fromOutputConfigDraft),
      includeExplanation: next.includeExplanation,
    });
    expect(toolFunctions).toHaveLength(1);
    const parameters = toolFunctions[0].function.parameters;
    // includeExplanation=false → no explanation property and not required.
    expect(parameters.required).toEqual(["label"]);
    expect(parameters.properties).not.toHaveProperty("explanation");
    expect((parameters.properties.label as { enum: string[] }).enum).toEqual([
      "yes",
      "no",
    ]);
  });
});

describe("llm evaluator draft edit lifecycle", () => {
  it("registers a pending edit when the propose-time gate passes", async () => {
    const { host } = makeHost(makeSnapshot());
    let pending: PendingLlmEvaluatorEdit | null = null;
    const action = createEditLlmEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingLlmEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    const result = await action(
      { operations: [{ type: "set_description", description: "from model" }] },
      { toolCallId: "tc", sessionId: "s", addToolOutput: async () => undefined }
    );
    expect(result.ok).toBe(true);
    expect(pending).not.toBeNull();
    expect(pending!.after.description).toBe("from model");
  });

  it("applies the pending edit on accept", async () => {
    const { host, snapshotRef } = makeHost(makeSnapshot());
    let pending: PendingLlmEvaluatorEdit | null = null;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditLlmEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingLlmEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    await action(
      { operations: [{ type: "set_description", description: "accepted" }] },
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
    const { host, snapshotRef } = makeHost(
      makeSnapshot({ description: "original" })
    );
    let pending: PendingLlmEvaluatorEdit | null = null;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditLlmEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingLlmEvaluatorEdit: (_, edit) => {
        pending = edit;
      },
    });
    await action(
      { operations: [{ type: "set_description", description: "from model" }] },
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
    const { host, snapshotRef } = makeHost(
      makeSnapshot({ description: "original" })
    );
    let surfacedPending = false;
    const outputs: Array<Record<string, unknown>> = [];
    const action = createEditLlmEvaluatorDraftClientAction({
      getDraftHost: () => host,
      setPendingLlmEvaluatorEdit: (_, edit) => {
        if (edit) surfacedPending = true;
      },
      shouldAutoAccept: () => true,
    });
    const result = await action(
      { operations: [{ type: "set_description", description: "auto" }] },
      {
        toolCallId: "tc",
        sessionId: "s",
        addToolOutput: async (payload: Record<string, unknown>) => {
          outputs.push(payload);
        },
      }
    );
    expect(result.ok).toBe(true);
    expect(surfacedPending).toBe(false);
    expect(snapshotRef.current.description).toBe("auto");
    expect(outputs[0]).toMatchObject({
      state: "output-available",
      output: expect.objectContaining({
        status: "accepted",
        acceptedBy: "auto",
      }),
    });
  });
});

// Records the playground-store setter calls the judge reconciliation makes,
// without standing up the full store. setState is invoked with the state
// reducer so the message-write path is exercised end to end.
type RecordedCalls = {
  updateProvider: Array<{ provider: string }>;
  updateModel: Array<{ patch: { modelName?: string } }>;
  updateInstanceModelInvocationParameters: Array<{
    invocationParameters: unknown;
  }>;
  setTemplateFormat: string[];
  setStateCalls: number;
};

function makeFakePlaygroundStore(): {
  store: PlaygroundStore;
  calls: RecordedCalls;
  getMessages: () => Array<{ id: number; role: string; content?: string }>;
} {
  const calls: RecordedCalls = {
    updateProvider: [],
    updateModel: [],
    updateInstanceModelInvocationParameters: [],
    setTemplateFormat: [],
    setStateCalls: 0,
  };
  // Minimal slice of playground state the reconciliation reads/writes.
  let state = {
    instances: [
      {
        id: 1,
        model: { provider: "OPENAI", modelName: "gpt-4o" },
        template: { __type: "chat" as const, messageIds: [10] },
      },
    ],
    allInstanceMessages: {
      10: { id: 10, role: "system" as const, content: "old" },
    } as Record<number, { id: number; role: string; content?: string }>,
    externallyUpdatedMessageRevisionById: {} as Record<number, number>,
    dirtyInstances: {} as Record<number, boolean>,
    updateProvider: ({ provider }: { provider: string }) => {
      calls.updateProvider.push({ provider });
    },
    updateModel: ({ patch }: { patch: { modelName?: string } }) => {
      calls.updateModel.push({ patch });
    },
    updateInstanceModelInvocationParameters: ({
      invocationParameters,
    }: {
      invocationParameters: unknown;
    }) => {
      calls.updateInstanceModelInvocationParameters.push({
        invocationParameters,
      });
    },
    setTemplateFormat: (templateFormat: string) => {
      calls.setTemplateFormat.push(templateFormat);
    },
  };
  const store = {
    getState: () => state,
    setState: (updater: unknown) => {
      calls.setStateCalls += 1;
      if (typeof updater === "function") {
        state = {
          ...state,
          ...(updater as (s: typeof state) => typeof state)(state),
        };
      }
    },
  } as unknown as PlaygroundStore;
  return {
    store,
    calls,
    getMessages: () =>
      state.instances[0].template.messageIds.map(
        (id) => state.allInstanceMessages[id]
      ),
  };
}

describe("llm evaluator draft judge reconciliation", () => {
  it("set_judge_prompt writes coerced roles + new messages + templateFormat", () => {
    const { store, calls, getMessages } = makeFakePlaygroundStore();
    reconcileJudgeOperations({
      playgroundStore: store,
      instanceId: 1,
      modelConfigByProvider: {},
      operations: [
        {
          type: "set_judge_prompt",
          messages: [
            { role: "system", content: "Grade strictly." },
            // "assistant" is mapped to the playground's "ai" role.
            { role: "assistant", content: "ok" },
            // unknown role falls back to "user".
            { role: "weird", content: "hmm" },
          ],
          templateFormat: "F_STRING",
        },
      ],
    });
    expect(calls.setTemplateFormat).toEqual(["F_STRING"]);
    const messages = getMessages();
    expect(messages.map((m) => m.role)).toEqual(["system", "ai", "user"]);
    expect(messages.map((m) => m.content)).toEqual([
      "Grade strictly.",
      "ok",
      "hmm",
    ]);
    // Old message id 10 was replaced, not retained.
    expect(messages.some((m) => m.id === 10)).toBe(false);
  });

  it("set_judge_model switches provider, sets model, and parses invocation params", () => {
    const { store, calls } = makeFakePlaygroundStore();
    reconcileJudgeOperations({
      playgroundStore: store,
      instanceId: 1,
      modelConfigByProvider: {},
      operations: [
        {
          type: "set_judge_model",
          model: "claude-opus-4-6",
          provider: "ANTHROPIC",
          invocationParameters: { temperature: 0.2 },
        },
      ],
    });
    expect(calls.updateProvider).toEqual([{ provider: "ANTHROPIC" }]);
    expect(calls.updateModel).toEqual([
      { patch: { modelName: "claude-opus-4-6" } },
    ]);
    expect(calls.updateInstanceModelInvocationParameters).toHaveLength(1);
  });

  it("set_judge_model with an invalid provider is a no-op", () => {
    const { store, calls } = makeFakePlaygroundStore();
    reconcileJudgeOperations({
      playgroundStore: store,
      instanceId: 1,
      modelConfigByProvider: {},
      operations: [
        {
          type: "set_judge_model",
          model: "whatever",
          provider: "NOT_A_PROVIDER",
        },
      ],
    });
    expect(calls.updateProvider).toEqual([]);
    expect(calls.updateModel).toEqual([]);
  });
});

describe("llm evaluator host submit capability", () => {
  it("drives the dialog's handleSubmit and stamps the manual approval source", async () => {
    let handleSubmitCalls = 0;
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => {
      handleSubmitCalls += 1;
      return {
        ok: true,
        acceptedBy: "user",
        evaluator: { id: "llm-7", name: "hallucination" },
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
      evaluator: { id: "llm-7", name: "hallucination" },
    });
  });

  it("persists and stamps acceptedBy 'auto' under the bypass approval source", async () => {
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => ({
      ok: true,
      acceptedBy: "user",
      evaluator: { id: "llm-7", name: "hallucination" },
    });
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result).toEqual({
      ok: true,
      acceptedBy: "auto",
      evaluator: { id: "llm-7", name: "hallucination" },
    });
  });

  it("surfaces a validation failure as a failed result (no false accept)", async () => {
    const handleSubmit = async (): Promise<EvaluatorSubmitResult> => ({
      ok: false,
      error: "Please fix the highlighted errors before submitting.",
    });
    const submit = createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError: "unmounted",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/fix the highlighted errors/i);
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
      unmountedError: "The LLM-evaluator form is not mounted; cannot submit.",
    });
    const result = await submit({ approvalSource: "auto" });
    expect(result).toEqual({
      ok: false,
      error: "The LLM-evaluator form is not mounted; cannot submit.",
    });
  });
});
