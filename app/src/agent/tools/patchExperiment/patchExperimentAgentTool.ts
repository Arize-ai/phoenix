import { defineTool } from "@phoenix/agent/extensions/registry/defineTool";
import { requireToolSession } from "@phoenix/agent/extensions/registry/requireToolSession";

import {
  commitPatchExperiment,
  fetchExperimentSnapshot,
} from "./applyPatchExperiment";
import { buildPatchExperimentProposal } from "./buildPatchExperimentProposal";
import { PATCH_EXPERIMENT_TOOL_NAME } from "./constants";
import { parsePatchExperimentInput } from "./parsers";
import { bindPendingPatchExperimentActions } from "./pendingPatchExperiment";
import type { PatchExperimentInput } from "./types";

/**
 * Proposes a sparse edit to one experiment's name, description, or metadata as a
 * pending change. Auto-applies when edit approvals are bypassed; otherwise
 * stores the proposal for the UI to accept or reject. The target is fetched by
 * node id at propose time so the card preview and the committed write both come
 * from the actual experiment, and an `updatedAt` snapshot guards against the
 * experiment changing between propose and accept. Requires an active session.
 */
export const patchExperimentAgentTool = defineTool<PatchExperimentInput>({
  name: PATCH_EXPERIMENT_TOOL_NAME,
  parseInput: parsePatchExperimentInput,
  invalidInputErrorText: `Invalid ${PATCH_EXPERIMENT_TOOL_NAME} input. Expected { experimentId: string, name?: string, description?: string | null, metadata?: object }. Provide experimentId plus at least one field to change.`,
  uiBehavior: {
    autoOpen: true,
    scrollIntoViewOnMount: true,
  },
  execute: async ({
    toolCall,
    input,
    sessionId,
    addToolOutput,
    agentStore,
  }) => {
    const session = await requireToolSession({
      toolName: PATCH_EXPERIMENT_TOOL_NAME,
      toolCall,
      sessionId,
      addToolOutput,
      errorText: "Cannot propose an experiment edit without an active session.",
    });
    if (session == null) return;

    let snapshot;
    try {
      snapshot = await fetchExperimentSnapshot(input.experimentId);
    } catch (error) {
      await addToolOutput({
        state: "output-error",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        errorText:
          error instanceof Error
            ? error.message
            : "Failed to read the experiment to edit.",
      });
      return;
    }

    const proposal = buildPatchExperimentProposal(input, snapshot);
    if (proposal == null) {
      await addToolOutput({
        state: "output-available",
        tool: PATCH_EXPERIMENT_TOOL_NAME,
        toolCallId: toolCall.toolCallId,
        output: {
          status: "no_change",
          experimentId: input.experimentId,
          experimentName: snapshot.name,
          message: `The proposed edit matches experiment "${snapshot.name}" as it already is; nothing to apply.`,
        },
      });
      return;
    }

    const pendingPatch = bindPendingPatchExperimentActions({
      pendingPatch: {
        toolCallId: toolCall.toolCallId,
        sessionId: session,
        experimentId: input.experimentId,
        experimentName: snapshot.name,
        expectedUpdatedAt: snapshot.updatedAt,
        payload: proposal.payload,
        diff: proposal.diff,
      },
      fetchExperimentSnapshot,
      commitPatchExperiment,
      addToolOutput,
      setPendingPatchExperiment:
        agentStore.getState().setPendingPatchExperiment,
    });

    if (agentStore.getState().permissions.edits === "bypass") {
      await pendingPatch.accept?.({ approvalSource: "auto" });
      return;
    }

    agentStore
      .getState()
      .setPendingPatchExperiment(toolCall.toolCallId, pendingPatch);
  },
});
