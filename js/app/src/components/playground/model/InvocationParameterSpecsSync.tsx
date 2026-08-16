import { useEffect } from "react";

import { DEFAULT_OPENAI_API_TYPE } from "@phoenix/constants/generativeConstants";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

/**
 * Keeps instance invocation parameters aligned with the static spec table when model metadata
 * or saved provider defaults change.
 */
export function InvocationParameterSpecsSync({
  instanceId,
}: {
  instanceId: number;
}) {
  const instances = usePlaygroundContext((state) => state.instances);
  const instance = instances.find((i) => i.id === instanceId);
  if (!instance) {
    throw new Error("Instance not found");
  }
  const modelProvider = instance.model.provider;
  const modelName = instance.model.modelName;
  const isOpenAIProvider =
    modelProvider === "OPENAI" || modelProvider === "AZURE_OPENAI";
  const openaiApiType = isOpenAIProvider
    ? (instance.model.openaiApiType ?? DEFAULT_OPENAI_API_TYPE)
    : null;
  const modelConfigByProvider = usePreferencesContext(
    (state) => state.modelConfigByProvider
  );
  const syncInvocationParametersWithSpecs = usePlaygroundContext(
    (state) => state.syncInvocationParametersWithSpecs
  );
  const promptId = instance.prompt?.id;

  useEffect(() => {
    syncInvocationParametersWithSpecs({
      instanceId,
      modelConfigByProvider,
    });
  }, [
    instanceId,
    syncInvocationParametersWithSpecs,
    modelConfigByProvider,
    promptId,
    modelProvider,
    modelName,
    openaiApiType,
  ]);

  return null;
}
