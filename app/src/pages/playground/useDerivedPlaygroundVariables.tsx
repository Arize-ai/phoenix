import { useMemo } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { isManualInput } from "@phoenix/store";

import { extractVariablesFromInstances } from "./playgroundUtils";

/**
 * Get the variable keys from all instances in the playground, using the
 * template language to determine the syntax of the variables
 */
export const useDerivedPlaygroundVariableKeys = () => {
  const { instances, templateLanguage } = usePlaygroundContext((state) => ({
    instances: state.instances,
    templateLanguage: state.templateLanguage,
  }));
  const variableKeys = useMemo(() => {
    return extractVariablesFromInstances({
      instances,
      templateLanguage,
    });
  }, [instances, templateLanguage]);

  return variableKeys;
};

/**
 * Get the variable values and keys from all instances in the playground
 *
 * Variables are recomputed whenever _anything_ in the playground instances change
 * or when the template language changes. This can be optimized in the future.
 */
export const useDerivedPlaygroundVariables = () => {
  const variableKeys = useDerivedPlaygroundVariableKeys();
  const variableValueCache = usePlaygroundContext((state) =>
    isManualInput(state.input) ? state.input.variablesValueCache : {}
  );
  const variablesMap = useMemo(() => {
    return variableKeys.reduce(
      (acc, key) => {
        acc[key] = variableValueCache[key] || "";
        return acc;
      },
      {} as Record<string, string>
    );
  }, [variableKeys, variableValueCache]);

  return { variableKeys, variablesMap };
};
