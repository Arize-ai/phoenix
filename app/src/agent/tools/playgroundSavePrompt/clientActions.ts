import { z } from "zod";

import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSavePromptInput } from "./parsers";
import { bindPendingSavePromptActions } from "./pendingSavePrompt";
import {
  getSavePromptPreview,
  savePlaygroundPrompt,
} from "./savePlaygroundPrompt";
import type {
  SavePlaygroundPromptParams,
  SavePromptToolOutputSender,
  PendingSavePrompt,
} from "./types";

type SavePlaygroundPrompt = (
  params: SavePlaygroundPromptParams
) => ReturnType<typeof savePlaygroundPrompt>;

const savePromptActionContextSchema = z.object({
  toolCallId: z.string(),
  sessionId: z.string(),
  addToolOutput: z.custom<SavePromptToolOutputSender>(
    (value) => typeof value === "function"
  ),
});

function parseSavePromptActionContext(context: unknown) {
  return savePromptActionContextSchema.safeParse(context).data ?? null;
}

/**
 * Creates the client action handler for save_prompt.
 * Saves active playground instance state through the prompt GraphQL mutations.
 */
export function createSavePromptClientAction({
  playgroundStore,
  setPendingSavePrompt,
  shouldAutoAccept = () => false,
  savePrompt = savePlaygroundPrompt,
}: {
  playgroundStore: PlaygroundStore;
  setPendingSavePrompt: (
    toolCallId: string,
    pendingSave: PendingSavePrompt | null
  ) => void;
  shouldAutoAccept?: () => boolean;
  savePrompt?: SavePlaygroundPrompt;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const actionContext = parseSavePromptActionContext(context);
    if (!actionContext) {
      return {
        ok: false,
        error: "Cannot propose prompt save without tool call context.",
      };
    }
    const parsed = parseSavePromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid save_prompt input." };
    }

    const preview = getSavePromptPreview({ playgroundStore, input: parsed });
    if (!preview.ok) return preview;

    const pendingSave = bindPendingSavePromptActions({
      pendingSave: {
        toolCallId: actionContext.toolCallId,
        sessionId: actionContext.sessionId,
        input: parsed,
        preview: preview.output,
      },
      savePrompt: async (saveInput) => {
        const result = await savePrompt({
          playgroundStore,
          input: saveInput,
        });
        if (!result.ok) return result;
        return {
          ok: true,
          output: JSON.stringify(result.output, null, 2),
        };
      },
      addToolOutput: actionContext.addToolOutput,
      setPendingSavePrompt,
    });

    if (shouldAutoAccept()) {
      await pendingSave.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingSavePrompt(actionContext.toolCallId, pendingSave);
    return { ok: true };
  };
}
