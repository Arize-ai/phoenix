import { isPlainObject } from "@phoenix/utils/jsonUtils";

import { SAVE_PROMPT_TOOL_NAME } from "./constants";
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
 * Attaches accept/reject callbacks to a pending save_prompt proposal.
 */
export function bindPendingSavePromptActions({
  pendingSave,
  savePrompt,
  addToolOutput,
  setPendingSavePrompt,
}: BindPendingSavePromptOptions): PendingSavePrompt {
  return {
    ...pendingSave,
    accept: async ({ approvalSource = "user" } = {}) => {
      setPendingSavePrompt(pendingSave.toolCallId, null);
      const result = await savePrompt(pendingSave.input);
      if (!result.ok) {
        await addToolOutput({
          state: "output-error",
          tool: SAVE_PROMPT_TOOL_NAME,
          toolCallId: pendingSave.toolCallId,
          errorText: result.error,
        });
        return;
      }
      await addToolOutput({
        state: "output-available",
        tool: SAVE_PROMPT_TOOL_NAME,
        toolCallId: pendingSave.toolCallId,
        output: buildAcceptedOutput({
          output: result.output,
          approvalSource,
        }),
      });
    },
    reject: async () => {
      setPendingSavePrompt(pendingSave.toolCallId, null);
      await addToolOutput({
        state: "output-available",
        tool: SAVE_PROMPT_TOOL_NAME,
        toolCallId: pendingSave.toolCallId,
        output: {
          status: "rejected",
          message: "User rejected the proposed prompt save.",
        },
      });
    },
    cancel: async () => {
      setPendingSavePrompt(pendingSave.toolCallId, null);
      await addToolOutput({
        state: "output-error",
        tool: SAVE_PROMPT_TOOL_NAME,
        toolCallId: pendingSave.toolCallId,
        errorText: SAVE_PROMPT_NAVIGATION_CANCEL_ERROR,
      });
    },
  };
}
