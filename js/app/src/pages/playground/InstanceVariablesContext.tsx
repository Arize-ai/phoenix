import { createContext, type ReactNode, useContext, useMemo } from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import {
  denormalizePlaygroundInstance,
  extractVariablesFromInstance,
} from "./playgroundUtils";

/**
 * A map of instance ID to its extracted template variables.
 */
type InstanceVariablesMap = Record<number, string[]>;

const InstanceVariablesContext = createContext<InstanceVariablesMap>({});

/**
 * Provider that computes instance variables for all instances and provides them via context.
 *
 * This solves a performance problem: previously, instance variables were computed at the
 * table component level and passed to column definitions. When typing caused state updates,
 * the variables map got a new reference, triggering column regeneration and cell re-renders.
 *
 * By moving the computation into a context provider, cells can read variables without
 * the table needing to pass them through column definitions.
 */
export function InstanceVariablesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const instances = usePlaygroundContext((state) => state.instances);
  const allInstanceMessages = usePlaygroundContext(
    (state) => state.allInstanceMessages
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);

  const variablesMap = useMemo(() => {
    const result: InstanceVariablesMap = {};

    for (const instance of instances) {
      const enrichedInstance = denormalizePlaygroundInstance(
        instance,
        allInstanceMessages
      );

      result[instance.id] = extractVariablesFromInstance({
        instance: enrichedInstance,
        templateFormat,
      });
    }

    return result;
  }, [instances, allInstanceMessages, templateFormat]);

  return (
    <InstanceVariablesContext.Provider value={variablesMap}>
      {children}
    </InstanceVariablesContext.Provider>
  );
}

/**
 * Hook to get the computed variables for a specific instance.
 * Must be used within an InstanceVariablesProvider.
 *
 * @param instanceId - The ID of the instance to get variables for
 * @returns Array of variable names for this instance
 */
export function useInstanceVariables(instanceId: number): string[] {
  const map = useContext(InstanceVariablesContext);
  return map[instanceId] ?? [];
}
