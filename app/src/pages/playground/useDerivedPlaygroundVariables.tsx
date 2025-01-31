import { useMemo } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  denormalizePlaygroundInstance,
  getVariablesMapFromInstances,
} from "./playgroundUtils";

/**
 * Get the variable values and keys from all instances in the playground
 *
 * Variables are recomputed whenever _anything_ in the playground instances change
 * or when the template language changes. This can be optimized in the future.
 */
export const useDerivedPlaygroundVariables = () => {
  const input = usePlaygroundContext((state) => state.input);
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceMessages = usePlaygroundContext(
    (state) => state.instanceMessages
  );
  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  const enrichedInstances = useMemo(() => {
    return instances.map((instance) =>
      denormalizePlaygroundInstance(instance, instanceMessages)
    );
  }, [instances, instanceMessages]);
  const { variableKeys, variablesMap } = useMemo(() => {
    return getVariablesMapFromInstances({
      instances: enrichedInstances,
      templateLanguage,
      input,
    });
  }, [input, enrichedInstances, templateLanguage]);

  return { variableKeys, variablesMap };
};
