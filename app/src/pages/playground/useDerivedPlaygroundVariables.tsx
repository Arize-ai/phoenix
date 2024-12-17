import { useMemo } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { getVariablesMapFromInstances } from "./playgroundUtils";

/**
 * Get the variable values and keys from all instances in the playground
 *
 * Variables are recomputed whenever _anything_ in the playground instances change
 * or when the template language changes. This can be optimized in the future.
 */
export const useDerivedPlaygroundVariables = () => {
  const input = usePlaygroundContext((state) => state.input);
  const instances = usePlaygroundContext((state) => state.instances);
  const templateLanguage = usePlaygroundContext(
    (state) => state.templateLanguage
  );
  const { variableKeys, variablesMap } = useMemo(() => {
    return getVariablesMapFromInstances({
      instances,
      templateLanguage,
      input,
    });
  }, [input, instances, templateLanguage]);

  return { variableKeys, variablesMap };
};
