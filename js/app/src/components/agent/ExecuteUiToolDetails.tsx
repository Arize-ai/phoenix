import { useMemo } from "react";

import {
  codeEvaluatorDraftFileName,
  codeEvaluatorDraftSnapshotToText,
  type PendingCodeEvaluatorEdit,
} from "@phoenix/agent/tools/codeEvaluatorDraft";
import {
  llmEvaluatorDraftFileName,
  llmEvaluatorDraftSnapshotToText,
  type PendingLlmEvaluatorEdit,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { PendingLoadDataset } from "@phoenix/agent/tools/playgroundLoadDataset";
import type {
  PendingPromptEdit,
  PendingPromptInstanceRemoval,
} from "@phoenix/agent/tools/playgroundPrompt";
import { promptSnapshotToText } from "@phoenix/agent/tools/playgroundPrompt";
import {
  type PendingPromptToolWrite,
  promptToolsSnapshotToText,
} from "@phoenix/agent/tools/playgroundPromptTools";
import type { PendingSavePrompt } from "@phoenix/agent/tools/playgroundSavePrompt";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ApprovalCard, type ApprovalPreview } from "./ApprovalCard";
import { LazyToolPartFileView } from "./LazyToolPartPierreViews";
import {
  ToolPartCodeBlock,
  ToolPartExpandableSection,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

/**
 * One pending approval staged by an inner `ui.*` call of a running script,
 * normalized to the shared {@link ApprovalPreview} — a unified diff when the
 * operation stages a before/after change, a curated payload otherwise — plus
 * the accept/reject callbacks that resolve the script's awaited promise.
 */
type ScriptChildApproval = {
  key: string;
  preview: ApprovalPreview;
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
};

function parseExecuteUiScript(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { script?: unknown };
  return typeof candidate.script === "string" ? candidate.script : null;
}

function parseExecuteUiSummary(input: unknown): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const candidate = input as { summary?: unknown };
  return typeof candidate.summary === "string" &&
    candidate.summary.trim() !== ""
    ? candidate.summary.trim()
    : null;
}

/**
 * Preview: the agent-authored summary of what the script accomplishes.
 * `summary` streams before `script`, so it appears while the call is still
 * streaming in; falls back to the script's first non-empty line when the
 * summary is missing.
 */
export function getExecuteUiToolPreview(part: ToolInvocationPart): string {
  const summary = parseExecuteUiSummary(part.input);
  if (summary) {
    return summary;
  }
  const script = parseExecuteUiScript(part.input);
  if (!script) {
    return "";
  }
  const firstLine = script
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? "";
}

export function formatExecuteUiState(part: ToolInvocationPart): string {
  if (part.state === "input-available") {
    return "Running script";
  }
  return formatToolState(part.state);
}

function collectChildApprovals<TPending>({
  record,
  childKeyPrefix,
  toApproval,
}: {
  record: Partial<Record<string, TPending>>;
  childKeyPrefix: string;
  toApproval: (pending: TPending, key: string) => ScriptChildApproval;
}): ScriptChildApproval[] {
  return Object.entries(record)
    .filter(([key, pending]) => key.startsWith(childKeyPrefix) && pending)
    .map(([key, pending]) => toApproval(pending as TPending, key));
}

/**
 * Collects every pending approval staged by this `execute_ui` call's inner
 * operations. Entries are keyed `<toolCallId>:<sequence>` by dispatch, so a
 * prefix match finds exactly this script's children.
 */
function useScriptChildApprovals(toolCallId: string): ScriptChildApproval[] {
  const childKeyPrefix = `${toolCallId}:`;
  const promptEdits = useAgentContext(
    (state) => state.pendingPromptEditsByToolCallId
  );
  const instanceRemovals = useAgentContext(
    (state) => state.pendingPromptInstanceRemovalsByToolCallId
  );
  const promptToolWrites = useAgentContext(
    (state) => state.pendingPromptToolWritesByToolCallId
  );
  const savePrompts = useAgentContext(
    (state) => state.pendingSavePromptsByToolCallId
  );
  const codeEvaluatorEdits = useAgentContext(
    (state) => state.pendingCodeEvaluatorEditsByToolCallId
  );
  const llmEvaluatorEdits = useAgentContext(
    (state) => state.pendingLlmEvaluatorEditsByToolCallId
  );
  const loadDatasets = useAgentContext(
    (state) => state.pendingLoadDatasetsByToolCallId
  );

  return useMemo(
    () => [
      ...collectChildApprovals<PendingPromptEdit>({
        record: promptEdits,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title: `Edit prompt ${pending.before.label} (instance ${pending.instanceId})`,
            body: {
              kind: "diff",
              fileName: `playground-instance-${pending.instanceId}.txt`,
              before: promptSnapshotToText(pending.before),
              after: promptSnapshotToText(pending.after),
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingPromptInstanceRemoval>({
        record: instanceRemovals,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title: `Remove prompt instance ${pending.label}`,
            body: {
              kind: "text",
              text: `Prompt instance ${pending.label} will be removed from the playground.`,
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingPromptToolWrite>({
        record: promptToolWrites,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title: `Edit prompt tools (instance ${pending.instanceId})`,
            body: {
              kind: "diff",
              fileName: `playground-instance-${pending.instanceId}-tools.json`,
              before: promptToolsSnapshotToText(pending.before),
              after: promptToolsSnapshotToText(pending.after),
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingSavePrompt>({
        record: savePrompts,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title:
              pending.preview.mode === "create"
                ? "Save new prompt"
                : "Save prompt version",
            body: {
              kind: "json",
              payload: {
                prompt: pending.preview.promptName,
                label: pending.preview.label,
                ...(pending.preview.description != null
                  ? { description: pending.preview.description }
                  : {}),
                ...(pending.preview.tags?.length
                  ? { tags: pending.preview.tags }
                  : {}),
              },
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingCodeEvaluatorEdit>({
        record: codeEvaluatorEdits,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title: "Edit code evaluator draft",
            body: {
              kind: "diff",
              fileName: codeEvaluatorDraftFileName(pending.before),
              before: codeEvaluatorDraftSnapshotToText(pending.before),
              after: codeEvaluatorDraftSnapshotToText(pending.after),
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingLlmEvaluatorEdit>({
        record: llmEvaluatorEdits,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title: "Edit LLM evaluator draft",
            body: {
              kind: "diff",
              fileName: llmEvaluatorDraftFileName(pending.before),
              before: llmEvaluatorDraftSnapshotToText(pending.before),
              after: llmEvaluatorDraftSnapshotToText(pending.after),
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingLoadDataset>({
        record: loadDatasets,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          preview: {
            title: "Load dataset into playground",
            body: {
              kind: "json",
              payload: {
                dataset: pending.input.datasetName,
                ...(pending.input.splitName
                  ? { split: pending.input.splitName }
                  : {}),
              },
            },
          },
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
    ],
    [
      childKeyPrefix,
      promptEdits,
      instanceRemovals,
      promptToolWrites,
      savePrompts,
      codeEvaluatorEdits,
      llmEvaluatorEdits,
      loadDatasets,
    ]
  );
}

/**
 * Details card for one `execute_ui` tool call: the script being run
 * (syntax-highlighted once its input has finished streaming), Accept/Reject
 * cards for any approvals its inner operations staged (each decision resolves
 * the promise the script is awaiting), and the final result or error.
 * Approval operations that carry before/after state (prompt edits, prompt
 * tool writes, evaluator draft edits) render as unified diffs; the rest fall
 * back to a text summary.
 */
export function ExecuteUiToolDetails({ part }: { part: ToolInvocationPart }) {
  const script = parseExecuteUiScript(part.input);
  const childApprovals = useScriptChildApprovals(part.toolCallId);

  return (
    <div className="tool-part__body">
      {script ? (
        <>
          <ToolPartLabel>Script</ToolPartLabel>
          <ToolPartExpandableSection>
            {part.state === "input-streaming" ? (
              // The still-streaming script changes on every chunk; hold off
              // on the highlighter until the input settles.
              <ToolPartCodeBlock>{script}</ToolPartCodeBlock>
            ) : (
              <LazyToolPartFileView fileName="script.js" contents={script} />
            )}
          </ToolPartExpandableSection>
        </>
      ) : null}
      {childApprovals.map((approval) => (
        <ApprovalCard
          key={approval.key}
          preview={approval.preview}
          onAccept={() => void approval.accept?.()}
          onReject={() => void approval.reject?.()}
          isDisabled={!approval.accept || !approval.reject}
          staleMessage="This change was proposed by a script in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
        />
      ))}
      {part.state === "output-available" ? (
        <>
          <ToolPartLabel>Result</ToolPartLabel>
          <ToolPartCodeBlock>
            {stringifyToolValue(part.output)}
          </ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}
