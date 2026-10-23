import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { arePlaygroundInstancesEqualExceptProgress } from "@phoenix/store/playground/selectors";

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
 *
 * Run progress is ignored for the same reason: a run streams one store write
 * per result, each of which replaces `instances`, and none of them changes a
 * template.
 */
export function InstanceVariablesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const instances = usePlaygroundContext(
    (state) => state.instances,
    arePlaygroundInstancesEqualExceptProgress
  );
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
  // Typing in a template or a decision recomputes the map on every keystroke,
  // but rarely changes a variable; keep the last map while its contents are
  // the same so the cells reading it do not re-render.
  const [stableVariablesMap, setStableVariablesMap] = useState(variablesMap);
  if (
    stableVariablesMap !== variablesMap &&
    !areInstanceVariablesMapsEqual(stableVariablesMap, variablesMap)
  ) {
    setStableVariablesMap(variablesMap);
  }

  return (
    <InstanceVariablesContext.Provider value={stableVariablesMap}>
      {children}
    </InstanceVariablesContext.Provider>
  );
}

function areInstanceVariablesMapsEqual(
  left: InstanceVariablesMap,
  right: InstanceVariablesMap
): boolean {
  const leftIds = Object.keys(left);
  if (leftIds.length !== Object.keys(right).length) {
    return false;
  }
  return leftIds.every((id) => {
    const leftVariables = left[Number(id)];
    const rightVariables = right[Number(id)];
    return (
      rightVariables != null &&
      leftVariables.length === rightVariables.length &&
      leftVariables.every((name, index) => name === rightVariables[index])
    );
  });
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
