import {
  AGENT_CURATED_MODELS_CONFIG,
  isCuratedAgentBuiltInModel,
} from "@phoenix/agent/models/curatedModels";
import {
  ModelMenu,
  type ModelMenuProps,
} from "@phoenix/components/generative/ModelMenu";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

/**
 * Assistant-scoped wrapper around the shared model picker.
 *
 * The assistant only exposes curated built-in models while still allowing
 * custom providers. This keeps assistant policy out of the shared picker.
 */
export function AgentModelMenu(props: Omit<ModelMenuProps, "isDisabled">) {
  const isDisabled = useAgentContext((state) =>
    Object.values(state.chatStatusBySessionId).some(
      (status) => status === "submitted" || status === "streaming"
    )
  );
  return (
    <ModelMenu
      {...props}
      isDisabled={isDisabled}
      allowBuiltInCustomModelEntry={false}
      builtInProvidersFirst
      builtInModelFilter={({ providerKey, modelName }) =>
        isCuratedAgentBuiltInModel({
          provider: providerKey,
          modelName,
          curatedBuiltInModels:
            AGENT_CURATED_MODELS_CONFIG.curatedBuiltInModels,
        })
      }
    />
  );
}
