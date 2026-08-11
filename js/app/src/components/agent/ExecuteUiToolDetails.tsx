import { useMemo } from "react";

import type { PendingCodeEvaluatorEdit } from "@phoenix/agent/tools/codeEvaluatorDraft";
import type { PendingLlmEvaluatorEdit } from "@phoenix/agent/tools/llmEvaluatorDraft";
import type { PendingLoadDataset } from "@phoenix/agent/tools/playgroundLoadDataset";
import type {
  PendingPromptEdit,
  PendingPromptInstanceRemoval,
} from "@phoenix/agent/tools/playgroundPrompt";
import { promptSnapshotToText } from "@phoenix/agent/tools/playgroundPrompt";
import type { PendingPromptToolWrite } from "@phoenix/agent/tools/playgroundPromptTools";
import type { PendingSavePrompt } from "@phoenix/agent/tools/playgroundSavePrompt";
import { Flex } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { ToolPartApprovalActions } from "./ToolPartPrimitives";
import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

/**
 * One pending approval staged by an inner `ui.*` call of a running script,
 * normalized for generic rendering: what to call it, what to show, and the
 * accept/reject callbacks that resolve the script's awaited promise.
 */
type ScriptChildApproval = {
  key: string;
  title: string;
  summary: string;
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

/** Preview: the script's first non-empty line, truncated by the card layout. */
export function getExecuteUiToolPreview(part: ToolInvocationPart): string {
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
          title: `Allow prompt edit for ${pending.before.label} (instance ${pending.instanceId})?`,
          summary: promptSnapshotToText(pending.after),
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingPromptInstanceRemoval>({
        record: instanceRemovals,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          title: "Allow removing prompt instance?",
          summary: `Prompt instance ${pending.label} will be removed.`,
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingPromptToolWrite>({
        record: promptToolWrites,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          title: `Allow prompt tool changes (instance ${pending.instanceId})?`,
          summary: stringifyToolValue(pending.input),
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingSavePrompt>({
        record: savePrompts,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          title: "Allow saving the prompt?",
          summary: stringifyToolValue(pending.preview),
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingCodeEvaluatorEdit>({
        record: codeEvaluatorEdits,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          title: "Allow code evaluator draft edit?",
          summary: stringifyToolValue(pending.operations),
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingLlmEvaluatorEdit>({
        record: llmEvaluatorEdits,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          title: "Allow LLM evaluator draft edit?",
          summary: stringifyToolValue(pending.operations),
          accept: pending.accept,
          reject: pending.reject,
        }),
      }),
      ...collectChildApprovals<PendingLoadDataset>({
        record: loadDatasets,
        childKeyPrefix,
        toApproval: (pending, key) => ({
          key,
          title: "Allow loading a dataset into the playground?",
          summary: stringifyToolValue(pending.input),
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
 * Details card for one `execute_ui` tool call: the script being run, generic
 * Accept/Reject cards for any approvals its inner operations staged (each
 * decision resolves the promise the script is awaiting), and the final
 * result or error.
 *
 * The generic approval summaries here are a first pass — the bespoke diff
 * renderings the dedicated approval tools had (side-by-side prompt diffs,
 * evaluator draft diffs) can be layered back per operation kind.
 */
export function ExecuteUiToolDetails({ part }: { part: ToolInvocationPart }) {
  const script = parseExecuteUiScript(part.input);
  const childApprovals = useScriptChildApprovals(part.toolCallId);

  return (
    <div className="tool-part__body">
      {script ? (
        <>
          <ToolPartLabel>Script</ToolPartLabel>
          <ToolPartCodeBlock>{script}</ToolPartCodeBlock>
        </>
      ) : null}
      {childApprovals.map((approval) => (
        <Flex
          key={approval.key}
          direction="column"
          gap="size-100"
          minHeight="0"
        >
          <ToolPartLabel>{approval.title}</ToolPartLabel>
          <ToolPartCodeBlock>{approval.summary}</ToolPartCodeBlock>
          <ToolPartApprovalActions
            onAccept={() => void approval.accept?.()}
            onReject={() => void approval.reject?.()}
            isDisabled={!approval.accept || !approval.reject}
            staleMessage="This change was proposed by a script in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
          />
        </Flex>
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
