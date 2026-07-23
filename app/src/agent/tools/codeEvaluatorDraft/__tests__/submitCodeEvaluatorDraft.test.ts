import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  commitMutation: vi.fn(),
}));

vi.mock("react-relay", () => ({
  commitMutation: relayMocks.commitMutation,
}));

vi.mock("@phoenix/RelayEnvironment", () => ({ default: {} }));

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { handleRegisteredAgentToolCall } from "@phoenix/agent/extensions/toolRegistry";
import {
  createEvaluatorHostSubmit,
  type EvaluatorSubmitToolOutput,
} from "@phoenix/agent/tools/approval";
import {
  type CodeEvaluatorDraftHost,
  createSubmitCodeEvaluatorDraftClientAction,
  type EvaluatorSubmitResult,
  SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import createCodeEvaluatorMutation from "@phoenix/components/dataset/__generated__/CreateCodeDatasetEvaluatorSlideover_createCodeEvaluatorMutation.graphql";
import RelayEnvironment from "@phoenix/RelayEnvironment";
import { createAgentStore } from "@phoenix/store/agentStore";

installTestStorage();

const EVALUATOR_INPUT = {
  name: "hallucination",
  description: "Scores hallucination",
  sourceCode: "def evaluate(output):\n    return 1.0",
  language: "PYTHON" as const,
  sandboxConfigId: "py-sandbox",
};

type CommitConfig = {
  mutation: unknown;
  variables: { input: typeof EVALUATOR_INPUT };
  onCompleted: (response: {
    createCodeEvaluator: { evaluator: { id: string; name: string } };
  }) => void;
  onError: (error: Error) => void;
};

const commit = (environment: unknown, config: CommitConfig): void => {
  relayMocks.commitMutation(environment, config);
};

function makeHost({
  validationError,
}: { validationError?: string } = {}): CodeEvaluatorDraftHost {
  const handleSubmit = async (): Promise<EvaluatorSubmitResult> => {
    if (validationError) {
      return { ok: false, error: validationError };
    }
    return new Promise<EvaluatorSubmitResult>((resolve) => {
      commit(RelayEnvironment, {
        mutation: createCodeEvaluatorMutation,
        variables: { input: EVALUATOR_INPUT },
        onCompleted: (response) => {
          const evaluator = response.createCodeEvaluator.evaluator;
          resolve({ ok: true, acceptedBy: "user", evaluator });
        },
        onError: (error) => resolve({ ok: false, error: error.message }),
      });
    });
  };
  return {
    getSnapshot: () => {
      throw new Error("not used by submit");
    },
    applyOperations: () => {
      throw new Error("not used by submit");
    },
    previewOperations: () => {
      throw new Error("not used by submit");
    },
    submit: createEvaluatorHostSubmit({
      getHandleSubmit: () => handleSubmit,
      unmountedError:
        "The code-evaluator form is not mounted; cannot submit the draft.",
    }),
  };
}

function registerSubmitTool(host: CodeEvaluatorDraftHost | null) {
  const store = createAgentStore();
  store.getState().registerClientAction(
    SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    createSubmitCodeEvaluatorDraftClientAction({
      getDraftHost: () => host,
      shouldAutoAccept: () => store.getState().permissions.edits === "bypass",
    })
  );
  return store;
}

async function dispatchSubmit(store: ReturnType<typeof createAgentStore>) {
  const addToolOutput = vi.fn().mockResolvedValue(undefined);
  await handleRegisteredAgentToolCall({
    toolCall: {
      toolCallId: "tc-submit",
      toolName: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
      input: {},
    },
    sessionId: "session-1",
    addToolOutput,
    agentStore: store,
  });
  return addToolOutput;
}

describe("submit_code_evaluator_draft agent tool", () => {
  beforeEach(() => {
    relayMocks.commitMutation.mockReset();
  });

  it("persists through the dialog create mutation and reports acceptedBy 'auto' under bypass with no manual gate", async () => {
    relayMocks.commitMutation.mockImplementation(
      (_environment: unknown, config: CommitConfig) => {
        config.onCompleted({
          createCodeEvaluator: {
            evaluator: { id: "ev-1", name: "hallucination" },
          },
        });
      }
    );
    const store = registerSubmitTool(makeHost());
    store.getState().setPermissions({ edits: "bypass" });

    const addToolOutput = await dispatchSubmit(store);

    expect(relayMocks.commitMutation).toHaveBeenCalledTimes(1);
    expect(relayMocks.commitMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        variables: { input: EVALUATOR_INPUT },
      })
    );

    expect(addToolOutput).toHaveBeenCalledTimes(1);
    const payload = addToolOutput.mock.calls[0][0];
    expect(payload).toMatchObject({
      state: "output-available",
      tool: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
      toolCallId: "tc-submit",
    });
    const output: EvaluatorSubmitToolOutput = JSON.parse(payload.output);
    expect(output).toEqual({
      status: "saved",
      persisted: true,
      acceptedBy: "auto",
      evaluator: { id: "ev-1", name: "hallucination" },
    });
  });

  it("does not persist under manual approval and reports requiresUserAction", async () => {
    const store = registerSubmitTool(makeHost());

    const addToolOutput = await dispatchSubmit(store);

    expect(relayMocks.commitMutation).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledTimes(1);
    const payload = addToolOutput.mock.calls[0][0];
    expect(payload).toMatchObject({
      state: "output-available",
      tool: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
    });
    const output: EvaluatorSubmitToolOutput = JSON.parse(payload.output);
    expect(output).toMatchObject({
      status: "awaiting_user",
      persisted: false,
      requiresUserAction: true,
    });
  });

  it("surfaces a validation failure as output-error, never a false accept", async () => {
    const store = registerSubmitTool(
      makeHost({ validationError: "Please select a sandbox configuration." })
    );
    store.getState().setPermissions({ edits: "bypass" });

    const addToolOutput = await dispatchSubmit(store);

    expect(relayMocks.commitMutation).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        errorText: "Please select a sandbox configuration.",
      })
    );
  });

  it("surfaces a server/mutation error as output-error, never a false accept", async () => {
    relayMocks.commitMutation.mockImplementation(
      (_environment: unknown, config: CommitConfig) => {
        config.onError(new Error("permission denied"));
      }
    );
    const store = registerSubmitTool(makeHost());
    store.getState().setPermissions({ edits: "bypass" });

    const addToolOutput = await dispatchSubmit(store);

    expect(relayMocks.commitMutation).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledTimes(1);
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        errorText: "permission denied",
      })
    );
  });

  it("surfaces the unmounted-form error when no host is registered", async () => {
    const store = registerSubmitTool(null);
    store.getState().setPermissions({ edits: "bypass" });

    const addToolOutput = await dispatchSubmit(store);

    expect(relayMocks.commitMutation).not.toHaveBeenCalled();
    expect(addToolOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "output-error",
        tool: SUBMIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
        errorText:
          "The code-evaluator form is not mounted; cannot submit the draft.",
      })
    );
  });
});
