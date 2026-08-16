import { getInstanceLabel } from "@phoenix/agent/tools/playgroundPrompt";
import {
  applyBedrockModelPrefix,
  getProviderKeyForGenerativeModelSDK,
} from "@phoenix/components/generative/modelProviderUtils";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";

import {
  parseListPlaygroundModelTargetsInput,
  parseSetPlaygroundModelInput,
} from "./parsers";
import type {
  CreateListPlaygroundModelTargetsClientActionOptions,
  CreateSetPlaygroundModelClientActionOptions,
  ListPlaygroundBuiltinModelTarget,
  ListPlaygroundCustomModelTarget,
  SetPlaygroundModelInput,
} from "./types";

type ResolveInstanceIdResult =
  | { ok: true; instanceId: number }
  | { ok: false; error: string };

function resolveInstanceId({
  input,
  instanceIds,
}: {
  input: SetPlaygroundModelInput;
  instanceIds: number[];
}): ResolveInstanceIdResult {
  if (typeof input.instanceId === "number") {
    return instanceIds.includes(input.instanceId)
      ? { ok: true, instanceId: input.instanceId }
      : {
          ok: false,
          error: `Playground instance ${input.instanceId} was not found.`,
        };
  }
  if (instanceIds.length === 0) {
    return {
      ok: false,
      error: "No playground instances are mounted.",
    };
  }
  if (instanceIds.length === 1 && instanceIds[0] != null) {
    return { ok: true, instanceId: instanceIds[0] };
  }
  return {
    ok: false,
    error: `Multiple playground instances are available. Pass one of these instance IDs: ${instanceIds.join(", ")}.`,
  };
}

function applyModelNameDefaults({
  provider,
  modelName,
  awsBedrockModelPrefix,
}: {
  provider: ModelProvider;
  modelName: string;
  awsBedrockModelPrefix?: string | null;
}): string {
  if (provider === "AWS" && awsBedrockModelPrefix) {
    return applyBedrockModelPrefix({
      modelName,
      prefix: awsBedrockModelPrefix,
    });
  }
  return modelName;
}

export function createSetPlaygroundModelClientAction({
  playgroundStore,
  modelCatalog,
  modelConfigByProvider,
  awsBedrockModelPrefix,
}: CreateSetPlaygroundModelClientActionOptions) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseSetPlaygroundModelInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid set_playground_model input." };
    }

    const state = playgroundStore.getState();
    const instanceIds = state.instances.map((instance) => instance.id);
    const resolvedInstance = resolveInstanceId({ input: parsed, instanceIds });
    if (!resolvedInstance.ok) {
      return resolvedInstance;
    }
    const instance = state.instances.find(
      (candidate) => candidate.id === resolvedInstance.instanceId
    );
    if (!instance) {
      return {
        ok: false,
        error: `Playground instance ${resolvedInstance.instanceId} was not found.`,
      };
    }

    const target = parsed.target;
    let provider: ModelProvider;
    let modelName: string;
    let customProvider: { id: string; name: string } | null = null;

    if (target.type === "builtin") {
      provider = target.provider;
      if (!modelCatalog.installedBuiltInProviders.has(provider)) {
        return {
          ok: false,
          error: `Built-in provider ${provider} is not available in the playground.`,
        };
      }
      modelName = target.modelName;
    } else {
      const providerConfig = modelCatalog.customProviders.find(
        (candidate) => candidate.id === target.customProviderId
      );
      if (!providerConfig) {
        return {
          ok: false,
          error: `Custom provider ${target.customProviderId} was not found.`,
        };
      }
      provider = getProviderKeyForGenerativeModelSDK(providerConfig.sdk);
      modelName = target.modelName;
      customProvider = { id: providerConfig.id, name: providerConfig.name };
    }

    const selectedModelName = applyModelNameDefaults({
      provider,
      modelName,
      awsBedrockModelPrefix,
    });

    if (provider !== instance.model.provider) {
      state.updateProvider({
        instanceId: instance.id,
        provider,
        modelConfigByProvider,
      });
    }
    playgroundStore.getState().updateModel({
      instanceId: instance.id,
      patch: {
        modelName: selectedModelName,
        customProvider,
      },
    });

    const instanceIndex = state.instances.findIndex(
      (candidate) => candidate.id === instance.id
    );
    return {
      ok: true,
      output: JSON.stringify(
        {
          instanceId: instance.id,
          label: getInstanceLabel(instanceIndex),
          provider,
          modelName: selectedModelName,
          ...(customProvider ? { customProvider } : {}),
          message: "Playground model updated.",
        },
        null,
        2
      ),
    };
  };
}

export function createListPlaygroundModelTargetsClientAction({
  availableBuiltinModels,
  availableCustomModels,
}: CreateListPlaygroundModelTargetsClientActionOptions) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseListPlaygroundModelTargetsInput(input);
    if (!parsed) {
      return {
        ok: false,
        error: "Invalid list_playground_model_targets input.",
      };
    }
    const builtinModels: ListPlaygroundBuiltinModelTarget[] =
      availableBuiltinModels.map((model) => ({
        target: {
          type: "builtin",
          provider: model.provider,
          modelName: model.modelName,
        },
      }));
    const customProviderModels: ListPlaygroundCustomModelTarget[] =
      availableCustomModels.map((model) => ({
        target: {
          type: "custom",
          customProviderId: model.customProviderId,
          modelName: model.modelName,
        },
        customProviderName: model.customProviderName,
        provider: model.provider,
      }));

    return {
      ok: true,
      output: JSON.stringify(
        {
          builtinModels,
          customProviderModels,
          message:
            "Use the returned target payloads when calling set_playground_model.",
        },
        null,
        2
      ),
    };
  };
}
