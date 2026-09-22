import { useMemo } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  denormalizePlaygroundInstance,
  getVariablesMapFromInstances,
} from "./playgroundUtils";

/**
 * Get the variable values and keys from all instances in the playground, or
 * from the one instance named by `instanceId`.
 *
 * Variables are recomputed whenever _anything_ in the playground instances change
 * or when the template language changes. This can be optimized in the future.
 */
export const useDerivedPlaygroundVariables = ({
  instanceId,
}: { instanceId?: number } = {}) => {
  const input = usePlaygroundContext((state) => state.input);
  const allInstances = usePlaygroundContext((state) => state.instances);

  const instances =
    instanceId == null
      ? allInstances
      : allInstances.filter((instance) => instance.id === instanceId);

  const allInstanceMessages = usePlaygroundContext(
    (state) => state.allInstanceMessages
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const enrichedInstances = useMemo(() => {
    return instances.map((instance) =>
      denormalizePlaygroundInstance(instance, allInstanceMessages)
    );
  }, [instances, allInstanceMessages]);
  const { variableKeys, variablesMap } = useMemo(() => {
    return getVariablesMapFromInstances({
      instances: enrichedInstances,
      templateFormat,
      input,
    });
  }, [input, enrichedInstances, templateFormat]);

  return { variableKeys, variablesMap };
};
