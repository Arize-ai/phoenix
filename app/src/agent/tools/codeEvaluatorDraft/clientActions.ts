import { selectActiveContexts } from "@phoenix/agent/context/selectors";
import { parseCreateCodeEvaluatorInput } from "@phoenix/agent/tools/createCodeEvaluator";
import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";

import { buildDraftRevision } from "./draftOperations";
import {
  parseEditCodeEvaluatorDraftActionContext,
  parseEditCodeEvaluatorDraftInput,
  parseReadCodeEvaluatorDraftInput,
} from "./parsers";
import {
  bindPendingCodeEvaluatorCreateHandoffActions,
  bindPendingCodeEvaluatorCreateInlineActions,
} from "./pendingCodeEvaluatorCreate";
import { bindPendingCodeEvaluatorEditActions } from "./pendingCodeEvaluatorEdit";
import type {
  CodeEvaluatorDraftHost,
  CodeEvaluatorDraftSnapshot,
  PendingCodeEvaluatorCreate,
  PendingCodeEvaluatorCreateDatasetSnapshot,
  PendingCodeEvaluatorEdit,
} from "./types";

/**
 * Returns the current draft snapshot as a JSON string for `read_code_evaluator_draft`.
 */
export function createReadCodeEvaluatorDraftClientAction({
  getDraftHost,
}: {
  getDraftHost: () => CodeEvaluatorDraftHost | null;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadCodeEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid read_code_evaluator_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error: "The code-evaluator form is not mounted; cannot read the draft.",
      };
    }
    return { ok: true, output: JSON.stringify(host.getSnapshot(), null, 2) };
  };
}

/**
 * Validates the proposed edit against the current revision, previews the
 * resulting snapshot, and registers a pending edit for accept/reject.
 */
export function createEditCodeEvaluatorDraftClientAction({
  getDraftHost,
  setPendingCodeEvaluatorEdit,
}: {
  getDraftHost: () => CodeEvaluatorDraftHost | null;
  setPendingCodeEvaluatorEdit: (
    toolCallId: string,
    edit: PendingCodeEvaluatorEdit | null
  ) => void;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const editContext = parseEditCodeEvaluatorDraftActionContext(context);
    if (!editContext) {
      return {
        ok: false,
        error:
          "Cannot propose code-evaluator draft edit without tool call context.",
      };
    }
    const parsed = parseEditCodeEvaluatorDraftInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid edit_code_evaluator_draft input.",
      };
    }
    const host = getDraftHost();
    if (!host) {
      return {
        ok: false,
        error: "The code-evaluator form is not mounted; cannot edit the draft.",
      };
    }
    const before = host.getSnapshot();
    if (before.revision !== parsed.expectedRevision) {
      return {
        ok: false,
        error:
          "The code-evaluator draft has changed since it was last viewed by PXI.",
      };
    }
    const proposed = host.previewOperations(before, parsed.operations);
    if (!proposed.ok) return proposed;

    const pendingEdit = bindPendingCodeEvaluatorEditActions({
      pendingEdit: {
        toolCallId: editContext.toolCallId,
        sessionId: editContext.sessionId,
        expectedRevision: parsed.expectedRevision,
        before,
        after: proposed.output,
        operations: parsed.operations,
      },
      draftHost: host,
      addToolOutput: editContext.addToolOutput,
      setPendingCodeEvaluatorEdit,
    });
    setPendingCodeEvaluatorEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}

function buildEmptyBeforeSnapshot(
  proposed: CodeEvaluatorDraftSnapshot
): CodeEvaluatorDraftSnapshot {
  const before: Omit<CodeEvaluatorDraftSnapshot, "revision"> = {
    mode: "create",
    evaluatorNodeId: null,
    name: "",
    description: "",
    language: proposed.language,
    sourceCode: "",
    sandboxConfigId: null,
    inputMapping: { pathMapping: {}, literalMapping: {} },
    outputConfigs: [],
  };
  return { ...before, revision: buildDraftRevision(before) };
}

function readActiveDatasetContext(
  store: AgentStore
): PendingCodeEvaluatorCreateDatasetSnapshot | null {
  const active = selectActiveContexts(store.getState());
  const dataset = active.find((ctx) => ctx.type === "dataset");
  if (!dataset || dataset.type !== "dataset") return null;
  return {
    datasetNodeId: dataset.datasetNodeId,
    datasetVersionNodeId: dataset.datasetVersionNodeId ?? null,
  };
}

/**
 * Build a `PendingCodeEvaluatorCreate` from the proposed input.
 *
 * On dataset surfaces, the action writes a `kind: "handoff"` entry, navigates
 * to the dataset evaluators page (carrying the tool-call id in the URL), and
 * resolves `ok: true`. The slideover hosted on that page hydrates from the
 * snapshot, owns dispatch, and resolves the pending entry via its three
 * terminal resolvers (accepted/rejected/failed).
 *
 * On non-dataset surfaces, the action writes a `kind: "inline"` entry and the
 * chat-side diff card owns accept/reject; the standalone create mutation
 * dispatches from the bound accept handler.
 */
export function createCreateCodeEvaluatorClientAction({
  store,
  setPendingCodeEvaluatorCreate,
  navigate,
}: {
  store: AgentStore;
  setPendingCodeEvaluatorCreate: (
    toolCallId: string,
    pending: PendingCodeEvaluatorCreate | null
  ) => void;
  navigate?: (to: string) => void;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const createContext = parseEditCodeEvaluatorDraftActionContext(context);
    if (!createContext) {
      return {
        ok: false,
        error:
          "Cannot propose code-evaluator create without tool call context.",
      };
    }
    const parsed = parseCreateCodeEvaluatorInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid create_code_evaluator input.",
      };
    }
    const proposedWithoutRevision: Omit<
      CodeEvaluatorDraftSnapshot,
      "revision"
    > = {
      mode: "create",
      evaluatorNodeId: null,
      name: parsed.name,
      description: parsed.description ?? "",
      language: parsed.language,
      sourceCode: parsed.sourceCode,
      sandboxConfigId: parsed.sandboxConfigId,
      inputMapping: parsed.inputMapping,
      outputConfigs: parsed.outputConfigs,
    };
    const proposed: CodeEvaluatorDraftSnapshot = {
      ...proposedWithoutRevision,
      revision: buildDraftRevision(proposedWithoutRevision),
    };
    const before = buildEmptyBeforeSnapshot(proposed);
    const datasetContext = readActiveDatasetContext(store);

    if (datasetContext !== null) {
      const pendingCreate = bindPendingCodeEvaluatorCreateHandoffActions({
        pendingCreate: {
          kind: "handoff",
          toolCallId: createContext.toolCallId,
          sessionId: createContext.sessionId,
          before,
          after: proposed,
          datasetContext,
          resolved: false,
        },
        addToolOutput: createContext.addToolOutput,
        setPendingCodeEvaluatorCreate,
      });
      setPendingCodeEvaluatorCreate(createContext.toolCallId, pendingCreate);
      if (navigate) {
        const target = `/datasets/${encodeURIComponent(
          datasetContext.datasetNodeId
        )}/evaluators?fromAgentProposal=${encodeURIComponent(
          createContext.toolCallId
        )}`;
        navigate(target);
      }
      return { ok: true };
    }

    const pendingCreate = bindPendingCodeEvaluatorCreateInlineActions({
      pendingCreate: {
        kind: "inline",
        toolCallId: createContext.toolCallId,
        sessionId: createContext.sessionId,
        before,
        after: proposed,
      },
      addToolOutput: createContext.addToolOutput,
      setPendingCodeEvaluatorCreate,
    });
    setPendingCodeEvaluatorCreate(createContext.toolCallId, pendingCreate);
    return { ok: true };
  };
}
