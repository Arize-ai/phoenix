import { DEFAULT_PROMPT_VERSION_TAGS } from "@phoenix/constants";
import { instanceToPromptVersion } from "@phoenix/pages/playground/fetchPlaygroundPrompt";
import { denormalizePlaygroundInstance } from "@phoenix/pages/playground/playgroundUtils";
import type { PlaygroundStore } from "@phoenix/store/playground";

type PromptVersionTagInput = {
  name: string;
  description: string | null;
};

/**
 * Map tag names to the input shape expected by the create/update prompt mutations.
 */
export function toPromptVersionTagInputs(
  tags: readonly string[] | null | undefined
): PromptVersionTagInput[] | null {
  if (!tags || tags.length === 0) {
    return null;
  }
  return tags.map((tagName) => {
    const tagDefinition = DEFAULT_PROMPT_VERSION_TAGS.find(
      (def) => def.name === tagName
    );
    return {
      name: tagName,
      description: tagDefinition?.description ?? null,
    };
  });
}

/**
 * Converts a playground instance to a prompt version.
 * @param instanceId - The instance ID
 * @param store - The playground store
 * @returns The prompt input and prompt version ID if available
 */
export const getInstancePromptParamsFromStore = (
  instanceId: number,
  store: PlaygroundStore
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
  const promptInput = instanceToPromptVersion({
    instance: enrichedInstance,
    templateFormat: state.templateFormat,
  });
  if (!promptInput) {
    throw new Error(`Could not convert instance ${instanceId} to prompt`);
  }
  const promptVersionId = instance.prompt?.version ?? null;
  return {
    promptInput,
    promptVersionId,
  };
};
