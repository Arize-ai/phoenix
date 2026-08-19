import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt";
import {
  type CanonicalToolChoice,
  type CanonicalToolDefinition,
  generateToolId,
  type PlaygroundStore,
  type Tool,
} from "@phoenix/store/playground";

import type {
  PromptToolsActionResult,
  PromptToolSnapshot,
  PromptToolsSnapshot,
  WritePromptToolEntry,
  WritePromptToolResult,
  WritePromptToolsInput,
  WritePromptToolsPlan,
  WritePromptToolsResult,
} from "./types";

/**
 * Returns a snapshot of one playground prompt instance's tool list plus a
 * content-hash revision token. If only one instance exists, it is selected
 * automatically; otherwise `instanceId` is required.
 */
export function getPromptToolsSnapshot({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId?: number;
}): PromptToolsActionResult<PromptToolsSnapshot> {
  const instance = resolveInstance({ playgroundStore, instanceId });
  if (!instance.ok) return instance;
  const { playgroundInstance, index } = instance.output;
  const tools = playgroundInstance.tools.map(toPromptToolSnapshot);
  const snapshotWithoutRevision = {
    instanceId: playgroundInstance.id,
    index,
    label: getInstanceLabel(index),
    tools,
  };
  return {
    ok: true,
    output: {
      ...snapshotWithoutRevision,
      revision: buildPromptToolsRevision(snapshotWithoutRevision),
    },
  };
}

/**
 * Validates a `write_prompt_tools` batch against the current instance snapshot
 * and computes the resulting tool list **without mutating the store**. Each
 * `tools` entry patches an existing function tool when its `id` is provided, or
 * creates a new one otherwise, and every id in `deleteToolIds` is removed.
 * Verifies the input's `expectedRevision` against the current snapshot; rejects
 * on mismatch.
 *
 * The batch is all-or-nothing: every entry and delete id is validated against
 * the snapshot before anything is computed, so a single bad entry (missing id,
 * a raw passthrough tool on the write path, an update/delete conflict, or a
 * delete that references a missing id) rejects the whole batch. Unlike writes,
 * deletes may target raw vendor tools — removing a tool needs no knowledge of
 * its shape.
 *
 * Separating planning from committing lets the approval flow validate the batch
 * and materialize a before/after diff at *propose* time, then re-plan and commit
 * the same input when the user accepts (re-checking the revision then too).
 */
export function planWritePromptTools({
  playgroundStore,
  input,
}: {
  playgroundStore: PlaygroundStore;
  input: WritePromptToolsInput;
}): PromptToolsActionResult<WritePromptToolsPlan> {
  const instance = resolveInstance({
    playgroundStore,
    instanceId: input.instanceId,
  });
  if (!instance.ok) return instance;
  const { playgroundInstance, index } = instance.output;

  const beforeSnapshot = getPromptToolsSnapshot({
    playgroundStore,
    instanceId: playgroundInstance.id,
  });
  if (!beforeSnapshot.ok) return beforeSnapshot;
  if (beforeSnapshot.output.revision !== input.expectedRevision) {
    return {
      ok: false,
      error:
        "The prompt tool list has changed since it was last viewed by PXI.",
    };
  }

  const writeEntries = input.tools ?? [];
  const deleteIds = new Set(input.deleteToolIds ?? []);

  // Validation pass — all-or-nothing. Update entries must reference an existing
  // function tool from the snapshot we just read; ids assigned to tools created
  // earlier in the same batch are not addressable here. Nothing is computed
  // until every entry and delete id is known to be applicable.
  for (let index = 0; index < writeEntries.length; index++) {
    const entry = writeEntries[index]!;
    const requestedId = "id" in entry ? entry.id : undefined;
    if (requestedId == null) continue;
    const existing = playgroundInstance.tools.find(
      (candidate) => candidate.id === requestedId
    );
    if (!existing) {
      return {
        ok: false,
        error: `tools[${index}]: prompt tool ${requestedId} was not found on instance ${playgroundInstance.id}.`,
      };
    }
    if (existing.kind !== "function") {
      return {
        ok: false,
        error: `tools[${index}]: prompt tool ${requestedId} is a vendor passthrough (raw) tool and cannot be edited via PXI. Edit it in the playground tool editor.`,
      };
    }
    if (deleteIds.has(requestedId)) {
      return {
        ok: false,
        error: `tools[${index}]: prompt tool ${requestedId} cannot be both updated and deleted in the same batch.`,
      };
    }
  }

  for (const deleteId of deleteIds) {
    const existing = playgroundInstance.tools.find(
      (candidate) => candidate.id === deleteId
    );
    if (!existing) {
      return {
        ok: false,
        error: `deleteToolIds: prompt tool ${deleteId} was not found on instance ${playgroundInstance.id}.`,
      };
    }
  }

  // Compute pass — drop deleted tools first, then fold each write entry over the
  // working copy so multiple entries (including repeated patches to the same
  // id) compose in order.
  let workingTools: Tool[] = playgroundInstance.tools.filter(
    (candidate) => !deleteIds.has(candidate.id)
  );
  const results: WritePromptToolResult[] = [];
  for (const entry of writeEntries) {
    const requestedId = "id" in entry ? entry.id : undefined;
    if (requestedId != null) {
      workingTools = workingTools.map((candidate) =>
        candidate.id === requestedId && candidate.kind === "function"
          ? { ...candidate, definition: patchDefinition(candidate, entry) }
          : candidate
      );
      results.push({ status: "updated", toolId: requestedId });
    } else {
      const newId = generateToolId();
      workingTools = [
        ...workingTools,
        {
          kind: "function",
          id: newId,
          editorType: "json",
          definition: patchDefinition(null, entry),
        },
      ];
      results.push({ status: "created", toolId: newId });
    }
  }

  const forcedChoice = playgroundInstance.toolChoice;
  const forcedFunctionName =
    forcedChoice?.type === "SPECIFIC_FUNCTION"
      ? forcedChoice.functionName
      : undefined;
  let toolChoicePatch: CanonicalToolChoice | undefined;
  let resetToolChoiceFrom: string | undefined;
  let renamedToolChoiceTo: string | undefined;
  if (forcedFunctionName != null) {
    const forcedTool = playgroundInstance.tools.find(
      (candidate) =>
        candidate.kind === "function" &&
        candidate.definition.name === forcedFunctionName
    );
    if (forcedTool) {
      const survivor = workingTools.find(
        (candidate) => candidate.id === forcedTool.id
      );
      if (!survivor) {
        resetToolChoiceFrom = forcedFunctionName;
        toolChoicePatch = { type: "ZERO_OR_MORE" };
      } else if (
        survivor.kind === "function" &&
        survivor.definition.name !== forcedFunctionName
      ) {
        renamedToolChoiceTo = survivor.definition.name;
        toolChoicePatch = {
          type: "SPECIFIC_FUNCTION",
          functionName: survivor.definition.name,
        };
      }
    }
  }

  return {
    ok: true,
    output: {
      instanceId: playgroundInstance.id,
      index,
      provider: playgroundInstance.model.provider,
      beforeTools: playgroundInstance.tools,
      afterTools: workingTools,
      results,
      deletedToolIds: [...deleteIds],
      ...(toolChoicePatch != null ? { toolChoicePatch } : {}),
      ...(resetToolChoiceFrom != null ? { resetToolChoiceFrom } : {}),
      ...(renamedToolChoiceTo != null ? { renamedToolChoiceTo } : {}),
    },
  };
}

/**
 * Commits a previously computed {@link WritePromptToolsPlan} to the playground
 * store and returns the result PXI sees, including a fresh revision token.
 */
export function commitWritePromptToolsPlan({
  playgroundStore,
  plan,
}: {
  playgroundStore: PlaygroundStore;
  plan: WritePromptToolsPlan;
}): PromptToolsActionResult<WritePromptToolsResult> {
  playgroundStore.getState().updateInstance({
    instanceId: plan.instanceId,
    patch: {
      tools: plan.afterTools,
      ...(plan.toolChoicePatch != null
        ? { toolChoice: plan.toolChoicePatch }
        : {}),
    },
    dirty: true,
  });
  // The tool editors are uncontrolled (CodeMirror). Bump the external-update
  // revision for the tools we created/updated so any mounted editor remounts
  // and shows the new definition instead of its stale initial value.
  playgroundStore
    .getState()
    .markToolsExternallyUpdated(plan.results.map((result) => result.toolId));

  const afterSnapshot = getPromptToolsSnapshot({
    playgroundStore,
    instanceId: plan.instanceId,
  });
  if (!afterSnapshot.ok) return afterSnapshot;

  return {
    ok: true,
    output: {
      results: plan.results,
      deletedToolIds: plan.deletedToolIds,
      ...(plan.resetToolChoiceFrom != null
        ? { resetToolChoiceFrom: plan.resetToolChoiceFrom }
        : {}),
      ...(plan.renamedToolChoiceTo != null
        ? { renamedToolChoiceTo: plan.renamedToolChoiceTo }
        : {}),
      revision: afterSnapshot.output.revision,
    },
  };
}

/**
 * Plans and immediately commits a `write_prompt_tools` batch. Used by the
 * approval flow on accept (re-planning against the current store so the
 * revision is re-checked) and by tests that apply directly.
 */
export function applyWritePromptTools({
  playgroundStore,
  input,
}: {
  playgroundStore: PlaygroundStore;
  input: WritePromptToolsInput;
}): PromptToolsActionResult<WritePromptToolsResult> {
  const plan = planWritePromptTools({ playgroundStore, input });
  if (!plan.ok) return plan;
  return commitWritePromptToolsPlan({ playgroundStore, plan: plan.output });
}

/**
 * Builds the canonical definition for one batch entry. Pass the existing
 * function tool to patch (only fields present in `entry` change), or `null`
 * to create a fresh definition. `name` is always taken from the entry.
 */
function patchDefinition(
  existing: Extract<Tool, { kind: "function" }> | null,
  entry: WritePromptToolEntry
): CanonicalToolDefinition {
  return {
    ...(existing ? existing.definition : {}),
    name: entry.name,
    ...("description" in entry
      ? { description: entry.description ?? null }
      : {}),
    ...("parameters" in entry
      ? { parameters: entry.parameters ?? undefined }
      : {}),
    ...("strict" in entry ? { strict: entry.strict ?? null } : {}),
  };
}

function resolveInstance({
  playgroundStore,
  instanceId,
}: {
  playgroundStore: PlaygroundStore;
  instanceId?: number;
}): PromptToolsActionResult<{
  playgroundInstance: ReturnType<
    PlaygroundStore["getState"]
  >["instances"][number];
  index: number;
}> {
  const state = playgroundStore.getState();
  const instances = state.instances;
  const resolvedInstanceId =
    instanceId ?? (instances.length === 1 ? instances[0]?.id : undefined);
  if (resolvedInstanceId == null) {
    return {
      ok: false,
      error: `Multiple playground instances are available. Pass one of these instance IDs: ${instances
        .map((instance) => instance.id)
        .join(", ")}.`,
    };
  }
  const index = instances.findIndex(
    (candidate) => candidate.id === resolvedInstanceId
  );
  if (index < 0) {
    return {
      ok: false,
      error: `Playground instance ${resolvedInstanceId} was not found.`,
    };
  }
  return {
    ok: true,
    output: { playgroundInstance: instances[index]!, index },
  };
}

function toPromptToolSnapshot(tool: Tool): PromptToolSnapshot {
  if (tool.kind === "function") {
    return {
      kind: "function",
      id: tool.id,
      name: tool.definition.name,
      ...(tool.definition.description !== undefined
        ? { description: tool.definition.description ?? null }
        : {}),
      ...(tool.definition.parameters !== undefined
        ? { parameters: tool.definition.parameters }
        : {}),
      ...(tool.definition.strict !== undefined
        ? { strict: tool.definition.strict ?? null }
        : {}),
    };
  }
  return {
    kind: "raw",
    id: tool.id,
    raw: tool.raw,
  };
}

function buildPromptToolsRevision(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 5381;
  for (let index = 0; index < serialized.length; index++) {
    hash = (hash * 33) ^ serialized.charCodeAt(index);
  }
  return `prompt-tools-${(hash >>> 0).toString(16)}`;
}
