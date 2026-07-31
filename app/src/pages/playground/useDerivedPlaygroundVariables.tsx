import { useMemo } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { withMediaVariables } from "./playgroundMedia";
import {
  denormalizePlaygroundInstance,
  getVariablesMapFromInstances,
} from "./playgroundUtils";

/**
 * Get the variable values and keys from all instances in the playground
 *
 * Variables are recomputed whenever _anything_ in the playground instances change
 * or when the template language changes. This can be optimized in the future.
 *
 * Media variables are layered on here rather than inside
 * `getVariablesMapFromInstances`: they are declared by a message part instead of by
 * template syntax, and keeping them out of that function leaves it exactly as
 * upstream wrote it.
 */
export const useDerivedPlaygroundVariables = () => {
  const input = usePlaygroundContext((state) => state.input);
  const instances = usePlaygroundContext((state) => state.instances);
  const allInstanceMessages = usePlaygroundContext(
    (state) => state.allInstanceMessages
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const enrichedInstances = useMemo(() => {
    return instances.map((instance) =>
      denormalizePlaygroundInstance(instance, allInstanceMessages)
    );
  }, [instances, allInstanceMessages]);
  const { variableKeys, variablesMap, mediaVariableKeys, mediaVariableKinds } =
    useMemo(() => {
      const base = getVariablesMapFromInstances({
        instances: enrichedInstances,
        templateFormat,
        input,
      });
      return withMediaVariables(base, {
        instances: enrichedInstances,
        input,
      });
    }, [input, enrichedInstances, templateFormat]);

  return { variableKeys, variablesMap, mediaVariableKeys, mediaVariableKinds };
};
