import { bindPendingApproval } from "@phoenix/agent/shared/pendingApproval";
import { isPlainObject } from "@phoenix/utils/jsonUtils";

import type { BindPendingSavePromptOptions, PendingSavePrompt } from "./types";

export const SAVE_PROMPT_NAVIGATION_CANCEL_ERROR =
  "The save prompt proposal was cancelled because the prompt editor was unmounted.";

function parseActionOutput(output: string | undefined): unknown {
  if (output === undefined) {
    return "Prompt saved.";
  }
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

function buildAcceptedOutput({
  output,
  approvalSource,
}: {
  output: string | undefined;
  approvalSource: "user" | "auto";
}) {
  const parsedOutput = parseActionOutput(output);
  if (isPlainObject(parsedOutput)) {
    return {
      ...parsedOutput,
      approvalStatus: "accepted",
      acceptedBy: approvalSource,
    };
  }
  return {
    status: "accepted",
    acceptedBy: approvalSource,
    message:
      approvalSource === "auto"
        ? "Prompt save auto-approved."
        : "Prompt save approved.",
    output: parsedOutput,
  };
}

/**
 * Attaches accept/reject/cancel callbacks to a pending save_prompt proposal.
 * The generic lifecycle lives in {@link bindPendingApproval}; the commit runs
 * the prompt-save mutation and shapes its output.
 */
export function bindPendingSavePromptActions({
  pendingSave,
  savePrompt,
  addToolOutput,
  clearPending,
}: BindPendingSavePromptOptions): PendingSavePrompt {
  return bindPendingApproval<PendingSavePrompt>({
    pending: pendingSave,
    addToolOutput,
    clearPending,
    navigationCancelError: SAVE_PROMPT_NAVIGATION_CANCEL_ERROR,
    commit: async ({ approvalSource }) => {
      const result = await savePrompt(pendingSave.input);
      if (!result.ok) {
        return { ok: false, error: result.error };
      }
      return {
        ok: true,
        output: buildAcceptedOutput({ output: result.output, approvalSource }),
      };
    },
    buildRejectedOutput: () => ({
      status: "rejected",
      message: "User rejected the proposed prompt save.",
    }),
  });
}
