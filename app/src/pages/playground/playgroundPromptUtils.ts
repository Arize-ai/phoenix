import { usePlaygroundStore } from "@phoenix/contexts/PlaygroundContext";
import { instanceToPromptVersion } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { denormalizePlaygroundInstance } from "@phoenix/pages/playground/playgroundUtils";

/**
 * Converts a playground instance to a prompt version.
 * @param instanceId - The instance ID
 * @param store - The playground store
 * @returns The prompt input, template format, and prompt version ID if available
 */
export const getInstancePromptParamsFromStore = (
  instanceId: number,
  store: ReturnType<typeof usePlaygroundStore>
) => {
  const state = store.getState();
  const allInstanceMessages = state.allInstanceMessages;
  const instance = state.instances.find(
    (instance) => instance.id === instanceId
  );
  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }
  const enrichedInstance = denormalizePlaygroundInstance(
    instance,
    allInstanceMessages
  );
  const promptInput = instanceToPromptVersion(enrichedInstance);
  if (!promptInput) {
    throw new Error(`Could not convert instance ${instanceId} to prompt`);
  }
  const templateFormat = state.templateFormat;
  const promptVersionId = instance.prompt?.version ?? null;
  return {
    promptInput,
    templateFormat,
    promptVersionId,
  };
};
