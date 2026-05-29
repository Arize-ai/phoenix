import type { AgentContext } from "@phoenix/agent/context/agentContextTypes";
import type { PlaygroundInstance } from "@phoenix/store/playground";

type PlaygroundAgentContext = Extract<AgentContext, { type: "playground" }>;
type PlaygroundAgentInstance = NonNullable<
  PlaygroundAgentContext["instances"]
>[number];
type PlaygroundAgentModel = NonNullable<PlaygroundAgentInstance["model"]>;
type PlaygroundAgentBuiltinModel = Extract<
  PlaygroundAgentModel,
  { type: "builtin" }
>;
type PlaygroundAgentCustomModel = Extract<
  PlaygroundAgentModel,
  { type: "custom" }
>;

type PlaygroundAvailableBuiltinModel = Omit<
  PlaygroundAgentBuiltinModel,
  "type"
>;
type PlaygroundAvailableCustomModel = Omit<PlaygroundAgentCustomModel, "type">;

export function getPlaygroundInstanceForAgent(
  instance: Pick<PlaygroundInstance, "id" | "model">
): PlaygroundAgentInstance {
  const { modelName } = instance.model;
  if (modelName == null) {
    return {
      instanceId: instance.id,
    };
  }
  if (instance.model.customProvider) {
    return {
      instanceId: instance.id,
      model: {
        type: "custom",
        customProviderId: instance.model.customProvider.id,
        customProviderName: instance.model.customProvider.name,
        provider: instance.model.provider,
        modelName,
      },
    };
  }
  return {
    instanceId: instance.id,
    model: {
      type: "builtin",
      provider: instance.model.provider,
      modelName,
    },
  };
}

function arePlaygroundAgentModelsEqual(
  left: PlaygroundAgentInstance["model"],
  right: PlaygroundAgentInstance["model"]
): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  if (
    left.type !== right.type ||
    left.provider !== right.provider ||
    left.modelName !== right.modelName
  ) {
    return false;
  }
  if (left.type === "custom" && right.type === "custom") {
    return (
      left.customProviderId === right.customProviderId &&
      left.customProviderName === right.customProviderName
    );
  }
  return true;
}

export function arePlaygroundInstancesForAgentEqual(
  left: PlaygroundAgentInstance[],
  right: PlaygroundAgentInstance[]
): boolean {
  return (
    left.length === right.length &&
    left.every((leftInstance, index) => {
      const rightInstance = right[index];
      return (
        rightInstance != null &&
        leftInstance.instanceId === rightInstance.instanceId &&
        arePlaygroundAgentModelsEqual(leftInstance.model, rightInstance.model)
      );
    })
  );
}

export function buildPlaygroundAgentContext({
  instances,
  availableBuiltinModels,
  availableCustomModels,
}: {
  instances: PlaygroundAgentInstance[];
  availableBuiltinModels: PlaygroundAvailableBuiltinModel[];
  availableCustomModels: PlaygroundAvailableCustomModel[];
}): PlaygroundAgentContext {
  return {
    type: "playground",
    instances,
    availableBuiltinModels: availableBuiltinModels.map((model) => ({
      type: "builtin",
      ...model,
    })),
    availableCustomModels: availableCustomModels.map((model) => ({
      type: "custom",
      ...model,
    })),
  };
}
