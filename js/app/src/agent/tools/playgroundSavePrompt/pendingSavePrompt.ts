import { approvalOutcome } from "@phoenix/agent/shared/pendingApproval";
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
      ...approvalOutcome({ decision: "accepted", source: approvalSource }),
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
    ...approvalOutcome({ decision: "accepted", source: approvalSource }),
  };
}

/**
 * Attaches accept/reject callbacks to a pending prompt save proposal. Each
 * callback resolves the awaiting `execute_ui` script call via `emitResult`;
 * see `bindPendingPromptEditActions` for the result contract.
 */
export function bindPendingSavePromptActions({
  pendingSave,
  savePrompt,
  emitResult,
  setPendingSavePrompt,
}: BindPendingSavePromptOptions): PendingSavePrompt {
  return {
    ...pendingSave,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingSavePrompt(pendingSave.toolCallId, null);
      const result = await savePrompt(pendingSave.input);
      if (!result.ok) {
        emitResult({ ok: false, error: result.error });
        return;
      }
      emitResult({
        ok: true,
        output: buildAcceptedOutput({
          output: result.output,
          approvalSource,
        }),
      });
    },
    reject: async () => {
      setPendingSavePrompt(pendingSave.toolCallId, null);
      emitResult({
        ok: true,
        output: {
          status: "rejected",
          message: "User rejected the proposed prompt save.",
          ...approvalOutcome({ decision: "rejected", source: "user" }),
        },
      });
    },
    cancel: async () => {
      setPendingSavePrompt(pendingSave.toolCallId, null);
      emitResult({ ok: false, error: SAVE_PROMPT_NAVIGATION_CANCEL_ERROR });
    },
  };
}
