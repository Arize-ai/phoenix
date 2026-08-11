import { parseUiOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import { parseSavePromptInput } from "./parsers";
import { bindPendingSavePromptActions } from "./pendingSavePrompt";
import {
  getSavePromptPreview,
  savePlaygroundPrompt,
} from "./savePlaygroundPrompt";
import type { SavePlaygroundPromptParams, PendingSavePrompt } from "./types";

type SavePlaygroundPrompt = (
  params: SavePlaygroundPromptParams
) => ReturnType<typeof savePlaygroundPrompt>;

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
    const callContext = parseUiOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error: "Cannot propose prompt save without an operation call context.",
      };
    }
    const parsed = parseSavePromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid playground.prompt.save input." };
    }

    const preview = getSavePromptPreview({ playgroundStore, input: parsed });
    if (!preview.ok) return preview;

    // The returned promise resolves when the user (or bypass mode) decides;
    // the awaiting execute_ui script sits parked on it until then.
    return new Promise((resolve) => {
      const pendingSave = bindPendingSavePromptActions({
        pendingSave: {
          toolCallId: callContext.callId,
          sessionId: callContext.sessionId ?? "",
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
        emitResult: resolve,
        setPendingSavePrompt,
      });

      if (shouldAutoAccept()) {
        void pendingSave.accept?.({ approvalSource: "auto" });
        return;
      }

      setPendingSavePrompt(callContext.callId, pendingSave);
    });
  };
}
